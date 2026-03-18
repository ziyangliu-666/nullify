use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SteamUser {
    pub steam_id64: String,
    pub account_id: String,
    pub account_name: String,
    pub persona_name: String,
    pub game_cfg: String,
    pub userdata_cfg: Option<String>,
    pub localconfig_path: Option<String>,
    pub is_most_recent: bool,
    /// base64 data URL: "data:image/png;base64,..."
    pub avatar_data: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub jiting: bool,
    pub jiting_mode: String,
    pub bhop: bool,
    pub jumpbug: bool,
    pub jump_throw: bool,
    pub fwd_jump_throw: bool,
    pub sensitivity: f32,
    pub m_yaw: f32,
    pub m_pitch: f32,
    pub toggle_jiting_key: String,
    pub jump_throw_key: String,
    pub fwd_jump_throw_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            jiting: true,
            jiting_mode: "jt_mode_3".into(),
            bhop: true,
            jumpbug: false,
            jump_throw: true,
            fwd_jump_throw: false,
            sensitivity: 1.0,
            m_yaw: 0.022,
            m_pitch: 0.022,
            toggle_jiting_key: "v".into(),
            jump_throw_key: "l".into(),
            fwd_jump_throw_key: "p".into(),
        }
    }
}

// ─── User detection ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn detect_users() -> Result<Vec<SteamUser>, String> {
    let steam_path = find_steam_path()?;

    let game_cfg = PathBuf::from(&steam_path)
        .join("steamapps/common/Counter-Strike Global Offensive/game/csgo/cfg");

    if !game_cfg.exists() {
        return Err(format!(
            "CS2 CFG 目录不存在：{}",
            game_cfg.display()
        ));
    }

    let game_cfg_str = game_cfg.to_string_lossy().into_owned();

    // Parse loginusers.vdf
    let loginusers_path = PathBuf::from(&steam_path).join("config/loginusers.vdf");
    let login_content = fs::read_to_string(&loginusers_path)
        .unwrap_or_default();

    let mut users = parse_loginusers_vdf(&login_content);

    // Sort: most recent first
    users.sort_by(|a, b| b.3.cmp(&a.3));

    // If no users in VDF, try to detect from userdata folders
    if users.is_empty() {
        let userdata = PathBuf::from(&steam_path).join("userdata");
        if let Ok(entries) = fs::read_dir(&userdata) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().into_owned();
                if name.chars().all(|c| c.is_ascii_digit()) {
                    users.push((String::new(), name.clone(), name, true));
                }
            }
        }
    }

    let result = users
        .into_iter()
        .map(|(id64, account_name, persona_name, is_most_recent)| {
            build_steam_user(
                &steam_path,
                id64,
                account_name,
                persona_name,
                is_most_recent,
                &game_cfg_str,
            )
        })
        .collect();

    Ok(result)
}

/// Returns Vec<(steam_id64, account_name, persona_name, is_most_recent)>
fn parse_loginusers_vdf(content: &str) -> Vec<(String, String, String, bool)> {
    let mut users = Vec::new();
    let mut depth: i32 = 0;
    let mut in_users = false;
    let mut current_id: Option<String> = None;
    let mut cur_account = String::new();
    let mut cur_persona = String::new();
    let mut cur_most_recent = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "{" {
            depth += 1;
        } else if trimmed == "}" {
            // Closing a user block at depth 2
            if depth == 2 && in_users {
                if let Some(id) = current_id.take() {
                    users.push((id, cur_account.clone(), cur_persona.clone(), cur_most_recent));
                    cur_account.clear();
                    cur_persona.clear();
                    cur_most_recent = false;
                }
            }
            depth -= 1;
            if depth == 0 {
                in_users = false;
            }
        } else if !trimmed.is_empty() {
            let parts = vdf_strings(trimmed);
            if parts.is_empty() {
                continue;
            }

            match depth {
                0 => {
                    if parts[0].to_lowercase() == "users" {
                        in_users = true;
                    }
                }
                1 if in_users => {
                    // SteamID64 key (bare, block follows on next line)
                    if parts.len() == 1
                        && parts[0].len() >= 15
                        && parts[0].chars().all(|c| c.is_ascii_digit())
                    {
                        current_id = Some(parts[0].clone());
                    }
                }
                2 if in_users && parts.len() == 2 => {
                    match parts[0].to_lowercase().as_str() {
                        "accountname" => cur_account = parts[1].clone(),
                        "personaname" => cur_persona = parts[1].clone(),
                        "mostrecent" => cur_most_recent = parts[1] == "1",
                        _ => {}
                    }
                }
                _ => {}
            }
        }
    }

    users
}

