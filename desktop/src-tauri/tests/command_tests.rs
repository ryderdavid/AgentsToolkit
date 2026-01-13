//! Command management tests
//!
//! Unit tests for command loading, parsing, and validation.

#[cfg(test)]
mod tests {
    use agentstoolkit_desktop::command_registry;
    use agentstoolkit_desktop::types::*;

    #[test]
    fn test_load_commands_returns_vec() {
        // This test verifies that load_commands returns a valid vector
        // even if the commands directory is empty
        let result = command_registry::load_commands();
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_command_by_id_not_found() {
        let result = command_registry::get_command_by_id("nonexistent-command");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_commands_by_category() {
        // Should return empty vec for unknown category
        let result = command_registry::get_commands_by_category("unknown");
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_validate_command_for_agent_not_found() {
        // Should return error for nonexistent command
        let result = command_registry::validate_command_for_agent(
            "nonexistent-command",
            "cursor"
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_command_budget_empty() {
        let result = command_registry::calculate_command_budget(&[]);
        assert!(result.is_ok());
        let budget = result.unwrap();
        assert_eq!(budget.total_chars, 0);
        assert!(budget.command_breakdown.is_empty());
    }

    #[test]
    fn test_clear_cache_succeeds() {
        // Should not panic
        command_registry::clear_cache();
    }
}

#[cfg(test)]
mod command_loader_tests {
    use agentstoolkit_desktop::deployment::command_loader;

    #[test]
    fn test_extract_template_no_template() {
        let content = "Simple command without template";
        let result = command_loader::extract_template(content);
        assert!(result.is_none());
    }

    #[test]
    fn test_extract_template_with_template() {
        let content = r#"
Some description

**Template:**
# Template Title

Template content here

**Next Section:**
Something else
"#;
        let result = command_loader::extract_template(content);
        assert!(result.is_some());
        let template = result.unwrap();
        assert!(template.contains("# Template Title"));
        assert!(!template.contains("Next Section"));
    }

    #[test]
    fn test_resolve_out_references() {
        let content = r#"
See [Issue Template](../../rule-packs/github-hygiene/issue-first.md) for formatting.
Also check [Guide](../../docs/guide.md).
External links like [Example](https://example.com) should be ignored.
"#;
        let refs = command_loader::resolve_out_references(content);
        assert_eq!(refs.len(), 2);
    }

    #[test]
    fn test_resolve_out_references_empty() {
        let content = "No references here";
        let refs = command_loader::resolve_out_references(content);
        assert!(refs.is_empty());
    }
}

#[cfg(test)]
mod command_validator_tests {
    use agentstoolkit_desktop::deployment::command_validator;
    use agentstoolkit_desktop::types::{AgentDefinition, CharacterLimits, CommandMetadata};

    fn create_test_agent(max_chars: Option<u64>, supports_out_refs: bool) -> AgentDefinition {
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

    fn create_test_command(chars: u64, has_out_refs: bool) -> CommandMetadata {
        CommandMetadata {
            id: "test-cmd".to_string(),
            name: "Test Command".to_string(),
            description: "A test command".to_string(),
            script_path: "~/.agentsmd/scripts/test.py".to_string(),
            agent_compatibility: Vec::new(),
            requires_github: false,
            out_references: if has_out_refs {
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
        let agent = create_test_agent(Some(10000), true);
        let command = create_test_command(1000, false);

        let result = command_validator::validate_command_for_agent(&command, &agent);
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_command_exceeds_limit() {
        let agent = create_test_agent(Some(500), true);
        let command = create_test_command(1000, false);

        let result = command_validator::validate_command_for_agent(&command, &agent);
        assert!(!result.valid);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_validate_command_out_refs_not_supported() {
        let agent = create_test_agent(Some(10000), false);
        let command = create_test_command(1000, true);

        let result = command_validator::validate_command_for_agent(&command, &agent);
        assert!(!result.valid);
        assert!(result.errors.iter().any(|e| e.contains("out-references")));
    }

    #[test]
    fn test_validate_command_set() {
        let agent = create_test_agent(Some(10000), true);
        let commands = vec![
            create_test_command(1000, false),
            create_test_command(2000, false),
        ];

        let result = command_validator::validate_command_set(&commands, &agent);
        assert!(result.valid);
    }

    #[test]
    fn test_validate_command_set_exceeds_combined_limit() {
        let agent = create_test_agent(Some(1500), true);
        let commands = vec![
            create_test_command(1000, false),
            create_test_command(1000, false),
        ];

        let result = command_validator::validate_command_set(&commands, &agent);
        assert!(!result.valid);
    }
}
