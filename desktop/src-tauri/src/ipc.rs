use crate::fs_manager;
use crate::symlink::{self, SymlinkError};
use crate::types::*;
use std::fs;
use std::path::PathBuf;

/// Get all agents from the registry
#[tauri::command]
pub fn get_all_agents() -> Result<Vec<AgentDefinition>, String> {
    fs_manager::load_agent_registry().map_err(|e| format!("Failed to load agents: {}", e))
}

/// Get agent by ID
#[tauri::command]
pub fn get_agent_by_id(id: String) -> Result<Option<AgentDefinition>, String> {
    let agents = fs_manager::load_agent_registry()
        .map_err(|e| format!("Failed to load agents: {}", e))?;
    Ok(agents.into_iter().find(|agent| agent.id == id))
}

/// Validate an agent definition
#[tauri::command]
pub fn validate_agent(agent: AgentDefinition) -> Result<(), String> {
    // Basic validation
    if agent.id.is_empty() {
        return Err("Agent ID cannot be empty".to_string());
    }
    if agent.name.is_empty() {
        return Err("Agent name cannot be empty".to_string());
    }
    if agent.config_paths.is_empty() {
        return Err("Agent must have at least one config path".to_string());
    }
    Ok(())
}

/// List all available rule packs
#[tauri::command]
pub fn list_available_packs() -> Result<Vec<RulePack>, String> {
    let pack_ids = fs_manager::list_rule_packs()
        .map_err(|e| format!("Failed to list packs: {}", e))?;
    
    let mut packs = Vec::new();
    for pack_id in pack_ids {
        match fs_manager::read_pack_json(pack_id.clone()) {
            Ok(json_str) => {
                match serde_json::from_str::<RulePack>(&json_str) {
                    Ok(pack) => packs.push(pack),
                    Err(e) => {
                        log::warn!("Failed to parse pack.json for {}: {}", pack_id, e);
                    }
                }
            }
            Err(e) => {
                log::warn!("Failed to read pack.json for {}: {}", pack_id, e);
            }
        }
    }
    
    Ok(packs)
}

/// Load a pack's metadata
#[tauri::command]
pub fn load_pack(pack_id: String) -> Result<RulePack, String> {
    let json_str = fs_manager::read_pack_json(pack_id.clone())
        .map_err(|e| format!("Failed to load pack {}: {}", pack_id, e))?;
    
    serde_json::from_str::<RulePack>(&json_str)
        .map_err(|e| format!("Failed to parse pack.json: {}", e))
}

/// Load a pack with full content
#[tauri::command]
pub fn load_pack_full(pack_id: String) -> Result<LoadedPack, String> {
    let pack = load_pack(pack_id.clone())?;
    let content = fs_manager::read_pack_content(pack_id.clone())
        .map_err(|e| format!("Failed to load pack content: {}", e))?;
    
    // Calculate word and character counts
    let actual_word_count = content.split_whitespace().count() as u64;
    let actual_character_count = content.len() as u64;
    
    // Get pack directory path
    let pack_path = fs_manager::get_rule_packs_dir().join(&pack_id);
    
    Ok(LoadedPack {
        id: pack.id,
        name: pack.name,
        version: pack.version,
        description: pack.description,
        dependencies: pack.dependencies,
        target_agents: pack.target_agents,
        files: pack.files,
        metadata: pack.metadata,
        path: pack_path.to_string_lossy().to_string(),
        content,
        actual_word_count,
        actual_character_count,
    })
}

/// Validate a pack
#[tauri::command]
pub fn validate_pack(pack_id: String) -> Result<PackValidationResult, String> {
    // Basic validation - check if pack exists and is parseable
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    
    match load_pack(pack_id.clone()) {
        Ok(pack) => {
            // Check files exist
            let pack_dir = fs_manager::get_rule_packs_dir().join(&pack_id);
            
            for file in &pack.files {
                let file_path = pack_dir.join(file);
                if !file_path.exists() {
                    errors.push(PackValidationError {
                        pack_id: pack_id.clone(),
                        message: format!("File not found: {}", file),
                        severity: "error".to_string(),
                        file: Some(file.clone()),
                    });
                }
            }
            
            // Check dependencies exist
            for dep_id in &pack.dependencies {
                if fs_manager::read_pack_json(dep_id.clone()).is_err() {
                    errors.push(PackValidationError {
                        pack_id: pack_id.clone(),
                        message: format!("Dependency not found: {}", dep_id),
                        severity: "error".to_string(),
                        file: None,
                    });
                }
            }
        }
        Err(e) => {
            errors.push(PackValidationError {
                pack_id: pack_id.clone(),
                message: e,
                severity: "error".to_string(),
                file: None,
            });
        }
    }
    
    Ok(PackValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    })
}