fn build_steam_user(
    steam_path: &str,
    id64: String,
    account_name: String,
    persona_name: String,
    is_most_recent: bool,
    game_cfg: &str,
) -> SteamUser {
    // account_id32 = steamid64 - 76561197960265728
    let account_id = id64
        .parse::<u64>()
        .ok()
        .and_then(|n| n.checked_sub(76561197960265728))
        .map(|n| n.to_string())
        .unwrap_or_default();

    let userdata_base = PathBuf::from(steam_path)
        .join("userdata")
        .join(&account_id);

    let userdata_cfg = {
        let p = userdata_base.join("730/local/cfg");
        if p.is_dir() {
            Some(p.to_string_lossy().into_owned())
        } else {
            None
        }
    };

    let localconfig_path = {
        let p = userdata_base.join("config/localconfig.vdf");
        if p.exists() {
            Some(p.to_string_lossy().into_owned())
        } else {
            None
        }
    };

    // Load avatar from Steam's avatarcache
    let avatar_data = if !id64.is_empty() {
        let p = PathBuf::from(steam_path)
            .join("config/avatarcache")
            .join(format!("{}.png", id64));
        fs::read(&p)
            .ok()
            .map(|bytes| format!("data:image/png;base64,{}", to_base64(&bytes)))
    } else {
        None
    };

    SteamUser {
        steam_id64: id64,
        account_id,
        account_name,
        persona_name,
        game_cfg: game_cfg.to_string(),
        userdata_cfg,
        localconfig_path,
        is_most_recent,
        avatar_data,
    }
}

// ─── Steam path detection ─────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn find_steam_path() -> Result<String, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    // Try registry keys in order
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let candidates: &[(&RegKey, &str, &str)] = &[
        (&hklm, "SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
        (&hklm, "SOFTWARE\\Valve\\Steam", "InstallPath"),
        (&hkcu, "SOFTWARE\\Valve\\Steam", "SteamPath"),
        (&hkcu, "SOFTWARE\\Valve\\Steam", "InstallPath"),
    ];

    for (hive, subkey, value) in candidates {
        if let Ok(key) = hive.open_subkey(subkey) {
            if let Ok(path) = key.get_value::<String, _>(value) {
                if PathBuf::from(&path).exists() {
                    return Ok(path);
                }
            }
        }
    }

    // Fallback: common install locations
    let drives = ["C", "D", "E", "F"];
    let paths = [
        "Program Files (x86)\\Steam",
        "Program Files\\Steam",
        "Steam",
    ];
    for drive in &drives {
        for path in &paths {
            let full = format!("{}:\\{}", drive, path);
            if PathBuf::from(&full).exists() {
                return Ok(full);
            }
        }
    }

    Err("未找到 Steam 安装目录".into())
}

#[cfg(not(target_os = "windows"))]
fn find_steam_path() -> Result<String, String> {
    Err("仅 Windows 支持自动检测 Steam 路径".into())
}

// ─── Install ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn install_cfg(app: tauri::AppHandle, game_cfg_dir: String) -> Result<(), String> {
    let src = resolve_cfg_source(&app)?;
    let dest = PathBuf::from(&game_cfg_dir).join("nullify");

    // Remove stale installation before copying so old flat files don't linger
    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| format!("清理旧版本失败: {}", e))?;
    }

    copy_dir_recursive(&src, &dest).map_err(|e| format!("安装失败: {}", e))?;

    Ok(())
}

