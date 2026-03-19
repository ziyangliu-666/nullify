use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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
    pub bhop: bool,
    pub bhop_key: String,
    pub jumpbug: bool,
    pub jump_throw: bool,
    pub fwd_jump_throw: bool,
    pub jump_throw_key: String,
    pub fwd_jump_throw_key: String,
    pub jumpbug_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            bhop: false,
            bhop_key: String::new(),
            jumpbug: false,
            jump_throw: false,
            fwd_jump_throw: false,
            jump_throw_key: String::new(),
            fwd_jump_throw_key: String::new(),
            jumpbug_key: String::new(),
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

#[tauri::command]
pub fn uninstall_cfg(game_cfg_dir: String, userdata_cfg: Option<String>) -> Result<(), String> {
    let dest = PathBuf::from(&game_cfg_dir).join("nullify");

    if let Some(ref userdata_cfg) = userdata_cfg {
        let keys_path = dest.join("user/keys.cfg");
        let prev_bindings = fs::read_to_string(&keys_path)
            .ok()
            .map(|content| parse_feature_bindings(&content))
            .unwrap_or_default();

        if !prev_bindings.is_empty() {
            restore_vcfg_bindings(&game_cfg_dir, userdata_cfg, &prev_bindings)?;
        }
    }

    if dest.exists() {
        fs::remove_dir_all(&dest).map_err(|e| format!("卸载失败: {}", e))?;
    }

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

fn keybind_backup_path(cfg_dir: &str) -> PathBuf {
    PathBuf::from(cfg_dir).join("nullify/user/keybind_backup.json")
}

fn load_keybind_backup(cfg_dir: &str) -> Result<KeyBindBackup, String> {
    let path = keybind_backup_path(cfg_dir);
    if !path.exists() {
        return Ok(KeyBindBackup::default());
    }

    let json = fs::read_to_string(&path).map_err(|e| format!("读取键位备份失败: {}", e))?;
    serde_json::from_str(&json).map_err(|e| format!("解析键位备份失败: {}", e))
}

fn save_keybind_backup(cfg_dir: &str, backup: &KeyBindBackup) -> Result<(), String> {
    let path = keybind_backup_path(cfg_dir);
    if backup.original_binds.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("删除键位备份失败: {}", e))?;
        }
        return Ok(());
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建键位备份目录失败: {}", e))?;
    }

    let json = serde_json::to_string_pretty(backup)
        .map_err(|e| format!("序列化键位备份失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("写入键位备份失败: {}", e))
}

fn collect_vcfg_paths(userdata_cfg: &str) -> Result<Vec<PathBuf>, String> {
    let dir = PathBuf::from(userdata_cfg);
    let mut files = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("读取 userdata cfg 目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取 userdata cfg 目录失败: {}", e))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = entry.file_name();
        let name = name.to_string_lossy();
        let is_key_vcfg = name.starts_with("cs2_user_keys_")
            && name.contains("_slot")
            && (name.ends_with(".vcfg") || name.ends_with(".vcfg_lastclouded"));
        if is_key_vcfg {
            files.push(path);
        }
    }

    files.sort();
    Ok(files)
}

fn cs2_key_to_vcfg(key: &str) -> String {
    let key = key.trim().to_lowercase();
    match key.as_str() {
        "space" => "SPACE".into(),
        "tab" => "TAB".into(),
        "enter" => "ENTER".into(),
        "backspace" => "BACKSPACE".into(),
        "delete" => "DEL".into(),
        "escape" => "ESCAPE".into(),
        "shift" => "SHIFT".into(),
        "ctrl" => "CTRL".into(),
        "alt" => "ALT".into(),
        "uparrow" => "UPARROW".into(),
        "downarrow" => "DOWNARROW".into(),
        "leftarrow" => "LEFTARROW".into(),
        "rightarrow" => "RIGHTARROW".into(),
        "mouse1" => "MOUSE1".into(),
        "mouse2" => "MOUSE2".into(),
        "mouse3" => "MOUSE3".into(),
        "mouse4" => "MOUSE4".into(),
        "mouse5" => "MOUSE5".into(),
        "mwheelup" => "MWHEELUP".into(),
        "mwheeldown" => "MWHEELDOWN".into(),
        _ if key.len() == 1 => key,
        _ => key.to_ascii_uppercase(),
    }
}

