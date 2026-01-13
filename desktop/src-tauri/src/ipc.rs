use crate::deployment::{
    self, AgentStatus, DeploymentConfig, DeploymentManager, DeploymentOutput,
    PreparedDeployment, ValidationReport,
};
use crate::deployment::state::DeploymentState;
use crate::fs_manager;
use crate::symlink::{self, SymlinkError};
use crate::types::*;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Global deployment manager instance
static DEPLOYMENT_MANAGER: Lazy<Mutex<Option<DeploymentManager>>> = Lazy::new(|| {
    Mutex::new(DeploymentManager::new().ok())
});

fn get_deployment_manager() -> Result<std::sync::MutexGuard<'static, Option<DeploymentManager>>, String> {
    DEPLOYMENT_MANAGER.lock().map_err(|e| format!("Failed to acquire lock: {}", e))
}

fn load_pack_full_internal(pack_id: &str) -> Result<LoadedPack, String> {
    let pack = load_pack(pack_id.to_string())?;
    let content = fs_manager::read_pack_content(pack_id.to_string())
        .map_err(|e| format!("Failed to load pack content: {}", e))?;

    let actual_word_count = content.split_whitespace().count() as u64;
    let actual_character_count = content.len() as u64;
    let pack_path = fs_manager::get_rule_packs_dir().join(pack_id);

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

fn resolve_dependencies_internal(pack_id: String) -> Result<DependencyResolution, String> {
    // Simplified dependency resolution
    let mut order = Vec::new();
    let mut visited = HashSet::new();

    fn resolve_recursive(
        id: String,
        visited: &mut HashSet<String>,
        order: &mut Vec<String>,
        path: &mut Vec<String>,
    ) -> Result<(), String> {
        if visited.contains(&id) {
            return Err(format!("Circular dependency detected: {}", path.join(" -> ")));
        }

        visited.insert(id.clone());
        path.push(id.clone());

        let json_str = fs_manager::read_pack_json(id.clone())
            .map_err(|e| format!("Failed to load pack: {}", e))?;
        let pack: RulePack = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse pack: {}", e))?;

        for dep_id in &pack.dependencies {
            if !order.contains(dep_id) {
                resolve_recursive(dep_id.clone(), visited, order, path)?;
            }
        }

        if !order.contains(&id) {
            order.push(id.clone());
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

fn empty_budget_info() -> BudgetInfo {
    BudgetInfo {
        total_chars: 0,
        max_chars: None,
        percentage: None,
        within_limit: true,
        pack_breakdown: Vec::new(),
    }
}

fn get_agent_char_limit(agent_id: &str) -> Option<u64> {
    if let Ok(agents) = fs_manager::load_agent_registry() {
        if let Some(agent) = agents
            .iter()
            .find(|a| a.id.eq_ignore_ascii_case(agent_id))
        {
            if let Some(max) = agent.character_limits.max_chars {
                return Some(max);
            }
        }
    }

    match agent_id.to_lowercase().as_str() {
        "cursor" => Some(1_000_000),
        "claude" => Some(200_000),
        "copilot" => Some(8_000),
        "gemini" => Some(1_000_000),
        "codex" => Some(50_000),
        _ => None,
    }
}

fn calculate_budget_internal(
    pack_ids: &[String],
    agent_id: Option<String>,
) -> Result<BudgetInfo, String> {
    let mut pack_breakdown: Vec<PackBudgetItem> = Vec::new();
    let mut total_chars: u64 = 0;
    let mut total_words: u64 = 0;
    let mut seen: HashSet<String> = HashSet::new();

    for pack_id in pack_ids {
        let resolution = resolve_dependencies_internal(pack_id.clone())?;
        if !resolution.success {
            return Err(resolution.error.unwrap_or_else(|| "Failed to resolve dependencies".into()));
        }

        for id in resolution.order {
            if seen.insert(id.clone()) {
                let pack = load_pack_full_internal(&id)?;
                total_chars += pack.actual_character_count;
                total_words += pack.actual_word_count;
                pack_breakdown.push(PackBudgetItem {
                    pack_id: id,
                    chars: pack.actual_character_count,
                    words: pack.actual_word_count,
                    percentage_of_total: 0,
                });
            }
        }
    }

    for item in pack_breakdown.iter_mut() {
        if total_chars > 0 {
            item.percentage_of_total = ((item.chars as f64 / total_chars as f64) * 100.0).round() as u64;
        }
    }

    let max_chars = agent_id
        .as_ref()
        .and_then(|id| get_agent_char_limit(id));
    let percentage = max_chars.map(|max| ((total_chars as f64 / max as f64) * 100.0).round() as u64);
    let within_limit = max_chars.map(|max| total_chars <= max).unwrap_or(true);

    Ok(BudgetInfo {
        total_chars,
        max_chars,
        percentage,
        within_limit,
        pack_breakdown,
    })
}

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
    load_pack_full_internal(&pack_id)
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
    // Validate the pack exists before resolving
    load_pack(pack_id.clone())?;
    resolve_dependencies_internal(pack_id)
}

#[tauri::command]
pub fn load_pack_file(pack_id: String, file: String) -> Result<String, String> {
    let pack_dir = fs_manager::get_rule_packs_dir().join(&pack_id);
    let file_path = pack_dir.join(&file);

    if !file_path.starts_with(&pack_dir) {
        return Err("Invalid file path".to_string());
    }

    if !file_path.exists() {
        return Err(format!("File not found: {}", file));
    }

    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn calculate_budget(pack_ids: Vec<String>, agent_id: Option<String>) -> Result<BudgetInfo, String> {
    calculate_budget_internal(&pack_ids, agent_id)
}

#[tauri::command]
pub fn validate_composition(
    pack_ids: Vec<String>,
    agent_id: Option<String>,
) -> Result<ValidationResult, String> {
    let mut errors: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for pack_id in &pack_ids {
        let validation = validate_pack(pack_id.clone())?;
        for err in validation.errors {
            errors.push(format!("[{}] {}", err.pack_id, err.message));
        }
        for warn in validation.warnings {
            warnings.push(format!("[{}] {}", warn.pack_id, warn.message));
        }
    }

    if errors.is_empty() {
        let budget = calculate_budget_internal(&pack_ids, agent_id.clone())?;
        if let Some(agent) = agent_id {
            if !budget.within_limit {
                let limit = budget
                    .max_chars
                    .map(|m| m.to_string())
                    .unwrap_or_else(|| "unlimited".to_string());
                let percent_display = budget
                    .percentage
                    .map(|p| p.to_string())
                    .unwrap_or_else(|| "N/A".to_string());
                errors.push(format!(
                    "Composition exceeds {} character limit: {} / {} ({}%)",
                    agent,
                    budget.total_chars,
                    limit,
                    percent_display
                ));
            } else if let Some(percent) = budget.percentage {
                if percent > 80 {
                    warnings.push(format!(
                        "Composition uses {}% of {} character limit",
                        percent, agent
                    ));
                }
            }
        }
    }

    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
        warnings,
    })
}

#[tauri::command]
pub fn generate_agents_md(
    pack_ids: Vec<String>,
    include_metadata: Option<bool>,
    inline_content: Option<bool>,
) -> Result<GenerateResult, String> {
    let include_metadata = include_metadata.unwrap_or(true);
    let inline_content = inline_content.unwrap_or(false);

    let result = (|| -> Result<GenerateResult, String> {
        let mut lines: Vec<String> = Vec::new();
        lines.push("# AGENTS.md — Mandatory Agent Behavior & Workflow Standards".into());
        lines.push("".into());
        lines.push("Non-negotiable rules for all AI agents. Violations constitute workflow failures.".into());
        lines.push("".into());
        lines.push("**Version:** 2.0.0 (Modular Rule Packs)  ".into());
        lines.push("**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).".into());
        lines.push("".into());
        lines.push("---".into());
        lines.push("".into());
        lines.push("## Active Rule Packs".into());
        lines.push("".into());

        let mut packs: Vec<LoadedPack> = Vec::new();
        for id in pack_ids.iter() {
            let pack = load_pack_full_internal(id)?;
            packs.push(pack);
        }

        for pack in packs.iter() {
            lines.push(format!(
                "- **{}** (`rule-packs/{}/`) — {}",
                pack.name, pack.id, pack.description
            ));
        }

        lines.push("".into());
        lines.push("---".into());
        lines.push("".into());

        if inline_content {
            for pack in packs.iter() {
                lines.push(format!("<!-- Pack: {} v{} -->", pack.id, pack.version));
                lines.push(pack.content.clone());
                lines.push("".into());
            }
        } else {
            lines.push("<!-- BEGIN PACK IMPORTS -->".into());
            lines.push("".into());
            for pack in packs.iter() {
                for file in pack.files.iter() {
                    lines.push(format!("@rule-packs/{}/{}", pack.id, file));
                }
                lines.push("".into());
            }
            lines.push("<!-- END PACK IMPORTS -->".into());
            lines.push("".into());
        }

        lines.push("---".into());
        lines.push("".into());

        let budget = calculate_budget_internal(&pack_ids, None)?;
        if include_metadata {
            lines.push("## Configuration".into());
            lines.push("".into());
            lines.push("**Character Budget:**".into());
            for item in budget.pack_breakdown.iter() {
                if let Some(pack) = packs.iter().find(|p| p.id == item.pack_id) {
                    lines.push(format!(
                        "- {}: ~{} words (~{} chars)",
                        pack.name, item.words, item.chars
                    ));
                } else {
                    lines.push(format!(
                        "- {}: ~{} words (~{} chars)",
                        item.pack_id, item.words, item.chars
                    ));
                }
            }
            let total_words: u64 = budget.pack_breakdown.iter().map(|p| p.words).sum();
            lines.push(format!(
                "- **Total:** ~{} words (~{} chars)",
                total_words, budget.total_chars
            ));
        }

        Ok(GenerateResult {
            success: true,
            content: lines.join("\n"),
            budget,
            error: None,
        })
    })();

    match result {
        Ok(ok) => Ok(ok),
        Err(err) => Ok(GenerateResult {
            success: false,
            content: String::new(),
            budget: empty_budget_info(),
            error: Some(err),
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

// ============================================================================
// Deployment Commands
// ============================================================================

/// Deploy to a specific agent
#[tauri::command]
pub fn deploy_to_agent(agent_id: String, config: DeploymentConfig) -> Result<DeploymentOutput, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.deploy(&config).map_err(|e| e.to_string())
}

/// Validate a deployment without executing it
#[tauri::command]
pub fn validate_deployment(agent_id: String, config: DeploymentConfig) -> Result<ValidationReport, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.validate_deployment(&config).map_err(|e| e.to_string())
}

/// Rollback a deployment
#[tauri::command]
pub fn rollback_deployment(agent_id: String, timestamp: Option<String>) -> Result<(), String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.rollback(&agent_id, timestamp).map_err(|e| e.to_string())
}

/// Get deployment status for an agent
#[tauri::command]
pub fn get_deployment_status(agent_id: String) -> Result<AgentStatus, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.get_status(&agent_id).map_err(|e| e.to_string())
}

/// Get deployment history for an agent
#[tauri::command]
pub fn get_deployment_history(agent_id: String) -> Result<Vec<DeploymentState>, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.get_history(&agent_id).map_err(|e| e.to_string())
}

/// Preview a deployment without executing it
#[tauri::command]
pub fn preview_deployment(agent_id: String, config: DeploymentConfig) -> Result<PreparedDeployment, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    manager.preview_deployment(&config).map_err(|e| e.to_string())
}

/// Get all available agents for deployment
#[tauri::command]
pub fn get_deployable_agents() -> Result<Vec<String>, String> {
    let guard = get_deployment_manager()?;
    let manager = guard.as_ref().ok_or("Deployment manager not initialized")?;
    
    Ok(manager.available_agents())
}