fn resolve_cfg_source(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Dev builds: always use the source directory so changes take effect immediately
    // without needing to restart the dev server (bypasses stale resource cache in target/)
    #[cfg(debug_assertions)]
    {
        let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("cfg"))
            .unwrap_or_else(|| PathBuf::from("../../cfg"));
        if dev_path.exists() {
            return Ok(dev_path);
        }
    }

    // Production: bundled resources
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("cfg");
        if bundled.exists() {
            return Ok(bundled);
        }
    }

    // Final fallback for dev
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("cfg"))
        .unwrap_or_else(|| PathBuf::from("../../cfg"));

    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!("CFG 源文件未找到 (dev path: {})", dev_path.display()))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let name = entry.file_name();
        if name.to_string_lossy() == ".gitkeep" {
            continue;
        }
        let src_path = entry.path();
        let dst_path = dst.join(&name);
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn install_status(game_cfg_dir: String) -> bool {
    PathBuf::from(&game_cfg_dir)
        .join("nullify/setup.cfg")
        .exists()
}

// ─── Launch options ───────────────────────────────────────────────────────────

const CS2_APP_ID: &str = "730";
const LAUNCH_OPTION_VALUE: &str =
    r#"+exec nullify/setup -testscript "../../csgo/cfg/nullify/.vtest""#;

#[tauri::command]
pub fn get_launch_options(localconfig_path: String) -> Result<String, String> {
    let content = fs::read_to_string(&localconfig_path)
        .map_err(|e| format!("无法读取 localconfig.vdf: {}", e))?;

    Ok(extract_launch_options(&content).unwrap_or_default())
}

/// Returns Some(value) if found, None if not found
fn extract_launch_options(content: &str) -> Option<String> {
    let mut depth: i32 = 0;
    let mut in_apps = false;
    let mut apps_depth = 0i32;
    let mut in_730 = false;
    let mut expect_730_block = false;
    let mut t730_depth = 0i32;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "{" {
            depth += 1;
            if expect_730_block {
                in_730 = true;
                t730_depth = depth;
                expect_730_block = false;
            }
            continue;
        }

        if trimmed == "}" {
            if in_730 && depth <= t730_depth {
                in_730 = false;
            }
            if in_apps && depth <= apps_depth {
                in_apps = false;
                expect_730_block = false;
            }
            depth -= 1;
            continue;
        }

        if trimmed.is_empty() {
            continue;
        }

        let parts = vdf_strings(trimmed);
        if parts.is_empty() {
            continue;
        }

        if !in_apps {
            if parts.len() == 1 && parts[0] == "apps" {
                // Will enter apps on next {
                in_apps = true;
                apps_depth = depth + 1; // depth after the upcoming {
            }
        } else if in_apps && !in_730 {
            if parts.len() == 1 && parts[0] == CS2_APP_ID && depth == apps_depth {
                expect_730_block = true;
            }
        } else if in_730 && depth == t730_depth {
            if parts.len() == 2 && parts[0] == "LaunchOptions" {
                return Some(parts[1].clone());
            }
        }
    }

    None
}

#[tauri::command]
pub fn set_launch_options(localconfig_path: String, value: String) -> Result<bool, String> {
    let content = fs::read_to_string(&localconfig_path)
        .map_err(|e| format!("无法读取 localconfig.vdf: {}", e))?;

    let new_content = modify_launch_options(&content, &value)
        .map_err(|e| format!("写入启动项失败: {}", e))?;

    fs::write(&localconfig_path, new_content)
        .map_err(|e| format!("无法写入 localconfig.vdf: {}", e))?;

    // Return true if Steam is currently running (needs restart)
    Ok(is_steam_running())
}

/// Returns the default nullify launch option string
#[tauri::command]
pub fn nullify_launch_option() -> String {
    LAUNCH_OPTION_VALUE.to_string()
}