fn parse_vcfg_bindings(content: &str) -> BTreeMap<String, String> {
    let mut bindings = BTreeMap::new();
    let mut depth: i32 = 0;
    let mut in_bindings = false;
    let mut expect_bindings_block = false;
    let mut bindings_depth = 0i32;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "{" {
            depth += 1;
            if expect_bindings_block {
                in_bindings = true;
                bindings_depth = depth;
                expect_bindings_block = false;
            }
            continue;
        }

        if trimmed == "}" {
            if in_bindings && depth <= bindings_depth {
                in_bindings = false;
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

        if !in_bindings {
            if parts.len() == 1 && parts[0] == "bindings" {
                expect_bindings_block = true;
            }
        } else if depth == bindings_depth && parts.len() == 2 {
            bindings.insert(parts[0].clone(), parts[1].clone());
        }
    }

    bindings
}

fn has_vcfg_bindings_block(content: &str) -> bool {
    let mut depth: i32 = 0;
    let mut in_bindings = false;
    let mut expect_bindings_block = false;
    let mut bindings_depth = 0i32;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "{" {
            depth += 1;
            if expect_bindings_block {
                in_bindings = true;
                bindings_depth = depth;
                expect_bindings_block = false;
            }
            continue;
        }

        if trimmed == "}" {
            if in_bindings && depth <= bindings_depth {
                return true;
            }
            depth -= 1;
            continue;
        }

        if trimmed.is_empty() {
            continue;
        }

        let parts = vdf_strings(trimmed);
        if !in_bindings && parts.len() == 1 && parts[0] == "bindings" {
            expect_bindings_block = true;
        }
    }

    false
}

fn modify_vcfg_binding(content: &str, key: &str, value: Option<&str>) -> Result<String, String> {
    #[derive(Clone)]
    enum State {
        Scanning,
        BindingsNext,
        InBindings(i32),
    }

    let mut state = State::Scanning;
    let mut depth: i32 = 0;
    let mut found = false;
    let mut seen_bindings = false;
    let mut out = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let mut skip_line = false;
        let mut replaced_line = None::<String>;

        if trimmed == "{" {
            depth += 1;
            if matches!(state, State::BindingsNext) {
                state = State::InBindings(depth);
                seen_bindings = true;
            }
        } else if trimmed == "}" {
            if let State::InBindings(bindings_depth) = state.clone() {
                if depth <= bindings_depth {
                    if !found {
                        if let Some(value) = value {
                            let indent_len = line.len() - line.trim_start().len();
                            let indent = &line[..indent_len];
                            out.push(format!(
                                "{}\t\"{}\"\t\t\"{}\"",
                                indent,
                                vdf_escape(key),
                                vdf_escape(value)
                            ));
                        }
                    }
                    state = State::Scanning;
                }
            }
            depth -= 1;
        } else if !trimmed.is_empty() {
            let parts = vdf_strings(trimmed);
            if !parts.is_empty() {
                state = match state.clone() {
                    State::Scanning => {
                        if parts.len() == 1 && parts[0] == "bindings" {
                            State::BindingsNext
                        } else {
                            State::Scanning
                        }
                    }
                    State::BindingsNext => State::Scanning,
                    State::InBindings(bindings_depth) => {
                        if depth == bindings_depth
                            && parts.len() == 2
                            && parts[0].eq_ignore_ascii_case(key)
                        {
                            found = true;
                            if let Some(value) = value {
                                let indent_len = line.len() - line.trim_start().len();
                                let indent = &line[..indent_len];
                                replaced_line = Some(format!(
                                    "{}\"{}\"\t\t\"{}\"",
                                    indent,
                                    vdf_escape(&parts[0]),
                                    vdf_escape(value)
                                ));
                            } else {
                                skip_line = true;
                            }
                        }
                        State::InBindings(bindings_depth)
                    }
                };
            }
        }

        if let Some(line) = replaced_line {
            out.push(line);
        } else if !skip_line {
            out.push(line.to_string());
        }
    }

    if !seen_bindings {
        return Err("vcfg 中未找到 bindings 块".into());
    }

    let mut result = out.join("\n");
    if content.ends_with('\n') {
        result.push('\n');
    }
    Ok(result)
}

