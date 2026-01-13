//! GitHub Copilot agent deployer
//!
//! Handles deployment of AGENTS.md to GitHub Copilot.
//! Copilot uses inline content in .github/copilot-instructions.md (project-level only).

use std::fs;
use std::path::PathBuf;

use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, TargetLevel, ValidationReport,
};
use crate::deployment::error::{DeploymentError, DeploymentResult};
use crate::deployment::project::ProjectDetector;
use crate::deployment::state::DeploymentState;
use crate::deployment::validator::DeploymentValidator;
use crate::deployment::{generate_agents_md_content, BaseDeployer};
use crate::types::AgentDefinition;

/// Deployer for GitHub Copilot
pub struct CopilotDeployer {
    base: BaseDeployer,
}

impl CopilotDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the copilot instructions path for a project
    fn get_instructions_path(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".github").join("copilot-instructions.md")
    }
}

impl AgentDeployer for CopilotDeployer {
    fn agent_id(&self) -> &str {
        &self.base.agent().id
    }

    fn agent_definition(&self) -> &AgentDefinition {
        self.base.agent()
    }

    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        // Copilot requires project-level deployment
        if config.target_level != TargetLevel::Project {
            return Err(DeploymentError::validation(
                "Copilot only supports project-level deployment. Set target_level to 'project'."
            ));
        }

        // Generate AGENTS.md content - inline (no file references) due to 8K limit
        let agents_md_content = generate_agents_md_content(&config.pack_ids, true)?;

        let mut prepared = PreparedDeployment::new(agents_md_content);
        prepared.command_format = "inline".to_string();

        // Copilot doesn't support custom commands
        if !config.custom_command_ids.is_empty() {
            // We'll add a warning in validation
        }

        // Determine project root
        let project_root = if let Some(ref path) = config.project_path {
            PathBuf::from(path)
        } else {
            ProjectDetector::detect_project_root()
                .ok_or_else(|| DeploymentError::validation(
                    "No project root detected. Provide project_path or run from within a project."
                ))?
        };

        prepared.add_target_path(self.get_instructions_path(&project_root));

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Copilot has strict 8K character limit
        let limit = self.character_limit().or(Some(8000));
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings.clone();
        let mut errors = validation.errors.clone();

        // Warn about custom commands
        if !prepared.commands.is_empty() {
            warnings.push(
                "Copilot does not support custom commands. Commands will be ignored.".to_string()
            );
        }

        // Warn if close to limit
        if let Some(percentage) = validation.budget.percentage {
            if percentage > 70.0 && percentage <= 80.0 {
                warnings.push(format!(
                    "Content uses {:.1}% of Copilot's 8K limit. Consider reducing content.",
                    percentage
                ));
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

        // Determine project root
        let project_root = if let Some(ref path) = config.project_path {
            PathBuf::from(path)
        } else {
            ProjectDetector::detect_project_root()
                .ok_or_else(|| DeploymentError::validation(
                    "No project root detected."
                ))?
        };

        let github_dir = project_root.join(".github");
        let instructions_path = self.get_instructions_path(&project_root);

        // Create .github directory if needed
        fs::create_dir_all(&github_dir).map_err(|e| {
            DeploymentError::fs_error(&github_dir, format!("Failed to create .github directory: {}", e))
        })?;

        // Write inline content (no symlink for Copilot)
        fs::write(&instructions_path, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&instructions_path, format!("Failed to write instructions: {}", e))
        })?;
        deployed_files.push(instructions_path.to_string_lossy().to_string());

        Ok(DeploymentOutput::success("inline", deployed_files).with_warnings(warnings))
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
        // Copilot is a cloud service, we can't easily detect installation
        // Check if we're in a project with copilot-instructions.md
        if let Some(project_root) = ProjectDetector::detect_project_root() {
            let instructions_path = self.get_instructions_path(&project_root);
            if instructions_path.exists() {
                return Ok(AgentStatus::Configured);
            }
        }

        // Assume Copilot is available (it's a cloud service)
        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true // Copilot only supports project-level
    }

    fn supports_user_level(&self) -> bool {
        false // Copilot doesn't support user-level configuration
    }
}