fn modify_launch_options(content: &str, new_value: &str) -> Result<String, String> {
    #[derive(PartialEq, Clone, Debug)]
    enum State {
        Scanning,
        AppsNext,
        InApps(i32),
        T730Next(i32),
        In730(i32),
        Done,
    }

    let mut state = State::Scanning;
    let mut depth: i32 = 0;
    let mut lines_out: Vec<String> = Vec::new();
    let mut found = false;

    for line in content.lines() {
        let trimmed = line.trim();
        let mut replaced = false;

        if trimmed == "{" {
            depth += 1;
            state = match state {
                State::AppsNext => State::InApps(depth),
                State::T730Next(_ad) => State::In730(depth),
                other => other,
            };
        } else if trimmed == "}" {
            // If we're about to close the 730 block and LaunchOptions wasn't found, insert it
            if let State::In730(td) = &state {
                if depth <= *td && !found {
                    let indent_len = line.len() - line.trim_start().len();
                    let indent = &line[..indent_len];
                    lines_out.push(format!("{}\t\"LaunchOptions\"\t\t\"{}\"", indent, vdf_escape(new_value)));
                    found = true;
                }
            }
            state = match &state {
                State::InApps(d) if depth <= *d => State::Scanning,
                State::In730(d) if depth <= *d => State::Done,
                other => other.clone(),
            };
            depth -= 1;
        } else if !trimmed.is_empty() {
            let parts = vdf_strings(trimmed);
            if !parts.is_empty() {
                state = match state.clone() {
                    State::Scanning => {
                        if parts[0] == "apps" && parts.len() == 1 {
                            State::AppsNext
                        } else {
                            State::Scanning
                        }
                    }
                    State::AppsNext => {
                        // Non-{ line after "apps" key → it was KV, not block
                        State::Scanning
                    }
                    State::InApps(ad) => {
                        if parts[0] == CS2_APP_ID && parts.len() == 1 && depth == ad {
                            State::T730Next(ad)
                        } else {
                            State::InApps(ad)
                        }
                    }
                    State::T730Next(ad) => {
                        // Non-{ line means "730" was a KV pair (binary blob)
                        State::InApps(ad)
                    }
                    State::In730(td) => {
                        if parts[0] == "LaunchOptions" && depth == td {
                            // Replace this line
                            let indent_len = line.len() - line.trim_start().len();
                            let indent = &line[..indent_len];
                            lines_out.push(format!(
                                "{}\"LaunchOptions\"\t\t\"{}\"",
                                indent, vdf_escape(new_value)
                            ));
                            found = true;
                            replaced = true;
                        }
                        State::In730(td)
                    }
                    State::Done => State::Done,
                };
            }
        }

        if !replaced {
            lines_out.push(line.to_string());
        }
    }

    if !found {
        return Err("在 localconfig.vdf 中未找到 CS2 (730) 的 apps 块，请确认 CS2 已在该账号下启动过一次".into());
    }

    let mut result = lines_out.join("\n");
    if content.ends_with('\n') {
        result.push('\n');
    }
    Ok(result)
}

fn is_steam_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq Steam.exe", "/NH"])
            .output()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout).contains("Steam.exe")
            })
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_settings(cfg_dir: String, userdata_cfg: Option<String>) -> Result<Settings, String> {
    let path = PathBuf::from(&cfg_dir).join("nullify/user/settings.cfg");

    let mut s = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取 settings.cfg 失败: {}", e))?;
        parse_settings(&content)
    } else {
        Settings::default()
    };

    // Override sensitivity from the cloud-synced vcfg (source of truth)
    if let Some(ref udir) = userdata_cfg {
        let (sens, yaw, pitch) = read_vcfg_sensitivity(udir);
        if let Some(v) = sens { s.sensitivity = v; }
        if let Some(v) = yaw  { s.m_yaw = v; }
        if let Some(v) = pitch { s.m_pitch = v; }
    }

    // Read key bindings from keys.cfg
    let keys_path = PathBuf::from(&cfg_dir).join("nullify/user/keys.cfg");
    if let Ok(keys_content) = fs::read_to_string(&keys_path) {
        let (tk, jk, fjk) = parse_keys_cfg(&keys_content);
        if !tk.is_empty()  { s.toggle_jiting_key = tk; }
        if !jk.is_empty()  { s.jump_throw_key = jk; }
        if !fjk.is_empty() { s.fwd_jump_throw_key = fjk; }
    }

    Ok(s)
}

