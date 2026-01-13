//! OpenAI Codex agent deployer
//!
//! Handles deployment of AGENTS.md and prompts to Codex CLI.

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
use crate::symlink;
use crate::types::AgentDefinition;

/// Deployer for OpenAI Codex CLI
pub struct CodexDeployer {
    base: BaseDeployer,
}

impl CodexDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Codex config directory
    fn get_codex_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".codex")
    }

    /// Get the prompts directory
    fn get_prompts_dir(&self) -> PathBuf {
        self.get_codex_dir().join("prompts")
    }

    /// Get the build output directory
    fn get_build_dir(&self) -> DeploymentResult<PathBuf> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let build_dir = agentsmd_home.join("build").join("codex").join("prompts");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for CodexDeployer {
    fn agent_id(&self) -> &str {
        &self.base.agent().id
    }

    fn agent_definition(&self) -> &AgentDefinition {
        self.base.agent()
    }

    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        // Generate AGENTS.md content with frontmatter
        let agents_md_content = generate_agents_md_content(&config.pack_ids, false)?;

        let mut frontmatter = std::collections::HashMap::new();
        frontmatter.insert("name".to_string(), "/prompts:agents".to_string());
        frontmatter.insert("description".to_string(), "AGENTS.md mandatory rules".to_string());

        let content_with_frontmatter = MarkdownConverter::add_frontmatter(&agents_md_content, frontmatter);

        let mut prepared = PreparedDeployment::new(content_with_frontmatter);
        prepared.command_format = "prompts-prefix".to_string();

        // Add AGENTS.md path to target_paths for backup
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        prepared.add_target_path(agents_md_source);

        // Add agents.md prompt symlink path for backup
        let prompts_dir = self.get_prompts_dir();
        let agents_prompt_path = prompts_dir.join("agents.md");
        prepared.add_target_path(agents_prompt_path);

        // Prepare custom commands with /prompts: prefix
        for command_id in &config.custom_command_ids {
            let command_content = MarkdownConverter::to_codex_prompt(
                command_id,
                &format!("Custom prompt: {}", command_id),
                "Execute this prompt to perform the specified action.",
            );
            prepared.add_command(format!("{}.md", command_id), command_content);
            
            // Add each prompt file path for backup
            let prompt_path = prompts_dir.join(format!("{}.md", command_id));
            prepared.add_target_path(prompt_path);
        }

        // Add prompts directory if we have custom commands
        if !config.custom_command_ids.is_empty() {
            prepared.add_target_path(prompts_dir);
        }

        Ok(prepared)
    }

    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport> {
        // Codex has ~50K character limit
        let limit = self.character_limit().or(Some(50_000));
        let validation = DeploymentValidator::validate_character_budget(
            &prepared.agents_md_content,
            limit,
        );

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate frontmatter presence
        let fm_validation = DeploymentValidator::validate_frontmatter(&prepared.agents_md_content);
        if !fm_validation.valid {
            warnings.push("Content should have YAML frontmatter for Codex".to_string());
        }

        // Validate command naming
        for (name, content) in &prepared.commands {
            let fm_validation = DeploymentValidator::validate_frontmatter(content);
            if !fm_validation.valid {
                errors.push(format!("Command '{}' must have YAML frontmatter", name));
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

        let codex_dir = self.get_codex_dir();
        let prompts_dir = self.get_prompts_dir();

        // Ensure directories exist
        fs::create_dir_all(&prompts_dir).map_err(|e| {
            DeploymentError::fs_error(&prompts_dir, format!("Failed to create prompts directory: {}", e))
        })?;

        // Write AGENTS.md to ~/.agentsmd/
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_source, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_source, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_source.to_string_lossy().to_string());

        // Create agents.md prompt symlink
        let agents_prompt_path = prompts_dir.join("agents.md");
        match symlink::create_link(agents_prompt_path.clone(), agents_md_source.clone(), config.force_overwrite) {
            Ok((_, warning)) => {
                deployed_files.push(agents_prompt_path.to_string_lossy().to_string());
                if let Some(w) = warning {
                    warnings.push(w);
                }
            }
            Err(e) => {
                return Err(DeploymentError::fs_error(
                    &agents_prompt_path,
                    format!("Failed to create symlink: {}", e),
                ));
            }
        }

        // Deploy custom prompts
        if !prepared.commands.is_empty() {
            let build_dir = self.get_build_dir()?;

            for (name, content) in &prepared.commands {
                let build_path = build_dir.join(name);
                fs::write(&build_path, content).map_err(|e| {
                    DeploymentError::fs_error(&build_path, format!("Failed to write prompt: {}", e))
                })?;

                let link_path = prompts_dir.join(name);
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

        Ok(DeploymentOutput::success("symlink", deployed_files).with_warnings(warnings))
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
        let codex_dir = self.get_codex_dir();

        if !codex_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        let prompts_dir = self.get_prompts_dir();
        if prompts_dir.exists() {
            let agents_prompt = prompts_dir.join("agents.md");
            if agents_prompt.exists() {
                return Ok(AgentStatus::Configured);
            }
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        false // Codex uses global prompts
    }
}