fn sync_vcfg_bindings(
    cfg_dir: &str,
    userdata_cfg: &str,
    prev_bindings: &BTreeMap<String, String>,
    next_bindings: &BTreeMap<String, String>,
) -> Result<(), String> {
    let files = collect_vcfg_paths(userdata_cfg)?;
    if files.is_empty() {
        return Ok(());
    }

    let mut backup = load_keybind_backup(cfg_dir)?;
    let primary_content = fs::read_to_string(&files[0])
        .map_err(|e| format!("读取 vcfg 失败: {}", e))?;
    let primary_bindings = parse_vcfg_bindings(&primary_content);

    for key in next_bindings.keys() {
        if !prev_bindings.contains_key(key) {
            let vcfg_key = cs2_key_to_vcfg(key);
            let original = primary_bindings.get(&vcfg_key).cloned();
            backup.original_binds.insert(key.clone(), original);
        }
    }

    let released_keys: Vec<String> = prev_bindings
        .keys()
        .filter(|key| !next_bindings.contains_key(*key))
        .cloned()
        .collect();

    for path in &files {
        let mut content = fs::read_to_string(path)
            .map_err(|e| format!("读取 vcfg 失败: {}", e))?;

        if !has_vcfg_bindings_block(&content) {
            continue;
        }

        for key in &released_keys {
            let restore_value = backup
                .original_binds
                .get(key)
                .and_then(|value| value.as_deref());
            content = modify_vcfg_binding(&content, &cs2_key_to_vcfg(key), restore_value)?;
        }

        for (key, command) in next_bindings {
            content = modify_vcfg_binding(&content, &cs2_key_to_vcfg(key), Some(command.as_str()))?;
        }

        fs::write(path, content).map_err(|e| format!("写入 vcfg 失败: {}", e))?;
    }

    for key in released_keys {
        backup.original_binds.remove(&key);
    }

    save_keybind_backup(cfg_dir, &backup)
}

fn restore_vcfg_bindings(
    cfg_dir: &str,
    userdata_cfg: &str,
    prev_bindings: &BTreeMap<String, String>,
) -> Result<(), String> {
    let files = collect_vcfg_paths(userdata_cfg)?;
    if files.is_empty() {
        return Ok(());
    }

    let mut backup = load_keybind_backup(cfg_dir)?;

    for path in &files {
        let mut content = fs::read_to_string(path)
            .map_err(|e| format!("读取 vcfg 失败: {}", e))?;

        if !has_vcfg_bindings_block(&content) {
            continue;
        }

        for key in prev_bindings.keys() {
            let restore_value = backup
                .original_binds
                .get(key)
                .and_then(|value| value.as_deref());
            content = modify_vcfg_binding(&content, &cs2_key_to_vcfg(key), restore_value)?;
        }

        fs::write(path, content).map_err(|e| format!("写入 vcfg 失败: {}", e))?;
    }

    for key in prev_bindings.keys() {
        backup.original_binds.remove(key);
    }

    save_keybind_backup(cfg_dir, &backup)
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
pub fn set_launch_options(localconfig_path: String, value: String) -> Result<(), String> {
    let content = fs::read_to_string(&localconfig_path)
        .map_err(|e| format!("无法读取 localconfig.vdf: {}", e))?;

    let new_content = modify_launch_options(&content, &value)
        .map_err(|e| format!("写入启动项失败: {}", e))?;

    fs::write(&localconfig_path, new_content)
        .map_err(|e| format!("无法写入 localconfig.vdf: {}", e))?;

    Ok(())
}

/// Returns the default nullify launch option string
#[tauri::command]
pub fn nullify_launch_option() -> String {
    LAUNCH_OPTION_VALUE.to_string()
}

#[tauri::command]
pub fn open_external_link(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("仅支持 http/https 链接".into());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("打开浏览器失败: {}", e))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("当前平台不支持打开外链".into())
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
                String::from_utf8_lossy(&o.stdout)
                    .to_ascii_lowercase()
                    .contains("steam.exe")
            })
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct KeyBindBackup {
    original_binds: BTreeMap<String, Option<String>>,
}

