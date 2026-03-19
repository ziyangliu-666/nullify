mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::detect_users,
            commands::install_cfg,
            commands::uninstall_cfg,
            commands::install_status,
            commands::get_launch_options,
            commands::set_launch_options,
            commands::nullify_launch_option,
            commands::steam_running_status,
            commands::restart_steam,
            commands::read_settings,
            commands::write_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