/// Resolve dependencies for a pack
#[tauri::command]
pub fn resolve_dependencies(pack_id: String) -> Result<DependencyResolution, String> {
    // Simplified dependency resolution
    // Full implementation would need recursive traversal
    let pack = load_pack(pack_id.clone())?;
    let mut order = Vec::new();
    let mut visited = std::collections::HashSet::new();
    
    fn resolve_recursive(
        id: String,
        visited: &mut std::collections::HashSet<String>,
        order: &mut Vec<String>,
        path: &mut Vec<String>,
    ) -> Result<(), String> {
        if visited.contains(&id) {
            return Err(format!("Circular dependency detected: {}", path.join(" -> ")));
        }
        
        visited.insert(id.clone());
        path.push(id.clone());
        
        // Load pack to get dependencies
        let json_str = fs_manager::read_pack_json(id.clone())
            .map_err(|e| format!("Failed to load pack: {}", e))?;
        let pack: RulePack = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse pack: {}", e))?;
        
        // Resolve dependencies first
        for dep_id in &pack.dependencies {
            if !order.contains(dep_id) {
                resolve_recursive(dep_id.clone(), visited, order, path)?;
            }
        }
        
        // Add this pack
        if !order.contains(&id) {
            order.push(id);
        }
        
        path.pop();
        visited.remove(&id);
        Ok(())
    }
    
    let mut path = Vec::new();
    match resolve_recursive(pack_id, &mut visited, &mut order, &mut path) {
        Ok(_) => Ok(DependencyResolution {
            order,
            success: true,
            error: None,
            circular_path: None,
        }),
        Err(e) => Ok(DependencyResolution {
            order: Vec::new(),
            success: false,
            error: Some(e),
            circular_path: Some(path),
        }),
    }
}

/// Read AGENTS.md content
#[tauri::command]
pub fn read_agents_md() -> Result<String, String> {
    fs_manager::read_agents_md()
        .map_err(|e| format!("Failed to read AGENTS.md: {}", e))
}

/// Write AGENTS.md content
#[tauri::command]
pub fn write_agents_md(content: String) -> Result<(), String> {
    fs_manager::write_agents_md(content)
        .map_err(|e| format!("Failed to write AGENTS.md: {}", e))
}

/// Get ~/.agentsmd/ path
#[tauri::command]
pub fn get_agentsmd_home() -> Result<String, String> {
    Ok(fs_manager::get_agentsmd_home()
        .to_string_lossy()
        .to_string())
}

/// Check if an agent is installed (has config directory)
#[tauri::command]
pub fn check_agent_installed(agent_id: String) -> Result<bool, String> {
    let config_path = fs_manager::get_agent_config_path(agent_id)
        .map_err(|e| format!("Failed to get agent config path: {}", e))?;
    
    Ok(config_path.exists())
}

/// Create agent link (symlink/junction/hardlink/copy)
#[tauri::command]
pub fn create_agent_link(agent_id: String, force: bool) -> Result<(String, Option<String>), String> {
    let agents = fs_manager::load_agent_registry()
        .map_err(|e| format!("Failed to load agents: {}", e))?;
    let agent = agents
        .into_iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    // Resolve the target path (agent config path)
    let link_path = fs_manager::get_agent_config_path(agent.id.clone())
        .map_err(|e| format!("Failed to get agent config path: {}", e))?;

    // Decide whether the agent expects a file or directory target
    let raw_config_path = agent
        .config_paths
        .get(0)
        .cloned()
        .unwrap_or_default();
    let expects_file = link_path
        .metadata()
        .map(|m| m.is_file())
        .unwrap_or_else(|_| {
            let candidate = PathBuf::from(raw_config_path);
            candidate.extension().is_some()
        });

    // Pick source path accordingly
    let source_path = if expects_file {
        let agentsmd_dir = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| format!("Failed to ensure ~/.agentsmd/: {}", e))?;
        let agents_md_path = agentsmd_dir.join("AGENTS.md");
        if !agents_md_path.exists() {
            fs::write(&agents_md_path, "")
                .map_err(|e| format!("Failed to create AGENTS.md: {}", e))?;
        }
        agents_md_path
    } else {
        fs_manager::ensure_agentsmd_dir()
            .map_err(|e| format!("Failed to create ~/.agentsmd/: {}", e))?
    };

    // Create link: link_path points to source_path
    match symlink::create_link(link_path, source_path, force) {
        Ok((method, warning)) => {
            let method_str = match method {
                LinkMethod::Symlink => "symlink",
                LinkMethod::Junction => "junction",
                LinkMethod::Hardlink => "hardlink",
                LinkMethod::Copy => "copy",
                LinkMethod::Existing => "existing",
            };
            Ok((method_str.to_string(), warning))
        }
        Err(e) => Err(format!("Failed to create link: {}", e)),
    }
}

/// Remove agent link
#[tauri::command]
pub fn remove_agent_link(agent_id: String) -> Result<(), String> {
    let link_path = fs_manager::get_agent_config_path(agent_id)
        .map_err(|e| format!("Failed to get agent config path: {}", e))?;
    
    symlink::remove_link(link_path)
        .map_err(|e| format!("Failed to remove link: {}", e))
}

/// Check symlink support
#[tauri::command]
pub fn check_symlink_support() -> Result<(bool, String), String> {
    Ok(symlink::check_symlink_support())
}
