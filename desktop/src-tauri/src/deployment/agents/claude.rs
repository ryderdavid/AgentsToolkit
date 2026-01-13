//! Claude agent deployer
//!
//! Handles deployment of AGENTS.md and custom commands to Claude.

use std::fs;
use std::path::PathBuf;

use crate::deployment::command_loader;
use crate::deployment::converters::MarkdownConverter;
use crate::deployment::deployer::{
    AgentDeployer, AgentStatus, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, TargetLevel, ValidationReport,
};
use crate::deployment::error::{DeploymentError, DeploymentResult};
use crate::deployment::project::ProjectDetector;
use crate::deployment::state::DeploymentState;
use crate::deployment::validator::DeploymentValidator;
use crate::deployment::{collect_out_references_for_selection, generate_agents_md_content, BaseDeployer};
use crate::fs_manager;
use crate::symlink;
use crate::types::AgentDefinition;

/// Deployer for Claude CLI
pub struct ClaudeDeployer {
    base: BaseDeployer,
}

impl ClaudeDeployer {
    pub fn new(agent: AgentDefinition) -> Self {
        Self {
            base: BaseDeployer::new(agent),
        }
    }

    /// Get the Claude out-references directory
    fn get_out_references_dir(&self) -> PathBuf {
        self.get_claude_dir().join("references")
    }

    /// Get the Claude config directory
    fn get_claude_dir(&self) -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
    }

    /// Get the Claude commands directory
    fn get_commands_dir(&self) -> PathBuf {
        self.get_claude_dir().join("commands")
    }

    /// Get project-level CLAUDE.md path
    fn get_project_claude_path(&self, project_root: &PathBuf) -> PathBuf {
        project_root.join(".claude").join("CLAUDE.md")
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

    /// Get the build output directory for Claude commands
    fn get_build_dir(&self) -> DeploymentResult<PathBuf> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let build_dir = agentsmd_home.join("build").join("claude").join("commands");
        fs::create_dir_all(&build_dir).map_err(|e| {
            DeploymentError::fs_error(&build_dir, format!("Failed to create build directory: {}", e))
        })?;
        Ok(build_dir)
    }
}

impl AgentDeployer for ClaudeDeployer {
    fn agent_id(&self) -> &str {
        &self.base.agent().id
    }

    fn agent_definition(&self) -> &AgentDefinition {
        self.base.agent()
    }

    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        // Generate AGENTS.md content with YAML frontmatter
        let agents_md_content = generate_agents_md_content(&config.pack_ids, false)?;

        // Add frontmatter for Claude
        let mut frontmatter = std::collections::HashMap::new();
        frontmatter.insert("name".to_string(), "AGENTS.md Rules".to_string());
        frontmatter.insert("version".to_string(), "2.0".to_string());

        let content_with_frontmatter = MarkdownConverter::add_frontmatter(&agents_md_content, frontmatter);

        let mut prepared = PreparedDeployment::new(content_with_frontmatter);
        prepared.command_format = "markdown-frontmatter".to_string();

        // Add AGENTS.md path to target_paths for backup
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        prepared.add_target_path(agents_md_source);

        // Collect out-references used by commands/packs
        let resolved_refs = collect_out_references_for_selection(
            &config.custom_command_ids,
            &config.pack_ids,
        )?;
        if !resolved_refs.is_empty() {
            let out_ref_dir = self.get_out_references_dir();
            prepared.add_target_path(out_ref_dir.clone());
            for resolved in &resolved_refs {
                prepared.add_out_reference(resolved.file_path.clone(), resolved.content.clone());
                prepared.add_target_path(out_ref_dir.join(&resolved.file_path));
            }
        }

