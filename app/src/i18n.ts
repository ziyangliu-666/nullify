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
  uninstall_btn: "卸载",
  installing_btn: "安装中...",
  uninstalling_btn: "卸载中...",
  install_ok: "安装成功",
  uninstall_ok: "卸载成功",

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
  write_need_restart: "Steam 正在运行，重启 Steam 后生效",
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

  // Configure — features
  features_title: "功能",
  bhop: "连跳",
  bhop_desc: "按下自动连跳",
  jumpbug: "大跳",
  jumpbug_desc: "按下自动蹲+跳",
  jump_throw: "跳投",
  jump_throw_desc: "按下自动跳投",
  fwd_jump_throw: "前跳投",
  fwd_jump_throw_desc: "按下自动前进+跳投",

  // Configure — apply
  apply_btn: "应用",
  saving_btn: "保存中...",
  saved_ok: "已保存",
  loading: "加载中...",

  // Cloud sync notice
  cloud_sync_notice: "注意：nullify 会同步自定义键位和功能配置到同一 Steam 账号下的其他设备。如果你不希望别的电脑也吃到这套配置，建议关闭云同步。",
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
  uninstall_btn: "Uninstall",
  installing_btn: "Installing...",
  uninstalling_btn: "Uninstalling...",
  install_ok: "Installed successfully",
  uninstall_ok: "Uninstalled successfully",

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
  write_need_restart: "Steam is running — restart Steam to apply",
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

  features_title: "Features",
  bhop: "Bhop",
  bhop_desc: "Press to auto bunny-hop",
  jumpbug: "Jumpbug",
  jumpbug_desc: "Press to auto crouch + jump",
  jump_throw: "Jump Throw",
  jump_throw_desc: "Press to auto jump-throw",
  fwd_jump_throw: "Forward Jump Throw",
  fwd_jump_throw_desc: "Press to auto forward + jump-throw",

  apply_btn: "Apply",
  saving_btn: "Saving...",
  saved_ok: "Saved",
  loading: "Loading...",

  // Cloud sync notice
  cloud_sync_notice: "Note: nullify syncs custom binds and feature settings to other PCs on the same Steam account. If you do not want that, turn Steam Cloud off.",
} as const;

type TranslationMap = { [K in TKey]: string };
export const translations: Record<Locale, TranslationMap> = { zh, en };

export type TKey = keyof typeof zh;

export function makeT(locale: Locale) {
  return function t(key: TKey): string {
    return translations[locale][key];
  };
}