fn parse_settings(content: &str) -> Settings {
    let mut s = Settings::default();

    for line in content.lines() {
        let line = {
            let trimmed = line.trim();
            if let Some(idx) = trimmed.find("//") {
                trimmed[..idx].trim()
            } else {
                trimmed
            }
        };
        if line.is_empty() {
            continue;
        }

        let lower = line.to_lowercase();

        if lower.starts_with("jt_mode_") {
            s.jiting_mode = lower.clone();
        }

        match lower.as_str() {
            "open_jiting" => s.jiting = true,
            "close_jiting" => s.jiting = false,
            "open_bhop" => s.bhop = true,
            "close_bhop" => s.bhop = false,
            "open_jumpbug" => s.jumpbug = true,
            "close_jumpbug" => s.jumpbug = false,
            "open_jump_throw" => s.jump_throw = true,
            "close_jump_throw" => s.jump_throw = false,
            "open_fwd_jump_throw" => s.fwd_jump_throw = true,
            "close_fwd_jump_throw" => s.fwd_jump_throw = false,
            _ => {}
        }

        if let Some(v) = extract_alias_cvar(line, "usr_sensitivity", "sensitivity") {
            s.sensitivity = v;
        }
        if let Some(v) = extract_alias_cvar(line, "usr_m_yaw", "m_yaw") {
            s.m_yaw = v;
        }
        if let Some(v) = extract_alias_cvar(line, "usr_m_pitch", "m_pitch") {
            s.m_pitch = v;
        }
    }

    s
}

fn extract_alias_cvar(line: &str, alias_name: &str, cvar_name: &str) -> Option<f32> {
    let lower = line.to_lowercase();
    let prefix = format!("alias {}", alias_name.to_lowercase());
    if !lower.starts_with(&prefix) {
        return None;
    }
    let open = line.find('"')?;
    let close = line.rfind('"')?;
    if close <= open {
        return None;
    }
    let quoted = &line[open + 1..close];
    let cvar_prefix = format!("{} ", cvar_name.to_lowercase());
    if !quoted.to_lowercase().starts_with(&cvar_prefix) {
        return None;
    }
    quoted[cvar_prefix.len()..].trim().parse::<f32>().ok()
}

#[tauri::command]
pub fn write_settings(cfg_dir: String, userdata_cfg: Option<String>, settings: Settings) -> Result<(), String> {
    let dir = PathBuf::from(&cfg_dir).join("nullify/user");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    let path = dir.join("settings.cfg");
    let content = render_settings(&settings);
    fs::write(&path, content)
        .map_err(|e| format!("写入 settings.cfg 失败: {}", e))?;

    // Sync sensitivity back to the cloud-synced vcfg (keep in sync with CS2)
    if let Some(ref udir) = userdata_cfg {
        let _ = write_vcfg_sensitivity(udir, settings.sensitivity, settings.m_yaw, settings.m_pitch);
    }

    // Write key bindings to keys.cfg
    let keys_path = dir.join("keys.cfg");
    let keys_content = render_keys_cfg(&settings);
    fs::write(&keys_path, keys_content)
        .map_err(|e| format!("写入 keys.cfg 失败: {}", e))?;

    Ok(())
}

fn render_settings(s: &Settings) -> String {
    let spin_yaw = if s.sensitivity > 0.0 && s.m_yaw > 0.0 {
        180.0 / (s.sensitivity * s.m_yaw)
    } else {
        0.0
    };

    format!(
        "// ============================================================\n\
         // user/settings.cfg — generated by the UI, do not edit manually\n\
         // ============================================================\n\
         \n\
         // --- Counter-strafe ---\n\
         {jiting}\n\
         {jiting_mode}\n\
         \n\
         // --- Features ---\n\
         {bhop}\n\
         {jumpbug}\n\
         {jump_throw}\n\
         {fwd_jump_throw}\n\
         \n\
         // --- Sensitivity ---\n\
         alias usr_sensitivity        \"sensitivity {sensitivity}\"\n\
         alias usr_m_yaw              \"m_yaw {m_yaw}\"\n\
         alias usr_m_pitch            \"m_pitch {m_pitch}\"\n\
         alias usr_sensitivity_y      \"sensitivity_y_scale 1\"\n\
         alias usr_spin_yaw           \"yaw {spin_yaw} 1 1\"   // 180° = 180 / (sens * m_yaw)\n\
         \n\
         // Apply sensitivity\n\
         usr_sensitivity\n\
         usr_m_yaw\n\
         usr_m_pitch\n\
         usr_sensitivity_y\n\
         \n\
         // --- HUD color feedback ---\n\
         alias hud_jiting_on  \"cl_hud_color 1\"\n\
         alias hud_jiting_off \"cl_hud_color 4\"\n",
        jiting = if s.jiting { "open_jiting" } else { "close_jiting" },
        jiting_mode = s.jiting_mode,
        bhop = if s.bhop { "open_bhop" } else { "close_bhop" },
        jumpbug = if s.jumpbug { "open_jumpbug" } else { "close_jumpbug" },
        jump_throw = if s.jump_throw { "open_jump_throw" } else { "close_jump_throw" },
        fwd_jump_throw = if s.fwd_jump_throw {
            "open_fwd_jump_throw"
        } else {
            "close_fwd_jump_throw"
        },
        sensitivity = s.sensitivity,
        m_yaw = s.m_yaw,
        m_pitch = s.m_pitch,
        spin_yaw = spin_yaw,
    )
}

