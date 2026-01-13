// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod deployment;
mod fs_manager;
mod ipc;
mod symlink;
mod types;

use ipc::*;

fn main() {
    env_logger::init();
    log::info!("Starting AgentsToolkit Desktop");
    
    tauri::Builder::default()
        .setup(|app| {
            log::info!("Tauri app initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_all_agents,
            get_agent_by_id,
            validate_agent,
            list_available_packs,
            load_pack,
            load_pack_full,
            load_pack_file,
            validate_pack,
            resolve_dependencies,
            calculate_budget,
            validate_composition,
            generate_agents_md,
            read_agents_md,
            write_agents_md,
            get_agentsmd_home,
            check_agent_installed,
            create_agent_link,
            remove_agent_link,
            check_symlink_support,
            // Deployment commands
            deploy_to_agent,
            validate_deployment,
            rollback_deployment,
            get_deployment_status,
            get_deployment_history,
            preview_deployment,
            get_deployable_agents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
