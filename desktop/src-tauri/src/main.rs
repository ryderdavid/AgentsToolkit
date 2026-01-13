// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod command_registry;
mod deployment;
mod fs_manager;
mod ipc;
mod out_reference_manager;
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
            update_pack_out_references,
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
            // Command registry commands
            list_available_commands,
            get_command_by_id,
            get_commands_for_agent,
            get_commands_by_category,
            load_command_content,
            update_command_out_references,
            validate_command_for_agent,
            calculate_command_budget,
            refresh_commands,
            // Out-reference commands
            list_out_references,
            get_out_reference,
            create_out_reference,
            update_out_reference,
            update_out_reference_metadata,
            delete_out_reference,
            read_out_reference_content,
            write_out_reference_content,
            validate_out_references,
            find_references_to,
            export_out_references,
            import_out_references,
            get_out_reference_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
