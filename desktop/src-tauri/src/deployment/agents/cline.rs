//! Cline agent deployer
//!
//! Handles deployment of AGENTS.md to Cline (VS Code extension).
//! Cline uses project-level .cline/config.json.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};

use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, TargetLevel, ValidationReport,
};
use crate::deployment::error::{DeploymentError, DeploymentResult};
use crate::deployment::project::ProjectDetector;
use crate::deployment::state::DeploymentState;
use crate::deployment::validator::DeploymentValidator;
use crate::deployment::{generate_agents_md_content, BaseDeployer};
use crate::fs_manager;
use crate::types::AgentDefinition;

/// Deployer for Cline (VS Code extension)
pub struct ClineDeployer {
    base: BaseDeployer,
}

impl ClineDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Cline config directory for a project
    fn get_config_dir(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".cline")
    }

    /// Get the Cline config file path
    fn get_config_path(&self, project_root: &PathBuf) -> PathBuf {
        self.get_config_dir(project_root).join("config.json")
    }
}

impl AgentDeployer for ClineDeployer {
    fn agent_id(&self) -> &str {
        &self.base.agent().id
    }

    fn agent_definition(&self) -> &AgentDefinition {
        self.base.agent()
    }

    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        // Cline supports both project and user level
        let agents_md_content = generate_agents_md_content(&config.pack_ids, false)?;

        let mut prepared = PreparedDeployment::new(agents_md_content.clone());
        prepared.command_format = "json".to_string();

        // Prepare commands as JSON array
        let commands: Vec<Value> = config
            .custom_command_ids
            .iter()
            .map(|id| {
                json!({
                    "name": id,
                    "description": format!("Custom command: {}", id),
                    "content": "Execute this command to perform the specified action."
                })
            })
            .collect();

        // Create config JSON
        let config_content = json!({
            "version": "1.0",
            "agentsMdPath": "~/.agentsmd/AGENTS.md",
            "commands": commands,
            "rules": agents_md_content
        });

        let config_json = serde_json::to_string_pretty(&config_content)
            .map_err(|e| DeploymentError::format_error(format!("Failed to serialize config: {}", e)))?;

        prepared.add_config_file("config.json".to_string(), config_json);

        // Determine target paths based on level
        if config.target_level == TargetLevel::Project {
            let project_root = if let Some(ref path) = config.project_path {
                PathBuf::from(path)
            } else {
                ProjectDetector::detect_project_root()
                    .ok_or_else(|| DeploymentError::validation(
                        "No project root detected. Provide project_path or run from within a project."
                    ))?
            };
            prepared.add_target_path(self.get_config_path(&project_root));
        } else {
            // User-level: ~/.cline/config.json
            let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            prepared.add_target_path(home.join(".cline").join("config.json"));
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Cline doesn't have a documented character limit
        let limit = self.character_limit().or(Some(500_000));
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate JSON syntax for config
        for (name, content) in &prepared.config_files {
            if name.ends_with(".json") {
                match serde_json::from_str::<Value>(content) {
                    Ok(_) => {}
                    Err(e) => {
                        errors.push(format!("Invalid JSON in '{}': {}", name, e));
                    }
                }
            }
        }

        if !errors.is_empty() {
            return Ok(ValidationReport::failure(errors, validation.budget));
        }

        Ok(ValidationReport::success(validation.budget).with_warnings(warnings))
    }

    fn deploy(&self, prepared: PreparedDeployment, config: &DeploymentConfig) -> DeploymentResult<DeploymentOutput> {
        let mut deployed_files = Vec::new();
        let warnings = Vec::new();

        // Write AGENTS.md to ~/.agentsmd/
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_path, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_path, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_path.to_string_lossy().to_string());

        // Determine config directory
        let config_dir = if config.target_level == TargetLevel::Project {
            let project_root = if let Some(ref path) = config.project_path {
                PathBuf::from(path)
            } else {
                ProjectDetector::detect_project_root()
                    .ok_or_else(|| DeploymentError::validation("No project root detected."))?
            };
            self.get_config_dir(&project_root)
        } else {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".cline")
        };

        // Create config directory
        fs::create_dir_all(&config_dir).map_err(|e| {
            DeploymentError::fs_error(&config_dir, format!("Failed to create .cline directory: {}", e))
        })?;

        // Write config files
        for (name, content) in &prepared.config_files {
            let config_path = config_dir.join(name);
            fs::write(&config_path, content).map_err(|e| {
                DeploymentError::fs_error(&config_path, format!("Failed to write config: {}", e))
            })?;
            deployed_files.push(config_path.to_string_lossy().to_string());
        }

        Ok(DeploymentOutput::success("copy", deployed_files).with_warnings(warnings))
    }

    fn rollback(&self, state: &DeploymentState) -> DeploymentResult<()> {
        for file_path in &state.files_created {
            let path = PathBuf::from(file_path);
            if path.exists() && path.is_file() {
                fs::remove_file(&path).map_err(|e| {
                    DeploymentError::RollbackFailed(format!(
                        "Failed to remove {}: {}",
                        file_path, e
                    ))
                })?;
            }
        }

        Ok(())
    }

    fn get_status(&self) -> DeploymentResult<AgentStatus> {
        // Check user-level config
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        let user_config = home.join(".cline").join("config.json");

        if user_config.exists() {
            return Ok(AgentStatus::Configured);
        }

        // Check if project-level config exists
        if let Some(project_root) = ProjectDetector::detect_project_root() {
            let project_config = self.get_config_path(&project_root);
            if project_config.exists() {
                return Ok(AgentStatus::Configured);
            }
        }

        // Cline is a VS Code extension, we can't easily detect if it's installed
        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true
    }

    fn supports_user_level(&self) -> bool {
        true
    }
}