// ─── Keys CFG ─────────────────────────────────────────────────────────────────

/// Extract the 3 configurable key bindings from keys.cfg.
/// Returns (toggle_jiting_key, jump_throw_key, fwd_jump_throw_key).
fn parse_keys_cfg(content: &str) -> (String, String, String) {
    let mut toggle_jiting_key = String::new();
    let mut jump_throw_key = String::new();
    let mut fwd_jump_throw_key = String::new();

    for line in content.lines() {
        // Strip comments
        let trimmed = line.trim();
        let trimmed = if let Some(idx) = trimmed.find("//") { trimmed[..idx].trim() } else { trimmed };
        if trimmed.is_empty() { continue; }

        // Format: bind <key> "<command>"   (key is unquoted, command is quoted)
        let lower = trimmed.to_lowercase();
        if !lower.starts_with("bind ") { continue; }
        let rest = trimmed["bind ".len()..].trim();
        let (key, cmd_part) = match rest.split_once(|c: char| c.is_whitespace()) {
            Some(pair) => pair,
            None => continue,
        };
        let cmd_part = cmd_part.trim();
        let cmd = if cmd_part.starts_with('"') && cmd_part.ends_with('"') && cmd_part.len() >= 2 {
            &cmd_part[1..cmd_part.len() - 1]
        } else {
            cmd_part
        };

        match cmd {
            "toggle_jiting"      => toggle_jiting_key = key.to_lowercase(),
            "+if_jump_throw"     => jump_throw_key = key.to_lowercase(),
            "+if_fwd_jump_throw" => fwd_jump_throw_key = key.to_lowercase(),
            _ => {}
        }
    }

    (toggle_jiting_key, jump_throw_key, fwd_jump_throw_key)
}

fn render_keys_cfg(s: &Settings) -> String {
    format!(
        "// ============================================================\n\
         // user/keys.cfg — key bindings, generated by the UI\n\
         // ============================================================\n\
         \n\
         // --- Movement ---\n\
         bind w \"+fwd_key\"\n\
         bind s \"+back_key\"\n\
         bind a \"+left_key\"\n\
         bind d \"+right_key\"\n\
         bind space \"+if_jump\"\n\
         bind shift \"+sprint\"\n\
         bind ctrl  \"+duck\"\n\
         \n\
         // --- Weapon slots (with detection) ---\n\
         bind 1 \"slot1;on_slot_1\"\n\
         bind 2 \"slot2;on_slot_2\"\n\
         bind 3 \"slot3;on_slot_3\"\n\
         bind 4 \"slot4;on_slot_4\"\n\
         bind 5 \"slot5;on_slot_5\"\n\
         bind e \"+use;on_slot_any\"\n\
         bind g \"drop;on_slot_any\"\n\
         bind q \"lastinv;on_slot_any\"\n\
         \n\
         // --- Combat ---\n\
         bind mouse1 \"+attack\"\n\
         bind mouse2 \"+attack2\"\n\
         \n\
         // --- Utility ---\n\
         bind {toggle_jiting_key} \"toggle_jiting\"\n\
         bind {jump_throw_key} \"+if_jump_throw\"\n\
         bind {fwd_jump_throw_key} \"+if_fwd_jump_throw\"\n",
        toggle_jiting_key = s.toggle_jiting_key,
        jump_throw_key = s.jump_throw_key,
        fwd_jump_throw_key = s.fwd_jump_throw_key,
    )
}

