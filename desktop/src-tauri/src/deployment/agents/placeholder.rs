//! Placeholder agent deployer
//!
//! Handles agents with unverified or unknown configuration paths.
//! Used for Kilocode, Opencode, Roocode, and other unverified agents.

use std::fs;
use std::path::PathBuf;

use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, ValidationReport, BudgetUsage,
};
use crate::deployment::error::{DeploymentError, DeploymentResult};
use crate::deployment::state::DeploymentState;
use crate::deployment::validator::DeploymentValidator;
use crate::deployment::{generate_agents_md_content, BaseDeployer};
use crate::fs_manager;
use crate::types::AgentDefinition;

/// Placeholder deployer for agents with unverified paths
pub struct PlaceholderDeployer {
    base: BaseDeployer,
}

impl PlaceholderDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the agent's config path (may be a placeholder)
    fn get_config_path(&self) -> Option<PathBuf> {
        let agent = self.base.agent();
        agent.config_paths.first().map(|p| {
            // Expand ~ to home directory
            if p.starts_with("~/") {
                dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join(&p[2..])
            } else {
                PathBuf::from(p)
            }
        })
    }

    /// Check if this agent's paths have been verified
    fn is_verified(&self) -> bool {
        let agent = self.base.agent();
        // Check if notes mention "placeholder" or "unverified"
        if let Some(notes) = &agent.notes {
            let notes_lower = notes.to_lowercase();
            return !notes_lower.contains("placeholder") && !notes_lower.contains("unverified");
        }
        // Assume unverified if config path contains placeholder patterns
        !agent.config_paths.iter().any(|p| 
            p.contains("placeholder") || p.contains("TODO") || p.contains("TBD")
        )
    }
}

impl AgentDeployer for PlaceholderDeployer {
    fn agent_id(&self) -> &str {
        &self.base.agent().id
    }

    fn agent_definition(&self) -> &AgentDefinition {
        self.base.agent()
    }

    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        // Generate AGENTS.md content
        let agents_md_content = generate_agents_md_content(&config.pack_ids, false)?;

        let mut prepared = PreparedDeployment::new(agents_md_content);
        prepared.command_format = self.base.agent().file_format.clone();

        // Add config path as target if available
        if let Some(config_path) = self.get_config_path() {
            prepared.add_target_path(config_path);
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        let limit = self.character_limit();
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let errors = validation.errors;

        // Add warning about unverified paths
        if !self.is_verified() {
            warnings.push(format!(
                "⚠️ Agent '{}' has unverified configuration paths. \
                 Deployment may not work as expected. \
                 Please verify paths and update the agent registry.",
                self.agent_id()
            ));
        }

        // Warn if config path doesn't exist
        if let Some(config_path) = self.get_config_path() {
            if let Some(parent) = config_path.parent() {
                if !parent.exists() {
                    warnings.push(format!(
                        "Config directory {} does not exist. Agent may not be installed.",
                        parent.display()
                    ));
                }
            }
        }

        if !errors.is_empty() {
            return Ok(ValidationReport::failure(errors, validation.budget));
        }

        Ok(ValidationReport::success(validation.budget).with_warnings(warnings))
    }

    fn deploy(&self, prepared: PreparedDeployment, _config: &DeploymentConfig) -> DeploymentResult<DeploymentOutput> {
        let mut deployed_files = Vec::new();
        let mut warnings = Vec::new();
        let mut manual_steps = Vec::new();

        // Add unverified warning
        if !self.is_verified() {
            warnings.push(format!(
                "Agent '{}' has unverified paths - deployment may be incomplete",
                self.agent_id()
            ));
        }

        // Write AGENTS.md to ~/.agentsmd/
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_path, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_path, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_path.to_string_lossy().to_string());

        // Attempt to write to config path if it exists
        if let Some(config_path) = self.get_config_path() {
            if let Some(parent) = config_path.parent() {
                if parent.exists() {
                    // Try to write/link
                    match fs::write(&config_path, &prepared.agents_md_content) {
                        Ok(_) => {
                            deployed_files.push(config_path.to_string_lossy().to_string());
                        }
                        Err(e) => {
                            warnings.push(format!(
                                "Could not write to {}: {}",
                                config_path.display(), e
                            ));
                        }
                    }
                } else {
                    manual_steps.push(format!(
                        "When {} is available, copy or link ~/.agentsmd/AGENTS.md to {}",
                        self.agent_id(),
                        config_path.display()
                    ));
                }
            }
        }

        // Add manual steps for unverified agents
        manual_steps.push(format!(
            "To complete setup for {}:\n\
             1. Verify the correct configuration path for this agent\n\
             2. Update the agent registry with verified paths\n\
             3. Re-run deployment after verification",
            self.agent_id()
        ));

        Ok(DeploymentOutput::success("copy", deployed_files)
            .with_warnings(warnings)
            .with_manual_steps(manual_steps))
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
        // Check if config path exists
        if let Some(config_path) = self.get_config_path() {
            if let Some(parent) = config_path.parent() {
                if parent.exists() {
                    if config_path.exists() {
                        return Ok(AgentStatus::Configured);
                    }
                    return Ok(AgentStatus::Installed);
                }
            }
        }

        Ok(AgentStatus::NotInstalled)
    }

    fn supports_project_level(&self) -> bool {
        // Assume project-level support based on agent definition
        let agent = self.base.agent();
        agent.deployment_strategy == "symlink" || agent.deployment_strategy == "copy"
    }
}