#[tauri::command]
pub fn restart_steam() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::thread;
        use std::time::Duration;

        let steam_path = find_steam_path()?;
        let steam_exe = PathBuf::from(&steam_path).join("Steam.exe");
        if !steam_exe.exists() {
            return Err(format!("未找到 Steam.exe：{}", steam_exe.display()));
        }

        if is_steam_running() {
            Command::new("taskkill")
                .args(["/IM", "Steam.exe", "/F"])
                .status()
                .map_err(|e| format!("关闭 Steam 失败: {}", e))?;
            thread::sleep(Duration::from_millis(1500));
        }

        Command::new(&steam_exe)
            .spawn()
            .map_err(|e| format!("启动 Steam 失败: {}", e))?;

        thread::sleep(Duration::from_millis(1500));
        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("仅 Windows 支持一键重启 Steam".into())
    }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn read_settings(cfg_dir: String) -> Result<Settings, String> {
    let path = PathBuf::from(&cfg_dir).join("nullify/user/settings.cfg");

    let mut s = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取 settings.cfg 失败: {}", e))?;
        parse_settings(&content)
    } else {
        Settings::default()
    };

    // Read key bindings from keys.cfg
    let keys_path = PathBuf::from(&cfg_dir).join("nullify/user/keys.cfg");
    if let Ok(keys_content) = fs::read_to_string(&keys_path) {
        let (bk, jk, fjk, jbk) = parse_keys_cfg(&keys_content);
        if !bk.is_empty()  { s.bhop_key = bk; }
        if !jk.is_empty()  { s.jump_throw_key = jk; }
        if !fjk.is_empty() { s.fwd_jump_throw_key = fjk; }
        if !jbk.is_empty() { s.jumpbug_key = jbk; }
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

        match lower.as_str() {
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
    }

    s
}

#[tauri::command]
pub fn write_settings(
    cfg_dir: String,
    userdata_cfg: Option<String>,
    settings: Settings,
) -> Result<(), String> {
    let dir = PathBuf::from(&cfg_dir).join("nullify/user");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    let previous_bindings = fs::read_to_string(dir.join("keys.cfg"))
        .ok()
        .map(|content| parse_feature_bindings(&content))
        .unwrap_or_default();

    let next_bindings = settings_feature_bindings(&settings);

    if let Some(ref userdata_cfg) = userdata_cfg {
        sync_vcfg_bindings(&cfg_dir, userdata_cfg, &previous_bindings, &next_bindings)?;
    }

    let path = dir.join("settings.cfg");
    let content = render_settings(&settings);
    fs::write(&path, content)
        .map_err(|e| format!("写入 settings.cfg 失败: {}", e))?;

    // Write key bindings to keys.cfg
    let keys_path = dir.join("keys.cfg");
    let keys_content = render_keys_cfg(&settings);
    fs::write(&keys_path, keys_content)
        .map_err(|e| format!("写入 keys.cfg 失败: {}", e))?;

    Ok(())
}

fn render_settings(s: &Settings) -> String {
    format!(
        "// ============================================================\n\
         // user/settings.cfg — generated by the UI, do not edit manually\n\
         // ============================================================\n\
         \n\
         // --- Counter-strafe ---\n\
         close_jiting\n\
         \n\
         // --- Features ---\n\
         {bhop}\n\
        {jumpbug}\n\
        {jump_throw}\n\
        {fwd_jump_throw}\n\
         \n",
        // Feature enable semantics: "bound key exists" => enabled; empty key => disabled.
        bhop = if !s.bhop_key.trim().is_empty() { "open_bhop" } else { "close_bhop" },
        jumpbug = if !s.jumpbug_key.trim().is_empty() { "open_jumpbug" } else { "close_jumpbug" },
        jump_throw = if !s.jump_throw_key.trim().is_empty() { "open_jump_throw" } else { "close_jump_throw" },
        fwd_jump_throw = if !s.fwd_jump_throw_key.trim().is_empty() { "open_fwd_jump_throw" } else { "close_fwd_jump_throw" },
    )
}

