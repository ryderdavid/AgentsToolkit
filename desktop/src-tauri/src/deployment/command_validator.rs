//! Command validation for deployment
//!
//! Validates command compatibility with agents and deployment constraints.

use std::path::PathBuf;

use crate::command_registry;
use crate::fs_manager;
use crate::types::{AgentDefinition, CommandMetadata};

use super::error::{DeploymentError, DeploymentResult};

/// Result of command validation
#[derive(Debug, Clone)]
pub struct CommandValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl CommandValidationResult {
    pub fn success() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn with_warning(mut self, warning: String) -> Self {
        self.warnings.push(warning);
        self
    }

    pub fn with_error(mut self, error: String) -> Self {
        self.errors.push(error);
        self.valid = false;
        self
    }
}

/// Validate a single command for an agent
pub fn validate_command_for_agent(
    command: &CommandMetadata,
    agent: &AgentDefinition,
) -> CommandValidationResult {
    let mut result = CommandValidationResult::success();

    // Check if command format is supported by agent
    let format_compatible = match agent.command_format.as_str() {
        "slash" => true, // Slash commands work with most command types
        "prompts-prefix" => true,
        "cli" => command.category == "utility" || command.category == "git",
        "workflow" => command.category == "workflow",
        "inline" => true,
        _ => true,
    };

    if !format_compatible {
        result = result.with_warning(format!(
            "Command '{}' may not work optimally with {}'s {} format",
            command.id, agent.name, agent.command_format
        ));
    }

    // Check explicit compatibility list
    if !command.agent_compatibility.is_empty()
        && !command.agent_compatibility.contains(&agent.id)
    {
        result = result.with_error(format!(
            "Command '{}' is not compatible with agent '{}'",
            command.id, agent.id
        ));
    }

    // Check if agent supports out-references when command has them
    if !command.out_references.is_empty() && !agent.character_limits.supports_out_references {
        result = result.with_error(format!(
            "Agent '{}' does not support out-references required by command '{}'",
            agent.id, command.id
        ));
    }

    // Check character limits
    if let Some(max_chars) = agent.character_limits.max_chars {
        if command.character_count > max_chars {
            result = result.with_error(format!(
                "Command '{}' exceeds character limit for '{}' ({} > {})",
                command.id, agent.id, command.character_count, max_chars
            ));
        } else if command.character_count > (max_chars * 80 / 100) {
            result = result.with_warning(format!(
                "Command '{}' uses {}% of {}'s character limit",
                command.id,
                (command.character_count * 100) / max_chars,
                agent.id
            ));
        }
    }

    // Check if script path exists
    if !command.script_path.is_empty() {
        let script_path = expand_path(&command.script_path);
        if !script_path.exists() {
            result = result.with_warning(format!(
                "Script path '{}' for command '{}' does not exist",
                command.script_path, command.id
            ));
        }
    }

    // Check if command requires GitHub
    if command.requires_github {
        result = result.with_warning(format!(
            "Command '{}' requires GitHub CLI (gh) to be authenticated",
            command.id
        ));
    }

    // Validate out-references are accessible
    for ref_path in &command.out_references {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let full_path = agentsmd_home.join(ref_path);
        if !full_path.exists() {
            result = result.with_warning(format!(
                "Out-reference '{}' for command '{}' not found",
                ref_path, command.id
            ));
        }
    }

    result
}

/// Validate a set of commands for an agent
pub fn validate_command_set(
    commands: &[CommandMetadata],
    agent: &AgentDefinition,
) -> CommandValidationResult {
    let mut result = CommandValidationResult::success();
    let mut total_chars: u64 = 0;

    for command in commands {
        let cmd_result = validate_command_for_agent(command, agent);
        result.errors.extend(cmd_result.errors);
        result.warnings.extend(cmd_result.warnings);
        total_chars += command.character_count;
    }

    // Check combined character limit
    if let Some(max_chars) = agent.character_limits.max_chars {
        if total_chars > max_chars {
            result = result.with_error(format!(
                "Combined commands ({} chars) exceed {}'s character limit ({} chars)",
                total_chars, agent.id, max_chars
            ));
        } else if total_chars > (max_chars * 80 / 100) {
            result = result.with_warning(format!(
                "Combined commands use {}% of {}'s character limit",
                (total_chars * 100) / max_chars,
                agent.id
            ));
        }
    }

    if !result.errors.is_empty() {
        result.valid = false;
    }

    result
}

/// Validate commands by IDs for an agent
pub fn validate_commands_for_agent(
    command_ids: &[String],
    agent_id: &str,
) -> DeploymentResult<CommandValidationResult> {
    let agents = fs_manager::load_agent_registry()
        .map_err(|e| DeploymentError::ConfigurationError(e.to_string()))?;

    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| DeploymentError::agent_not_found(agent_id))?;

    let mut commands = Vec::new();
    for command_id in command_ids {
        let command = command_registry::get_command_by_id(command_id)
            .map_err(|e| DeploymentError::ConfigurationError(e))?;
        commands.push(command);
    }

    Ok(validate_command_set(&commands, agent))
}

/// Expand ~ to home directory
fn expand_path(path: &str) -> PathBuf {
    if let Some(stripped) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(stripped);
        }
    }
    PathBuf::from(path)
}

/// Check if a command is deprecated
pub fn is_command_deprecated(command_id: &str) -> bool {
    // Add deprecated command IDs here
    let deprecated_commands = [
        // None yet
    ];

    deprecated_commands.contains(&command_id)
}

/// Get replacement for deprecated command
pub fn get_deprecated_command_replacement(command_id: &str) -> Option<String> {
    // Map deprecated commands to their replacements
    match command_id {
        // None yet
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::CharacterLimits;

    fn create_test_agent(supports_out_refs: bool, max_chars: Option<u64>) -> AgentDefinition {
        AgentDefinition {
            id: "test-agent".to_string(),
            name: "Test Agent".to_string(),
            config_paths: vec!["~/.test/commands".to_string()],
            agents_md_support: "native".to_string(),
            command_format: "slash".to_string(),
            character_limits: CharacterLimits {
                max_chars,
                supports_out_references: supports_out_refs,
            },
            deployment_strategy: "symlink".to_string(),
            build_output: "test/commands".to_string(),
            file_format: "markdown".to_string(),
            requires_frontmatter: Some(false),
            sandbox_script_path: None,
            notes: None,
        }
    }

    fn create_test_command(chars: u64, out_refs: bool) -> CommandMetadata {
        CommandMetadata {
            id: "test-command".to_string(),
            name: "Test Command".to_string(),
            description: "A test command".to_string(),
            script_path: "~/.agentsmd/scripts/test.py".to_string(),
            agent_compatibility: Vec::new(),
            requires_github: false,
            out_references: if out_refs {
                vec!["rule-packs/core/test.md".to_string()]
            } else {
                Vec::new()
            },
            category: "utility".to_string(),
            template: None,
            character_count: chars,
            word_count: chars / 5,
            source_path: "commands/src/test.md".to_string(),
        }
    }

    #[test]
    fn test_validate_command_within_limits() {
        let agent = create_test_agent(true, Some(10000));
        let command = create_test_command(1000, false);

        let result = validate_command_for_agent(&command, &agent);
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_command_exceeds_limits() {
        let agent = create_test_agent(true, Some(1000));
        let command = create_test_command(2000, false);

        let result = validate_command_for_agent(&command, &agent);
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_command_out_refs_not_supported() {
        let agent = create_test_agent(false, Some(10000));
        let command = create_test_command(1000, true);

        let result = validate_command_for_agent(&command, &agent);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("out-references")));
    }
}
