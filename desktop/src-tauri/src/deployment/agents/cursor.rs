//! Cursor agent deployer
//!
//! Handles deployment of AGENTS.md and custom commands to Cursor.

use std::fs;
use std::path::PathBuf;

use crate::deployment::converters::MarkdownConverter;
use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, BudgetUsage, DeploymentConfig, DeploymentOutput,
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

/// Deployer for Cursor IDE
pub struct CursorDeployer {
    base: BaseDeployer,
}

impl CursorDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Cursor commands directory (user-level)
    fn get_commands_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".cursor")
            .join("commands")
    }

    /// Get project-level rules.md path
    fn get_project_rules_path(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".cursor").join("rules.md")
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

    /// Get the build output directory for Cursor commands
    fn get_build_dir(&self) -> DeploymentResult<PathBuf> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let build_dir = agentsmd_home.join("build").join("cursor").join("commands");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for CursorDeployer {
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
                // Project-level deployment: .cursor/rules.md
                let project_root = self.resolve_project_path(config)?;
                let project_rules_path = self.get_project_rules_path(&project_root);
                prepared.add_target_path(project_rules_path);
            }
            TargetLevel::User => {
                // User-level: prepare custom commands as markdown files
                let commands_dir = self.get_commands_dir();
                for command_id in &config.custom_command_ids {
                    // For now, create a simple command structure
                    // In a full implementation, this would load command definitions
                    let command_content = MarkdownConverter::to_cursor_command(
                        command_id,
                        &format!("Custom command: {}", command_id),
                        "Execute this command to perform the specified action.",
                    );
                    prepared.add_command(format!("{}.md", command_id), command_content);
                    
                    // Add each command file path for backup
                    let command_path = commands_dir.join(format!("{}.md", command_id));
                    prepared.add_target_path(command_path);
                }

                // Add commands directory if we have commands
                if !config.custom_command_ids.is_empty() {
                    prepared.add_target_path(commands_dir);
                }
            }
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Check character limit (1M for Cursor)
        let limit = self.character_limit();
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate command formats
        for (name, _content) in &prepared.commands {
            if !name.ends_with(".md") {
                warnings.push(format!("Command '{}' should have .md extension", name));
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

        // Ensure ~/.agentsmd/AGENTS.md exists with content
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_path = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_path, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_path, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_path.to_string_lossy().to_string());

        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: create .cursor/rules.md
                let project_root = self.resolve_project_path(config)?;
                let project_rules_path = self.get_project_rules_path(&project_root);
                
                // Ensure .cursor directory exists
                if let Some(parent) = project_rules_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| {
                        DeploymentError::fs_error(parent, format!("Failed to create .cursor directory: {}", e))
                    })?;
                }

                // Create symlink from .cursor/rules.md to ~/.agentsmd/AGENTS.md
                match symlink::create_link(project_rules_path.clone(), agents_md_path.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(project_rules_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &project_rules_path,
                            format!("Failed to create symlink: {}", e),
                        ));
                    }
                }

                manual_steps.push(format!(
                    "Project-level rules deployed to {}. Cursor will automatically read this file.",
                    project_rules_path.display()
                ));
            }
            TargetLevel::User => {
                // User-level deployment: create build directory and write command files
                if !prepared.commands.is_empty() {
                    let build_dir = self.get_build_dir()?;
                    let commands_dir = self.get_commands_dir();

                    // Ensure commands directory exists
                    fs::create_dir_all(&commands_dir).map_err(|e| {
                        DeploymentError::fs_error(&commands_dir, format!("Failed to create commands directory: {}", e))
                    })?;

                    for (name, content) in &prepared.commands {
                        // Write to build directory
                        let build_path = build_dir.join(name);
                        fs::write(&build_path, content).map_err(|e| {
                            DeploymentError::fs_error(&build_path, format!("Failed to write command: {}", e))
                        })?;

                        // Create symlink in commands directory
                        let link_path = commands_dir.join(name);
                        match symlink::create_link(link_path.clone(), build_path.clone(), config.force_overwrite) {
                            Ok((_, warning)) => {
                                deployed_files.push(link_path.to_string_lossy().to_string());
                                if let Some(w) = warning {
                                    warnings.push(w);
                                }
                            }
                            Err(e) => {
                                return Err(DeploymentError::fs_error(
                                    &link_path,
                                    format!("Failed to create symlink: {}", e),
                                ));
                            }
                        }
                    }
                }

                // Add manual step for User Rule configuration
                manual_steps.push(
                    "To complete setup, add the following to your Cursor User Rule (Settings > Rules for AI):\n\
                     \n\
                     Always read and follow ~/.agentsmd/AGENTS.md\n\
                     \n\
                     Or reference it directly using @~/.agentsmd/AGENTS.md in your prompts.".to_string()
                );
            }
        }

        Ok(DeploymentOutput::success("symlink", deployed_files)
            .with_warnings(warnings)
            .with_manual_steps(manual_steps))
    }

    fn rollback(&self, state: &DeploymentState) -> DeploymentResult<()> {
        // Remove deployed files
        for file_path in &state.files_created {
            let path = PathBuf::from(file_path);
            if path.exists() {
                if path.is_symlink() {
                    fs::remove_file(&path).map_err(|e| {
                        DeploymentError::RollbackFailed(format!(
                            "Failed to remove symlink {}: {}",
                            file_path, e
                        ))
                    })?;
                } else if path.is_file() {
                    fs::remove_file(&path).map_err(|e| {
                        DeploymentError::RollbackFailed(format!(
                            "Failed to remove file {}: {}",
                            file_path, e
                        ))
                    })?;
                }
            }
        }

        Ok(())
    }

    fn get_status(&self) -> DeploymentResult<AgentStatus> {
        let cursor_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".cursor");

        if !cursor_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        // Check if commands directory exists and has files
        let commands_dir = cursor_dir.join("commands");
        if commands_dir.exists() && commands_dir.read_dir().map(|mut d| d.next().is_some()).unwrap_or(false) {
            return Ok(AgentStatus::Configured);
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true // Cursor supports .cursor/rules.md in projects
    }
}
