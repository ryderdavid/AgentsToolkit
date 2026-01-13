//! Deployment validation logic
//!
//! Provides validation utilities for checking character limits, format requirements,
//! and other constraints before deployment.

use super::converters::FileFormat;
use super::deployer::{BudgetUsage, ValidationReport};
use super::error::{DeploymentError, DeploymentResult};
use crate::fs_manager;

/// Validates deployment configurations and content
pub struct DeploymentValidator;

impl DeploymentValidator {
    /// Validate content against character budget
    pub fn validate_character_budget(
        content: &str,
        limit: Option<u64>,
    ) -> ValidationResult {
        let current = content.len() as u64;

        match limit {
            Some(max) => {
                let percentage = (current as f64 / max as f64) * 100.0;
                let within_limit = current <= max;

                let mut warnings = Vec::new();
                let mut errors = Vec::new();

                if !within_limit {
                    errors.push(format!(
                        "Content exceeds character limit: {} / {} ({:.1}%)",
                        current, max, percentage
                    ));
                } else if percentage > 80.0 {
                    warnings.push(format!(
                        "Content uses {:.1}% of character limit ({} / {})",
                        percentage, current, max
                    ));
                }

                ValidationResult {
                    valid: within_limit,
                    errors,
                    warnings,
                    budget: BudgetUsage {
                        current_chars: current,
                        max_chars: Some(max),
                        percentage: Some(percentage),
                        within_limit,
                    },
                }
            }
            None => ValidationResult {
                valid: true,
                errors: Vec::new(),
                warnings: Vec::new(),
                budget: BudgetUsage::unlimited(current),
            },
        }
    }

    /// Validate file format
    pub fn validate_file_format(content: &str, expected_format: FileFormat) -> ValidationResult {
        let errors = match expected_format {
            FileFormat::Json => {
                match serde_json::from_str::<serde_json::Value>(content) {
                    Ok(_) => Vec::new(),
                    Err(e) => vec![format!("Invalid JSON: {}", e)],
                }
            }
            FileFormat::Yaml => {
                match serde_yaml::from_str::<serde_yaml::Value>(content) {
                    Ok(_) => Vec::new(),
                    Err(e) => vec![format!("Invalid YAML: {}", e)],
                }
            }
            FileFormat::Toml => {
                match content.parse::<toml::Value>() {
                    Ok(_) => Vec::new(),
                    Err(e) => vec![format!("Invalid TOML: {}", e)],
                }
            }
            FileFormat::Markdown => {
                // Markdown is always valid
                Vec::new()
            }
        };

        ValidationResult {
            valid: errors.is_empty(),
            errors,
            warnings: Vec::new(),
            budget: BudgetUsage::unlimited(content.len() as u64),
        }
    }

    /// Validate that content has YAML frontmatter
    pub fn validate_frontmatter(content: &str) -> ValidationResult {
        let has_frontmatter = content.starts_with("---\n") && content[4..].contains("\n---");

        let errors = if !has_frontmatter {
            vec!["Content must have YAML frontmatter (---\n...\n---)".to_string()]
        } else {
            Vec::new()
        };

        ValidationResult {
            valid: has_frontmatter,
            errors,
            warnings: Vec::new(),
            budget: BudgetUsage::unlimited(content.len() as u64),
        }
    }

    /// Validate command format
    pub fn validate_command_format(
        command_name: &str,
        command_content: &str,
        expected_format: CommandFormat,
    ) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        match expected_format {
            CommandFormat::Slash => {
                // Slash commands should start with /
                if !command_name.starts_with('/') {
                    warnings.push(format!(
                        "Slash command '{}' should start with '/'",
                        command_name
                    ));
                }
            }
            CommandFormat::PromptsPrefix => {
                // Prompts should start with /prompts:
                if !command_name.starts_with("/prompts:") {
                    errors.push(format!(
                        "Command '{}' should start with '/prompts:'",
                        command_name
                    ));
                }
            }
            CommandFormat::Cli => {
                // CLI commands should be simple identifiers
                if command_name.contains(' ') || command_name.contains('/') {
                    warnings.push(format!(
                        "CLI command '{}' should be a simple identifier",
                        command_name
                    ));
                }
            }
            CommandFormat::Workflow => {
                // Workflows should be valid YAML
                if let Err(e) = serde_yaml::from_str::<serde_yaml::Value>(command_content) {
                    errors.push(format!("Invalid workflow YAML: {}", e));
                }
            }
            CommandFormat::Inline => {
                // Inline commands have no format restrictions
            }
        }