// ─── Keys CFG ─────────────────────────────────────────────────────────────────

/// Extract the configurable key bindings from keys.cfg.
/// Returns (bhop_key, jump_throw_key, fwd_jump_throw_key, jumpbug_key).
fn parse_keys_cfg(content: &str) -> (String, String, String, String) {
    let mut bhop_key = String::new();
    let mut jump_throw_key = String::new();
    let mut fwd_jump_throw_key = String::new();
    let mut jumpbug_key = String::new();

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
            "+if_jump"           => bhop_key = key.to_lowercase(),
            "+if_jump_throw"     => jump_throw_key = key.to_lowercase(),
            "+if_fwd_jump_throw" => fwd_jump_throw_key = key.to_lowercase(),
            "+if_jumpbug"        => jumpbug_key = key.to_lowercase(),
            _ => {}
        }
    }

    (bhop_key, jump_throw_key, fwd_jump_throw_key, jumpbug_key)
}

fn parse_feature_bindings(content: &str) -> BTreeMap<String, String> {
    let mut bindings = BTreeMap::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let trimmed = if let Some(idx) = trimmed.find("//") {
            trimmed[..idx].trim()
        } else {
            trimmed
        };
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();
        if !lower.starts_with("bind ") {
            continue;
        }
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
            "+if_jump" | "+if_jump_throw" | "+if_fwd_jump_throw" | "+if_jumpbug" => {
                bindings.insert(key.to_lowercase(), cmd.to_string());
            }
            _ => {}
        }
    }

    bindings
}

fn settings_feature_bindings(s: &Settings) -> BTreeMap<String, String> {
    let mut bindings = BTreeMap::new();

    if !s.bhop_key.trim().is_empty() {
        bindings.insert(s.bhop_key.trim().to_lowercase(), "+if_jump".to_string());
    }
    if !s.jump_throw_key.trim().is_empty() {
        bindings.insert(
            s.jump_throw_key.trim().to_lowercase(),
            "+if_jump_throw".to_string(),
        );
    }
    if !s.fwd_jump_throw_key.trim().is_empty() {
        bindings.insert(
            s.fwd_jump_throw_key.trim().to_lowercase(),
            "+if_fwd_jump_throw".to_string(),
        );
    }
    if !s.jumpbug_key.trim().is_empty() {
        bindings.insert(
            s.jumpbug_key.trim().to_lowercase(),
            "+if_jumpbug".to_string(),
        );
    }

    bindings
}

fn render_keys_cfg(s: &Settings) -> String {
    let bhop_bind = if !s.bhop_key.trim().is_empty() {
        format!("bind {} \"+if_jump\"\n", s.bhop_key)
    } else {
        String::new()
    };

    let jump_throw_bind = if !s.jump_throw_key.trim().is_empty() {
        format!("bind {} \"+if_jump_throw\"\n", s.jump_throw_key)
    } else {
        String::new()
    };

    let fwd_jump_throw_bind = if !s.fwd_jump_throw_key.trim().is_empty() {
        format!("bind {} \"+if_fwd_jump_throw\"\n", s.fwd_jump_throw_key)
    } else {
        String::new()
    };

    let jumpbug_bind = if !s.jumpbug_key.trim().is_empty() {
        format!("bind {} \"+if_jumpbug\"\n", s.jumpbug_key)
    } else {
        String::new()
    };

    format!(
        "// ============================================================\n\
         // user/keys.cfg — key bindings, generated by the UI\n\
         // ============================================================\n\
         \n\
         // --- Utility ---\n\
         {bhop_bind}\
         {jump_throw_bind}\
         {fwd_jump_throw_bind}\
         {jumpbug_bind}",
        bhop_bind = bhop_bind,
        jump_throw_bind = jump_throw_bind,
        fwd_jump_throw_bind = fwd_jump_throw_bind,
        jumpbug_bind = jumpbug_bind,
    )
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
