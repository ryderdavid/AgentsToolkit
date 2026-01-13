//! Azure DevOps agent deployer
//!
//! Handles deployment of AGENTS.md to Azure DevOps pipelines and repositories.

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
use crate::fs_manager;
use crate::symlink;
use crate::types::AgentDefinition;

/// Deployer for Azure DevOps
pub struct AzureDevOpsDeployer {
    base: BaseDeployer,
}

impl AzureDevOpsDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Azure DevOps config directory (user-level)
    fn get_azure_devops_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".azure-devops")
    }

    /// Get project-level Azure Pipelines config path
    fn get_project_pipelines_path(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".azure-pipelines")
    }

    /// Get project-level agents.md path
    fn get_project_agents_path(&self, project_root: &PathBuf) -> PathBuf {
        self.get_project_pipelines_path(project_root).join("agents.md")
    }

    /// Resolve project path from config or detect automatically
    fn resolve_project_path(&self, config: &DeploymentConfig) -> DeploymentResult<PathBuf> {
        if let Some(ref path_str) = config.project_path {
            let path = PathBuf::from(path_str);
            if !path.exists() {
                return Err(DeploymentError::ConfigurationError(format!(
                    "Project path does not exist: {}",
                    path_str
                )));
            }
            if !ProjectDetector::is_valid_project_root(&path) {
                return Err(DeploymentError::ConfigurationError(format!(
                    "Path is not a valid project root: {}",
                    path_str
                )));
            }
            Ok(path)
        } else {
            ProjectDetector::detect_project_root().ok_or_else(|| {
                DeploymentError::ConfigurationError(
                    "No project_path provided and could not detect project root".to_string(),
                )
            })
        }
    }

    /// Get the build output directory
    fn get_build_dir(&self) -> DeploymentResult<PathBuf> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let build_dir = agentsmd_home.join("build").join("azure-devops");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for AzureDevOpsDeployer {
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
        prepared.command_format = "markdown".to_string();

        // Add AGENTS.md path to target_paths for backup
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        prepared.add_target_path(agents_md_path);

        // Branch on target level for destination paths
        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: .azure-pipelines/agents.md
                let project_root = self.resolve_project_path(config)?;
                let project_agents_path = self.get_project_agents_path(&project_root);
                prepared.add_target_path(project_agents_path);
            }
            TargetLevel::User => {
                // User-level: ~/.azure-devops/agents.md
                let azure_devops_dir = self.get_azure_devops_dir();
                prepared.add_target_path(azure_devops_dir.join("agents.md"));
            }
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Azure DevOps doesn't have a strict character limit, use 1M as reasonable
        let limit = self.character_limit().or(Some(1_000_000));
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let warnings = validation.warnings;
        let errors = validation.errors;

        if !errors.is_empty() {
            return Ok(ValidationReport::failure(errors, validation.budget));
        }

        Ok(ValidationReport::success(validation.budget).with_warnings(warnings))
    }

    fn deploy(&self, prepared: PreparedDeployment, config: &DeploymentConfig) -> DeploymentResult<DeploymentOutput> {
        let mut deployed_files = Vec::new();
        let mut warnings = Vec::new();
        let mut manual_steps = Vec::new();

        // Write AGENTS.md to ~/.agentsmd/
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_source, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_source, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_source.to_string_lossy().to_string());

        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: create .azure-pipelines/agents.md
                let project_root = self.resolve_project_path(config)?;
                let project_pipelines_dir = self.get_project_pipelines_path(&project_root);
                let project_agents_path = self.get_project_agents_path(&project_root);
                
                // Ensure .azure-pipelines directory exists
                fs::create_dir_all(&project_pipelines_dir).map_err(|e| {
                    DeploymentError::fs_error(&project_pipelines_dir, format!("Failed to create .azure-pipelines directory: {}", e))
                })?;

                // Create symlink from .azure-pipelines/agents.md to ~/.agentsmd/AGENTS.md
                match symlink::create_link(project_agents_path.clone(), agents_md_source.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(project_agents_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &project_agents_path,
                            format!("Failed to create symlink: {}", e),
                        ));
                    }
                }

                manual_steps.push(format!(
                    "Project-level rules deployed to {}.\n\n\
                     To use with Azure Pipelines:\n\
                     1. Reference the agents.md file in your pipeline YAML\n\
                     2. Or include it as a template parameter\n\
                     3. Ensure the file is committed to your repository",
                    project_agents_path.display()
                ));
            }
            TargetLevel::User => {
                // User-level deployment
                let azure_devops_dir = self.get_azure_devops_dir();

                // Ensure directory exists
                fs::create_dir_all(&azure_devops_dir).map_err(|e| {
                    DeploymentError::fs_error(&azure_devops_dir, format!("Failed to create Azure DevOps directory: {}", e))
                })?;

                // Create symlink at ~/.azure-devops/agents.md pointing to AGENTS.md
                let agents_link_path = azure_devops_dir.join("agents.md");
                match symlink::create_link(agents_link_path.clone(), agents_md_source.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(agents_link_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &agents_link_path,
                            format!("Failed to create symlink: {}", e),
                        ));
                    }
                }

                manual_steps.push(
                    "Azure DevOps configuration deployed.\n\n\
                     To use with Azure Pipelines:\n\
                     1. Copy or link the agents.md file to your repository's .azure-pipelines directory\n\
                     2. Reference it in your pipeline YAML configuration\n\
                     3. Or use the Azure DevOps extension (if available) to auto-inject rules".to_string()
                );
            }
        }

        Ok(DeploymentOutput::success("symlink", deployed_files)
            .with_warnings(warnings)
            .with_manual_steps(manual_steps))
    }

    fn rollback(&self, state: &DeploymentState) -> DeploymentResult<()> {
        for file_path in &state.files_created {
            let path = PathBuf::from(file_path);
            if path.exists() {
                if path.is_symlink() || path.is_file() {
                    fs::remove_file(&path).map_err(|e| {
                        DeploymentError::RollbackFailed(format!(
                            "Failed to remove {}: {}",
                            file_path, e
                        ))
                    })?;
                }
            }
        }

        Ok(())
    }

    fn get_status(&self) -> DeploymentResult<AgentStatus> {
        let azure_devops_dir = self.get_azure_devops_dir();

        if !azure_devops_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        // Check if agents.md exists
        let agents_md = azure_devops_dir.join("agents.md");
        if agents_md.exists() {
            return Ok(AgentStatus::Configured);
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true // Azure DevOps supports .azure-pipelines/agents.md in projects
    }
}