// ─── VCFG (CS2 cloud-synced user config) ──────────────────────────────────────

const VCFG_CONVARS: &str = "cs2_user_convars_0_slot0.vcfg";

/// Read sensitivity/m_yaw/m_pitch from CS2's cloud-synced convar file.
fn read_vcfg_sensitivity(userdata_cfg: &str) -> (Option<f32>, Option<f32>, Option<f32>) {
    let path = PathBuf::from(userdata_cfg).join(VCFG_CONVARS);
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return (None, None, None),
    };

    let mut sensitivity = None;
    let mut m_yaw = None;
    let mut m_pitch = None;

    for line in content.lines() {
        let parts = vdf_strings(line.trim());
        if parts.len() == 2 {
            match parts[0].as_str() {
                "sensitivity" => sensitivity = parts[1].parse::<f32>().ok(),
                "m_yaw"       => m_yaw       = parts[1].parse::<f32>().ok(),
                "m_pitch"     => m_pitch      = parts[1].parse::<f32>().ok(),
                _ => {}
            }
        }
    }

    (sensitivity, m_yaw, m_pitch)
}

/// Write sensitivity/m_yaw/m_pitch to CS2's cloud-synced convar file in-place.
fn write_vcfg_sensitivity(userdata_cfg: &str, sensitivity: f32, m_yaw: f32, m_pitch: f32) -> Result<(), String> {
    let path = PathBuf::from(userdata_cfg).join(VCFG_CONVARS);
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取 vcfg 失败: {}", e))?;

    let updates: &[(&str, String)] = &[
        ("sensitivity", format!("{:.6}", sensitivity)),
        ("m_yaw",       format!("{:.6}", m_yaw)),
        ("m_pitch",     format!("{:.6}", m_pitch)),
    ];
    let new_content = patch_vcfg_values(&content, updates);

    fs::write(&path, new_content)
        .map_err(|e| format!("写入 vcfg 失败: {}", e))?;

    Ok(())
}

/// Replace quoted values in-place for the given keys, preserving all other content.
fn patch_vcfg_values(content: &str, updates: &[(&str, String)]) -> String {
    let mut lines_out: Vec<String> = Vec::with_capacity(content.lines().count());

    for line in content.lines() {
        let trimmed = line.trim();
        let parts = vdf_strings(trimmed);

        if parts.len() == 2 {
            if let Some((_, new_val)) = updates.iter().find(|(k, _)| *k == parts[0].as_str()) {
                let indent_len = line.len() - line.trim_start().len();
                let indent = &line[..indent_len];
                lines_out.push(format!("{}\"{}\"\t\t\"{}\"", indent, parts[0], new_val));
                continue;
            }
        }

        lines_out.push(line.to_string());
    }

    let mut result = lines_out.join("\n");
    if content.ends_with('\n') {
        result.push('\n');
    }
    result
}

/// Escape a string value for embedding inside VDF double-quotes.
/// VDF uses \" for literal quotes and \\ for literal backslashes.
fn vdf_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

// ─── VDF helpers ──────────────────────────────────────────────────────────────

/// Extract up to 2 quoted strings from a VDF line
fn vdf_strings(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut in_str = false;
    let mut cur = String::new();
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        if in_str {
            match c {
                '\\' => match chars.next() {
                    Some('"') => cur.push('"'),
                    Some('\\') => cur.push('\\'),
                    Some('n') => cur.push('\n'),
                    Some('t') => cur.push('\t'),
                    Some(x) => {
                        cur.push('\\');
                        cur.push(x);
                    }
                    None => {}
                },
                '"' => {
                    result.push(cur.clone());
                    cur.clear();
                    in_str = false;
                    if result.len() == 2 {
                        break;
                    }
                }
                c => cur.push(c),
            }
        } else {
            match c {
                '"' => in_str = true,
                '/' if chars.peek() == Some(&'/') => break,
                _ => {}
            }
        }
    }

    result
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

fn to_base64(bytes: &[u8]) -> String {
    const T: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            T[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            T[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}