        ValidationResult {
            valid: errors.is_empty(),
            errors,
            warnings,
            budget: BudgetUsage::unlimited(command_content.len() as u64),
        }
    }

    /// Check if an agent is installed on the system
    pub fn validate_agent_installed(agent_id: &str) -> DeploymentResult<ValidationResult> {
        let config_path = fs_manager::get_agent_config_path(agent_id.to_string())
            .map_err(|e| DeploymentError::ConfigurationError(e.to_string()))?;

        // Check if the parent directory exists (agent installation)
        let agent_installed = config_path.parent().map(|p| p.exists()).unwrap_or(false);

        let (errors, warnings) = if agent_installed {
            (Vec::new(), Vec::new())
        } else {
            (
                vec![format!("Agent '{}' does not appear to be installed", agent_id)],
                Vec::new(),
            )
        };

        Ok(ValidationResult {
            valid: agent_installed,
            errors,
            warnings,
            budget: BudgetUsage::default(),
        })
    }

    /// Combine multiple validation results
    pub fn combine(results: Vec<ValidationResult>) -> ValidationResult {
        let mut combined = ValidationResult {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            budget: BudgetUsage::default(),
        };

        for result in results {
            combined.valid = combined.valid && result.valid;
            combined.errors.extend(result.errors);
            combined.warnings.extend(result.warnings);
            // Use the last budget (typically the one that matters most)
            combined.budget = result.budget;
        }

        combined
    }
}

/// Result of a validation check
#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub budget: BudgetUsage,
}

impl ValidationResult {
    pub fn success() -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            budget: BudgetUsage::default(),
        }
    }

    pub fn failure(error: impl Into<String>) -> Self {
        Self {
            valid: false,
            errors: vec![error.into()],
            warnings: Vec::new(),
            budget: BudgetUsage::default(),
        }
    }

    pub fn with_budget(mut self, budget: BudgetUsage) -> Self {
        self.budget = budget;
        self
    }

    pub fn into_report(self) -> ValidationReport {
        ValidationReport {
            valid: self.valid,
            errors: self.errors,
            warnings: self.warnings,
            budget_usage: self.budget,
        }
    }
}

/// Command format types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommandFormat {
    /// Slash commands (e.g., /command)
    Slash,
    /// Prompts prefix (e.g., /prompts:command)
    PromptsPrefix,
    /// CLI commands (e.g., command-name)
    Cli,
    /// Workflow format (YAML structure)
    Workflow,
    /// Inline format (no specific structure)
    Inline,
}

impl CommandFormat {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "slash" => CommandFormat::Slash,
            "prompts-prefix" => CommandFormat::PromptsPrefix,
            "cli" => CommandFormat::Cli,
            "workflow" => CommandFormat::Workflow,
            "inline" => CommandFormat::Inline,
            _ => CommandFormat::Inline,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_character_budget_within_limit() {
        let result = DeploymentValidator::validate_character_budget("Hello", Some(100));
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_character_budget_over_limit() {
        let result = DeploymentValidator::validate_character_budget("Hello World", Some(5));
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_character_budget_warning() {
        // Create a string that's 85% of limit
        let content = "x".repeat(85);
        let result = DeploymentValidator::validate_character_budget(&content, Some(100));
        assert!(result.valid);
        assert!(!result.warnings.is_empty());
    }

    #[test]
    fn test_validate_frontmatter() {
        let with_fm = "---\nkey: value\n---\nContent";
        let without_fm = "Just content";

        assert!(DeploymentValidator::validate_frontmatter(with_fm).valid);
        assert!(!DeploymentValidator::validate_frontmatter(without_fm).valid);
    }
}
