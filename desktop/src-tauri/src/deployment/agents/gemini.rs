//! Gemini/Antigravity agent deployer
//!
//! Handles deployment of AGENTS.md and custom commands to Gemini CLI and Antigravity.

use std::fs;
use std::path::PathBuf;

use crate::deployment::converters::MarkdownConverter;
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

/// Deployer for Gemini CLI
pub struct GeminiDeployer {
    base: BaseDeployer,
    is_antigravity: bool,
}

impl GeminiDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
            is_antigravity: false,
        }
    }

    pub fn new_antigravity(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
            is_antigravity: true,
        }
    }

    /// Get the Gemini config directory
    fn get_gemini_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".gemini")
    }

    /// Get the commands directory
    fn get_commands_dir(&self) -> PathBuf {
        self.get_gemini_dir().join("commands")
    }

    /// Get the scripts directory for sandbox access
    fn get_scripts_dir(&self) -> PathBuf {
        self.get_gemini_dir().join("scripts")
    }

    /// Get the Antigravity workflows directory
    fn get_workflows_dir(&self) -> PathBuf {
        self.get_gemini_dir().join("antigravity").join("global_workflows")
    }

    /// Get project-level GEMINI.md path
    fn get_project_gemini_path(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".gemini").join("GEMINI.md")
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
        let build_dir = agentsmd_home.join("build").join("gemini").join("commands");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for GeminiDeployer {
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
        prepared.command_format = "toml".to_string();

        // Add AGENTS.md path to target_paths for backup
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        prepared.add_target_path(agents_md_source.clone());

        // Branch on target level for destination paths
        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: .gemini/GEMINI.md
                let project_root = self.resolve_project_path(config)?;
                let project_gemini_path = self.get_project_gemini_path(&project_root);
                prepared.add_target_path(project_gemini_path);
            }
            TargetLevel::User => {
                // User-level: GEMINI.md in ~/.gemini/
                let gemini_dir = self.get_gemini_dir();
                prepared.add_target_path(gemini_dir.join("GEMINI.md"));

                // Add scripts symlink path for backup if it exists
                let scripts_source = agentsmd_home.join("scripts");
                if scripts_source.exists() {
                    prepared.add_target_path(self.get_scripts_dir());
                }

                // Prepare custom commands as TOML files
                let commands_dir = self.get_commands_dir();
                for command_id in &config.custom_command_ids {
                    let mut frontmatter = std::collections::HashMap::new();
                    frontmatter.insert("name".to_string(), command_id.clone());
                    frontmatter.insert("description".to_string(), format!("Custom command: {}", command_id));

                    let command_content = MarkdownConverter::to_toml(
                        "Execute this command to perform the specified action.",
                        Some(frontmatter),
                    )?;
                    prepared.add_command(format!("{}.toml", command_id), command_content);
                    
                    // Add each command file path for backup
                    let command_path = commands_dir.join(format!("{}.toml", command_id));
                    prepared.add_target_path(command_path);
                }

                // Add commands directory if we have commands
                if !config.custom_command_ids.is_empty() {
                    prepared.add_target_path(commands_dir);
                }

                if self.is_antigravity {
                    prepared.add_target_path(self.get_workflows_dir());
                }
            }
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Check character limit (1M for Gemini)
        let limit = self.character_limit();
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate TOML syntax for commands
        for (name, content) in &prepared.commands {
            if name.ends_with(".toml") {
                match content.parse::<toml::Value>() {
                    Ok(_) => {}
                    Err(e) => {
                        errors.push(format!("Invalid TOML in command '{}': {}", name, e));
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
                // Project-level deployment: create .gemini/GEMINI.md
                let project_root = self.resolve_project_path(config)?;
                let project_gemini_path = self.get_project_gemini_path(&project_root);
                
                // Ensure .gemini directory exists
                if let Some(parent) = project_gemini_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| {
                        DeploymentError::fs_error(parent, format!("Failed to create .gemini directory: {}", e))
                    })?;
                }

                // Create GEMINI.md with import reference in project
                let gemini_md_content = format!(
                    "# Gemini Configuration\n\n\
                     This file imports AGENTS.md rules.\n\n\
                     @{}\n",
                    agents_md_source.to_string_lossy()
                );
                fs::write(&project_gemini_path, gemini_md_content).map_err(|e| {
                    DeploymentError::fs_error(&project_gemini_path, format!("Failed to write GEMINI.md: {}", e))
                })?;
                deployed_files.push(project_gemini_path.to_string_lossy().to_string());

                manual_steps.push(format!(
                    "Project-level rules deployed to {}. Gemini will automatically read this file.",
                    project_gemini_path.display()
                ));
            }
            TargetLevel::User => {
                // User-level deployment
                let gemini_dir = self.get_gemini_dir();

                // Ensure directories exist
                fs::create_dir_all(&gemini_dir).map_err(|e| {
                    DeploymentError::fs_error(&gemini_dir, format!("Failed to create Gemini directory: {}", e))
                })?;

                // Create GEMINI.md with import reference
                let gemini_md_path = gemini_dir.join("GEMINI.md");
                let gemini_md_content = format!(
                    "# Gemini Configuration\n\n\
                     This file imports AGENTS.md rules.\n\n\
                     @{}\n",
                    agents_md_source.to_string_lossy()
                );
                fs::write(&gemini_md_path, gemini_md_content).map_err(|e| {
                    DeploymentError::fs_error(&gemini_md_path, format!("Failed to write GEMINI.md: {}", e))
                })?;
                deployed_files.push(gemini_md_path.to_string_lossy().to_string());

                // Symlink scripts directory for sandbox access
                let scripts_source = agentsmd_home.join("scripts");
                let scripts_target = self.get_scripts_dir();
                if scripts_source.exists() {
                    fs::create_dir_all(scripts_target.parent().unwrap_or(&gemini_dir)).ok();
                    match symlink::create_link(scripts_target.clone(), scripts_source.clone(), config.force_overwrite) {
                        Ok((_, warning)) => {
                            deployed_files.push(scripts_target.to_string_lossy().to_string());
                            if let Some(w) = warning {
                                warnings.push(w);
                            }
                        }
                        Err(e) => {
                            warnings.push(format!("Could not link scripts directory: {}", e));
                        }
                    }
                }

                // Deploy custom commands
                if !prepared.commands.is_empty() {
                    let build_dir = self.get_build_dir()?;
                    let commands_dir = self.get_commands_dir();

                    fs::create_dir_all(&commands_dir).map_err(|e| {
                        DeploymentError::fs_error(&commands_dir, format!("Failed to create commands directory: {}", e))
                    })?;

                    for (name, content) in &prepared.commands {
                        let build_path = build_dir.join(name);
                        fs::write(&build_path, content).map_err(|e| {
                            DeploymentError::fs_error(&build_path, format!("Failed to write command: {}", e))
                        })?;

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

                // Antigravity-specific: Link global workflows
                if self.is_antigravity {
                    let workflows_dir = self.get_workflows_dir();
                    fs::create_dir_all(&workflows_dir).map_err(|e| {
                        DeploymentError::fs_error(&workflows_dir, format!("Failed to create workflows directory: {}", e))
                    })?;
                    // Workflows would be linked from the build directory if they exist
                }
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
                } else if path.is_dir() {
                    fs::remove_dir_all(&path).map_err(|e| {
                        DeploymentError::RollbackFailed(format!(
                            "Failed to remove directory {}: {}",
                            file_path, e
                        ))
                    })?;
                }
            }
        }

        Ok(())
    }

    fn get_status(&self) -> DeploymentResult<AgentStatus> {
        let gemini_dir = self.get_gemini_dir();

        if !gemini_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        let gemini_md = gemini_dir.join("GEMINI.md");
        if gemini_md.exists() {
            return Ok(AgentStatus::Configured);
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true
    }
}