        // Branch on target level for destination paths
        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: .claude/CLAUDE.md
                let project_root = self.resolve_project_path(config)?;
                let project_claude_path = self.get_project_claude_path(&project_root);
                prepared.add_target_path(project_claude_path);
            }
            TargetLevel::User => {
                // User-level: CLAUDE.md symlink in ~/.claude/
                let claude_dir = self.get_claude_dir();
                prepared.add_target_path(claude_dir.join("CLAUDE.md"));

                // Prepare custom commands with frontmatter
                let commands_dir = self.get_commands_dir();
                for command_id in &config.custom_command_ids {
                    match command_loader::load_command_for_deployment(command_id, self.agent_id()) {
                        Ok((filename, content)) => {
                            prepared.add_command(filename.clone(), content);

                            // Add each command file path for backup
                            let command_path = commands_dir.join(&filename);
                            prepared.add_target_path(command_path);
                        }
                        Err(e) => {
                            log::warn!(
                                "Failed to load command '{}' for Claude deployment: {}",
                                command_id,
                                e
                            );
                            let fallback_content = MarkdownConverter::to_claude_command(
                                command_id,
                                &format!("Custom command: {}", command_id),
                                "Execute this command to perform the specified action.",
                            );
                            let fallback_name = format!("{}.md", command_id);
                            prepared.add_command(fallback_name.clone(), fallback_content);

                            let command_path = commands_dir.join(fallback_name);
                            prepared.add_target_path(command_path);
                        }
                    }
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
        // Check character limit (200K for Claude)
        let limit = self.character_limit();
        let agents_chars = prepared.agents_md_content.len() as u64;
        let command_chars: u64 = prepared
            .commands
            .values()
            .map(|c| c.len() as u64)
            .sum();
        let validation =
            DeploymentValidator::validate_full_budget(agents_chars, command_chars, prepared.out_reference_chars(), limit);

        let mut warnings = validation.warnings;
        let mut errors = validation.errors;

        // Validate frontmatter presence
        let fm_validation = DeploymentValidator::validate_frontmatter(&prepared.agents_md_content);
        if !fm_validation.valid {
            warnings.extend(fm_validation.errors); // Frontmatter is recommended, not required
        }

        // Validate command frontmatter
        for (name, content) in &prepared.commands {
            let cmd_validation = DeploymentValidator::validate_frontmatter(content);
            if !cmd_validation.valid {
                warnings.push(format!("Command '{}' should have YAML frontmatter", name));
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

        // Write AGENTS.md content to ~/.agentsmd/AGENTS.md
        let agentsmd_home = fs_manager::ensure_agentsmd_dir()
            .map_err(|e| DeploymentError::fs_error(PathBuf::new(), e.to_string()))?;
        let agents_md_source = agentsmd_home.join("AGENTS.md");
        
        fs::write(&agents_md_source, &prepared.agents_md_content).map_err(|e| {
            DeploymentError::fs_error(&agents_md_source, format!("Failed to write AGENTS.md: {}", e))
        })?;
        deployed_files.push(agents_md_source.to_string_lossy().to_string());

        match config.target_level {
            TargetLevel::Project => {
                // Project-level deployment: create .claude/CLAUDE.md
                let project_root = self.resolve_project_path(config)?;
                let project_claude_path = self.get_project_claude_path(&project_root);
                
                // Ensure .claude directory exists
                if let Some(parent) = project_claude_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| {
                        DeploymentError::fs_error(parent, format!("Failed to create .claude directory: {}", e))
                    })?;
                }

                // Create symlink from .claude/CLAUDE.md to ~/.agentsmd/AGENTS.md
                match symlink::create_link(project_claude_path.clone(), agents_md_source.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(project_claude_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &project_claude_path,
                            format!("Failed to create symlink: {}", e),
                        ));
                    }
                }

                manual_steps.push(format!(
                    "Project-level rules deployed to {}. Claude will automatically read this file.",
                    project_claude_path.display()
                ));
            }
            TargetLevel::User => {
                // User-level deployment
                let claude_dir = self.get_claude_dir();

                // Ensure Claude directory exists
                fs::create_dir_all(&claude_dir).map_err(|e| {
                    DeploymentError::fs_error(&claude_dir, format!("Failed to create Claude directory: {}", e))
                })?;

                // Create symlink at ~/.claude/CLAUDE.md pointing to AGENTS.md
                let claude_md_path = claude_dir.join("CLAUDE.md");
                match symlink::create_link(claude_md_path.clone(), agents_md_source.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(claude_md_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &claude_md_path,
                            format!("Failed to create symlink: {}", e),
                        ));
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
            }
        }

        // Deploy out-references (symlinks into ~/.claude/references)
        if !prepared.out_references.is_empty() {
            let out_ref_dir = self.get_out_references_dir();
            fs::create_dir_all(&out_ref_dir).map_err(|e| {
                DeploymentError::fs_error(&out_ref_dir, format!("Failed to create references directory: {}", e))
            })?;

            for (rel_path, _content) in &prepared.out_references {
                let source_path = fs_manager::get_agentsmd_home()
                    .join("out-references")
                    .join(rel_path);
                let dest_path = out_ref_dir.join(rel_path);

                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent).ok();
                }

                match symlink::create_link(dest_path.clone(), source_path.clone(), config.force_overwrite) {
                    Ok((_, warning)) => {
                        deployed_files.push(dest_path.to_string_lossy().to_string());
                        if let Some(w) = warning {
                            warnings.push(w);
                        }
                    }
                    Err(e) => {
                        return Err(DeploymentError::fs_error(
                            &dest_path,
                            format!("Failed to deploy out-reference: {}", e),
                        ));
                    }
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
                }
            }
        }

        Ok(())
    }

    fn get_status(&self) -> DeploymentResult<AgentStatus> {
        let claude_dir = self.get_claude_dir();

        if !claude_dir.exists() {
            return Ok(AgentStatus::NotInstalled);
        }

        // Check if CLAUDE.md exists
        let claude_md = claude_dir.join("CLAUDE.md");
        if claude_md.exists() {
            return Ok(AgentStatus::Configured);
        }

        Ok(AgentStatus::Installed)
    }

    fn supports_project_level(&self) -> bool {
        true // Claude supports .claude/CLAUDE.md in projects
    }
}
