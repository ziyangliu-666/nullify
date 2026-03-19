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

  // Install flow
  step_install_cfg_title: "先安装 CFG",
  step_install_cfg_desc: "先把 nullify 的 CFG 文件写到游戏目录，后面的平台步骤才有意义",
  step_choose_platform_title: "选择你平时玩的平台",
  step_choose_platform_desc: "先选你的常用启动方式，下面只显示对应操作",
  step_choose_platform_wait: "先完成 CFG 安装，再选择平时主要玩的平台",
  platform_choice_official_hint: "平时主要用 Steam 官匹启动 CS2",
  platform_choice_third_party_hint: "平时主要用完美 / 5E 这类第三方平台启动 CS2",
  step_apply_platform_title: "按平台完成启动项",
  step_apply_platform_wait_install: "先安装 CFG，才能继续处理启动项",
  step_apply_platform_wait_choice: "先在上一步选择你平时玩的平台",
  step_apply_platform_official_desc: "官匹只需要把下面这条启动项手动粘贴到 Steam 的 CS2 启动项里",
  step_apply_platform_third_party_desc: "第三方平台请先手动清空 Steam 启动项，再把启动项复制到平台自己的启动项里",
  launch_option_reference_title: "启动项参考",
  official_action_hint: "复制下面这条启动项，手动粘贴到 Steam 的 CS2 启动项里",
  official_example_title: "Steam 启动项示意图",
  official_example_alt: "Steam 启动项位置示意图",
  third_party_action_hint: "先按下图在 Steam 里手动清空启动项，再去平台里粘贴下面这条启动项",
  third_party_copy_title: "复制到第三方平台的启动项",
  third_party_example_title: "第三方平台启动项示意图",
  third_party_example_alt: "第三方平台启动项位置示意图",
  third_party_clear_example_alt: "手动清空 Steam 启动项示意图",
  official_manual_desc: "未找到 userdata，无法自动写入 Steam 启动项。请手动把下面这条粘贴到 Steam 的 CS2 启动项里。",
  third_party_manual_desc: "未找到 userdata，无法自动清空 Steam 启动项。请先手动清空 Steam，再把下面这条复制到第三方平台启动项里。",
  step_configure_title: "最后配置功能",
  step_configure_desc: "启动流程处理完以后，再去配置页设置连跳、跳投、大跳这些功能键位",
  step_configure_wait_install: "先完成 CFG 安装，再进入功能配置",
  step_configure_wait_platform: "先选好平台并按对应方式处理启动项，再进入功能配置",
  open_configure_btn: "去配置功能",
  configure_step_hint: "配置页会自动保存功能开关和键位",
  step_close_title: "关闭安装器",
  close_installer_btn: "关闭安装器",
  close_step_hint: "全部设置完成后，可以直接关闭这个窗口",

  // Launch option
  launch_option_title: "启动项",
  launch_option_desc: "同一条启动项，官匹和第三方平台的放置位置不同",
  official_launch_title: "官匹 / Steam",
  official_launch_desc: "官匹时，请把这条启动项手动粘贴到 Steam 的 CS2 启动项里",
  third_party_launch_title: "完美 / 5E",
  third_party_launch_desc: "第三方平台时，必须先把 Steam 启动项清空，再把这条启动项复制到平台自己的启动项里",
  third_party_launch_warning: "第三方平台必须清空 Steam 启动项，否则会直接报错",
  steam_launch_status_title: "Steam 启动项状态",
  launch_status_ok: "✓ 已写入",
  launch_status_missing: "未设置",
  launch_status_different: "已有其他启动项",
  write_btn: "写入启动项",
  writing_btn: "写入中...",
  rewrite_btn: "重新写入",
  clear_steam_btn: "清空 Steam 启动项",
  clearing_steam_btn: "清空中...",
  clear_steam_ok: "Steam 启动项已清空",
  write_ok: "写入成功，重启 Steam 后生效",
  write_ok_no_restart: "写入成功",
  write_need_restart: "Steam 正在运行，重启 Steam 后生效",
  write_fail: "写入失败",
  copy_btn: "复制",
  copied_btn: "已复制",

  // Setup steps
  steps_title: "安装步骤",
  step_1: "点击「安装」",
  step_2: "官匹：写入 Steam 启动项；完美 / 5E：先手动清空 Steam，再复制到平台启动项",
  step_3: "前往「配置」标签页开启功能",
  step_4: "按对应平台方式启动 CS2",

  // User switcher
  accounts_title: "Steam 账号",
  account_launch_set: "Steam 启动项已设置",
  account_launch_missing: "Steam 启动项未设置",
  no_userdata: "无 userdata",

  // Configure — features
  features_title: "功能",
  bhop: "连跳",
  bhop_desc: "按下自动连跳；连跳键按下期间 FPS 锁定 64 帧",
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

  // Credit
  credit_by: "By Rufus（上课上课下课下课）",
  credit_reference: "参考了 恶俗硬汉的 Forever Rise",
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

  step_install_cfg_title: "Install CFG First",
  step_install_cfg_desc: "Install nullify's CFG files into the game directory before handling platform-specific launch steps",
  step_choose_platform_title: "Choose Your Usual Platform",
  step_choose_platform_desc: "Pick how you usually launch CS2 and only the matching instructions will be shown below",
  step_choose_platform_wait: "Finish CFG installation first, then choose your usual platform",
  platform_choice_official_hint: "You usually launch CS2 from Steam for official matchmaking",
  platform_choice_third_party_hint: "You usually launch CS2 from Perfect / 5E or another third-party platform",
  step_apply_platform_title: "Apply the Matching Launch Step",
  step_apply_platform_wait_install: "Install the CFG first before handling launch options",
  step_apply_platform_wait_choice: "Choose your usual platform in the previous step first",
  step_apply_platform_official_desc: "For official matchmaking, manually paste the launch option below into Steam's CS2 launch options",
  step_apply_platform_third_party_desc: "For third-party platforms, clear Steam manually first, then copy the launch option into the platform itself",
  launch_option_reference_title: "Launch Option Reference",
  official_action_hint: "Copy the launch option below and paste it into Steam's CS2 launch options manually",
  official_example_title: "Steam Example",
  official_example_alt: "Example of where to place the launch option in Steam",
  third_party_action_hint: "First clear Steam manually as shown below, then paste the launch option into the platform",
  third_party_copy_title: "Copy into the Third-Party Platform",
  third_party_example_title: "Third-Party Launch Option Example",
  third_party_example_alt: "Example of where to place the launch option in a third-party platform",
  third_party_clear_example_alt: "Example of clearing Steam launch options manually",
  official_manual_desc: "userdata was not found, so Steam launch options cannot be written automatically. Paste the value below into Steam's CS2 launch options manually.",
  third_party_manual_desc: "userdata was not found, so Steam launch options cannot be cleared automatically. Clear Steam manually first, then copy the value below into the third-party platform.",
  step_configure_title: "Configure Features Last",
  step_configure_desc: "Once the launch flow is set, go configure bhop, jump throw, jumpbug, and other keybinds",
  step_configure_wait_install: "Finish CFG installation first before opening feature configuration",
  step_configure_wait_platform: "Choose a platform and finish the matching launch step before opening feature configuration",
  open_configure_btn: "Configure Features",
  configure_step_hint: "Feature switches and keybinds are saved automatically",
  step_close_title: "Close the Installer",
  close_installer_btn: "Close Installer",
  close_step_hint: "Once everything is set up, you can close this window directly",

  launch_option_title: "Launch Option",
  launch_option_desc: "The same launch option goes to different places depending on the platform",
  official_launch_title: "Official / Steam",
  official_launch_desc: "For official matchmaking, manually paste this launch option into Steam's CS2 launch options",
  third_party_launch_title: "Perfect / 5E",
  third_party_launch_desc: "For third-party platforms, you must clear Steam launch options first, then copy this value into the platform's own launch options",
  third_party_launch_warning: "Third-party platforms require Steam launch options to be empty, or they will error out directly",
  steam_launch_status_title: "Steam Launch Status",
  launch_status_ok: "✓ Set",
  launch_status_missing: "Not set",
  launch_status_different: "Different value set",
  write_btn: "Write",
  writing_btn: "Writing...",
  rewrite_btn: "Rewrite",
  clear_steam_btn: "Clear Steam",
  clearing_steam_btn: "Clearing...",
  clear_steam_ok: "Steam launch option cleared",
  write_ok: "Written. Restart Steam to apply.",
  write_ok_no_restart: "Written successfully",
  write_need_restart: "Steam is running — restart Steam to apply",
  write_fail: "Write failed",
  copy_btn: "Copy",
  copied_btn: "Copied",

  steps_title: "Setup Steps",
  step_1: "Click Install",
  step_2: "Official: write to Steam. Perfect / 5E: clear Steam manually first, then paste into the platform launch option",
  step_3: "Go to Configure tab to enable features",
  step_4: "Launch CS2 through the matching platform flow",

  accounts_title: "Steam Accounts",
  account_launch_set: "Steam launch option set",
  account_launch_missing: "Steam launch option not set",
  no_userdata: "No userdata",

  features_title: "Features",
  bhop: "Bhop",
  bhop_desc: "Press to auto bunny-hop; FPS is locked to 64 while the bhop key is held",
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

  // Credit
  credit_by: "By Rufus (上课上课下课下课)",
  credit_reference: "Inspired by 恶俗硬汉's Forever Rise",
} as const;

type TranslationMap = { [K in TKey]: string };
export const translations: Record<Locale, TranslationMap> = { zh, en };

export type TKey = keyof typeof zh;

export function makeT(locale: Locale) {
  return function t(key: TKey): string {
    return translations[locale][key];
  };
}
