//! Warp terminal agent deployer
//!
//! Handles deployment of AGENTS.md as Warp workflows.

use std::fs;
use std::path::PathBuf;

use crate::deployment::converters::MarkdownConverter;
use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, ValidationReport,
};
use crate::deployment::error::{DeploymentError, DeploymentResult};
use crate::deployment::state::DeploymentState;
use crate::deployment::validator::DeploymentValidator;
use crate::deployment::{generate_agents_md_content, BaseDeployer};
use crate::fs_manager;
use crate::types::AgentDefinition;

/// Deployer for Warp Terminal
pub struct WarpDeployer {
    base: BaseDeployer,
}

impl WarpDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Warp workflows directory
    fn get_workflows_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".warp")
            .join("workflows")
    }

    /// Get the build output directory
    fn get_build_dir(&self) -> DeploymentResult<PathBuf> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let build_dir = agentsmd_home.join("build").join("warp").join("workflows");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for WarpDeployer {
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
        prepared.command_format = "yaml".to_string();

        // Add AGENTS.md path to target_paths for backup
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        prepared.add_target_path(agents_md_path);

        // Convert custom commands to Warp workflow YAML format
        let workflows_dir = self.get_workflows_dir();
        for command_id in &config.custom_command_ids {
            let workflow_content = MarkdownConverter::to_warp_workflow(
                command_id,
                &format!("AgentsToolkit: {}", command_id),
                "Execute this workflow to perform the specified action.",
            )?;
            prepared.add_command(format!("{}.yaml", command_id), workflow_content);
            
            // Add each workflow file path for backup
            let workflow_path = workflows_dir.join(format!("{}.yaml", command_id));
            prepared.add_target_path(workflow_path);
        }

        // Add workflows directory if we have commands
        if !config.custom_command_ids.is_empty() {
            prepared.add_target_path(workflows_dir);
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Warp doesn't have a strict character limit, but we'll use 1M as reasonable
        let limit = self.character_limit().or(Some(1_000_000));
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate YAML syntax for workflows
        for (name, content) in &prepared.commands {
            if name.ends_with(".yaml") || name.ends_with(".yml") {
                match serde_yaml::from_str::<serde_yaml::Value>(content) {
                    Ok(_) => {}
                    Err(e) => {
                        errors.push(format!("Invalid YAML in workflow '{}': {}", name, e));
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
        let mut warnings = Vec::new();
        let mut manual_steps = Vec::new();

        let workflows_dir = self.get_workflows_dir();

        // Ensure workflows directory exists
        fs::create_dir_all(&workflows_dir).map_err(|e| {
            DeploymentError::fs_error(&workflows_dir, format!("Failed to create workflows directory: {}", e))
        })?;

        // Write AGENTS.md to ~/.agentsmd/
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_path, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_path, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_path.to_string_lossy().to_string());

        // Deploy workflow files
        if !prepared.commands.is_empty() {
            let build_dir = self.get_build_dir()?;

            for (name, content) in &prepared.commands {
                // Write to build directory
                let build_path = build_dir.join(name);
                fs::write(&build_path, content).map_err(|e| {
                    DeploymentError::fs_error(&build_path, format!("Failed to write workflow: {}", e))
                })?;

                // Copy to workflows directory (Warp prefers actual files, not symlinks)
                let workflow_path = workflows_dir.join(name);
                fs::copy(&build_path, &workflow_path).map_err(|e| {
                    DeploymentError::fs_error(&workflow_path, format!("Failed to copy workflow: {}", e))
                })?;
                deployed_files.push(workflow_path.to_string_lossy().to_string());
            }
        }

        // Add manual step for AGENTS.md reference
        manual_steps.push(
            "Warp doesn't have built-in AGENTS.md support. To use the rules:\n\
             1. Reference ~/.agentsmd/AGENTS.md in your prompts\n\
             2. Or use 'cat ~/.agentsmd/AGENTS.md' to view the rules\n\
             3. Workflows have been installed to ~/.warp/workflows/".to_string()
        );

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
        let warp_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".warp");

        if !warp_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        let workflows_dir = self.get_workflows_dir();
        if workflows_dir.exists() && workflows_dir.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false) {
            return Ok(AgentStatus::Configured);
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        false // Warp uses global workflows
    }
}
