export type Locale = "zh" | "en";

const zh = {
  // Header / tabs
  tab_install: "安装",
  tab_configure: "配置",
  lang_toggle: "EN",

  // Install — paths
  game_cfg_title: "游戏 CFG 路径",
  detecting: "正在检测 Steam...",
  status_installed: "已安装",
  status_not_installed: "未安装",
  install_shared_hint: "CFG 文件安装到共享目录，所有 Steam 账号通用",

  // Install — buttons
  install_btn: "安装",
  reinstall_btn: "重新安装",
  installing_btn: "安装中...",
  install_ok: "安装成功",

  // Launch option
  launch_option_title: "Steam 启动项",
  launch_option_desc: "CS2 → 属性 → 常规 → 启动选项",
  launch_status_ok: "✓ 已写入",
  launch_status_missing: "未设置",
  launch_status_different: "已有其他启动项",
  write_btn: "写入启动项",
  writing_btn: "写入中...",
  rewrite_btn: "重新写入",
  write_ok: "写入成功，重启 Steam 后生效",
  write_ok_no_restart: "写入成功",
  write_need_restart: "Steam 正在运行，需重启后生效",
  write_fail: "写入失败",
  copy_btn: "复制",
  copied_btn: "已复制",

  // Setup steps
  steps_title: "安装步骤",
  step_1: "点击「安装」",
  step_2: "点击「写入启动项」（或手动粘贴到 CS2 启动选项）",
  step_3: "前往「配置」标签页开启功能",
  step_4: "重启 Steam → 启动 CS2",

  // User switcher
  accounts_title: "Steam 账号",
  account_launch_set: "启动项已设置",
  account_launch_missing: "未设置启动项",
  no_userdata: "无 userdata",

  // Configure — counter-strafe
  counter_strafe_title: "急停",
  cs_enable: "启用",
  cs_mode: "档位",
  m1: "幅度极小，低帧推荐",
  m1_5: "幅度小",
  m2: "幅度中等",
  m3: "幅度中等（默认）",
  m4: "幅度大，无 SOCD 变频",
  m5: "幅度大，高帧推荐",
  m6: "幅度最大，无 SOCD 变频，高帧推荐",

  // Configure — features
  features_title: "功能",
  bhop: "连跳",
  bhop_desc: "按住空格自动连跳",
  jumpbug: "大跳",
  jumpbug_desc: "JumpBug 技巧",
  jump_throw: "跳投",
  jump_throw_desc: "跳投手雷（绑定到独立按键）",
  fwd_jump_throw: "前跳投",
  fwd_jump_throw_desc: "前跳投手雷",

  // Configure — key bindings
  key_toggle_jiting: "开关键",

  // Configure — sensitivity
  sens_title: "灵敏度",

  // Configure — apply
  apply_btn: "应用",
  saving_btn: "保存中...",
  saved_ok: "已保存",
  loading: "加载中...",

  // Cloud sync notice
  cloud_sync_notice: "注意：nullify 会修改 WASD 键位绑定。如果你在多台电脑上使用同一 Steam 账号，未安装 nullify 的设备上 W/A/S/D 可能会失效。建议在其他设备上进入 CS2 后执行 exec autoexec 重置键位。",
} as const;

const en = {
  tab_install: "Install",
  tab_configure: "Configure",
  lang_toggle: "中",

  game_cfg_title: "Game CFG Directory",
  detecting: "Detecting Steam...",
  status_installed: "Installed",
  status_not_installed: "Not installed",
  install_shared_hint: "CFG files go to the shared game directory — works for all Steam accounts",

  install_btn: "Install",
  reinstall_btn: "Reinstall",
  installing_btn: "Installing...",
  install_ok: "Installed successfully",

  launch_option_title: "Steam Launch Option",
  launch_option_desc: "CS2 → Properties → General → Launch Options",
  launch_status_ok: "✓ Set",
  launch_status_missing: "Not set",
  launch_status_different: "Different value set",
  write_btn: "Write",
  writing_btn: "Writing...",
  rewrite_btn: "Rewrite",
  write_ok: "Written. Restart Steam to apply.",
  write_ok_no_restart: "Written successfully",
  write_need_restart: "Steam is running — restart to apply",
  write_fail: "Write failed",
  copy_btn: "Copy",
  copied_btn: "Copied",

  steps_title: "Setup Steps",
  step_1: "Click Install",
  step_2: "Click Write or paste the launch option manually into CS2",
  step_3: "Go to Configure tab to enable features",
  step_4: "Restart Steam → launch CS2",

  accounts_title: "Steam Accounts",
  account_launch_set: "Launch option set",
  account_launch_missing: "Not set",
  no_userdata: "No userdata",

  counter_strafe_title: "Counter-strafe",
  cs_enable: "Enable",
  cs_mode: "Mode",
  m1: "Minimal strafe — low FPS",
  m1_5: "Small strafe",
  m2: "Medium strafe",
  m3: "Medium strafe (default)",
  m4: "Strong strafe, no SOCD stagger",
  m5: "Strong strafe — high FPS",
  m6: "Maximum strafe, no SOCD stagger — high FPS",

  features_title: "Features",
  bhop: "Bhop",
  bhop_desc: "Hold Space to bunny-hop",
  jumpbug: "Jumpbug",
  jumpbug_desc: "JumpBug technique",
  jump_throw: "Jump Throw",
  jump_throw_desc: "Throw grenade at jump apex",
  fwd_jump_throw: "Forward Jump Throw",
  fwd_jump_throw_desc: "Jump throw while moving forward",

  key_toggle_jiting: "Toggle Key",

  sens_title: "Sensitivity",

  apply_btn: "Apply",
  saving_btn: "Saving...",
  saved_ok: "Saved",
  loading: "Loading...",

  // Cloud sync notice
  cloud_sync_notice: "Note: nullify remaps WASD keys. On other PCs sharing this Steam account, W/A/S/D may stop working until you run exec autoexec inside CS2.",
} as const;

type TranslationMap = { [K in TKey]: string };
export const translations: Record<Locale, TranslationMap> = { zh, en };

export type TKey = keyof typeof zh;

export function makeT(locale: Locale) {
  return function t(key: TKey): string {
    return translations[locale][key];
  };
}
