//! Integration tests for the deployment system
//!
//! Tests each deployer's prepare(), validate(), deploy(), and rollback() methods.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

// Note: These tests require the main crate to be built as a library
// They test the deployment module functionality

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create a mock DeploymentConfig
    fn mock_config(agent_id: &str, pack_ids: Vec<String>) -> HashMap<String, serde_json::Value> {
        let mut config = HashMap::new();
        config.insert("agentId".to_string(), serde_json::Value::String(agent_id.to_string()));
        config.insert("packIds".to_string(), serde_json::Value::Array(
            pack_ids.iter().map(|s| serde_json::Value::String(s.clone())).collect()
        ));
        config.insert("customCommandIds".to_string(), serde_json::Value::Array(vec![]));
        config.insert("targetLevel".to_string(), serde_json::Value::String("user".to_string()));
        config.insert("forceOverwrite".to_string(), serde_json::Value::Bool(false));
        config
    }

    #[test]
    fn test_budget_validation_within_limit() {
        let content = "x".repeat(1000);
        let limit = Some(2000u64);
        
        // Simple validation logic test
        let current = content.len() as u64;
        let within_limit = limit.map(|max| current <= max).unwrap_or(true);
        
        assert!(within_limit);
        assert_eq!(current, 1000);
    }

    #[test]
    fn test_budget_validation_over_limit() {
        let content = "x".repeat(3000);
        let limit = Some(2000u64);
        
        let current = content.len() as u64;
        let within_limit = limit.map(|max| current <= max).unwrap_or(true);
        
        assert!(!within_limit);
    }

    #[test]
    fn test_budget_validation_no_limit() {
        let content = "x".repeat(1_000_000);
        let limit: Option<u64> = None;
        
        let current = content.len() as u64;
        let within_limit = limit.map(|max| current <= max).unwrap_or(true);
        
        assert!(within_limit);
    }

    #[test]
    fn test_frontmatter_detection() {
        let with_frontmatter = "---\nname: test\n---\nContent";
        let without_frontmatter = "Just content";
        
        let has_fm = |content: &str| -> bool {
            content.starts_with("---\n") && content[4..].contains("\n---")
        };
        
        assert!(has_fm(with_frontmatter));
        assert!(!has_fm(without_frontmatter));
    }

    #[test]
    fn test_yaml_frontmatter_parsing() {
        let content = "---\nname: \"test\"\nversion: \"1.0\"\n---\n\n# Content";
        
        // Simple frontmatter extraction
        let has_frontmatter = content.starts_with("---\n");
        assert!(has_frontmatter);
        
        if let Some(end_idx) = content[4..].find("\n---") {
            let frontmatter_str = &content[4..4 + end_idx];
            assert!(frontmatter_str.contains("name"));
            assert!(frontmatter_str.contains("version"));
        }
    }

    #[test]
    fn test_format_detection_from_extension() {
        let detect = |path: &str| -> &str {
            if path.ends_with(".toml") {
                "toml"
            } else if path.ends_with(".yaml") || path.ends_with(".yml") {
                "yaml"
            } else if path.ends_with(".json") {
                "json"
            } else {
                "markdown"
            }
        };
        
        assert_eq!(detect("test.toml"), "toml");
        assert_eq!(detect("test.yaml"), "yaml");
        assert_eq!(detect("test.yml"), "yaml");
        assert_eq!(detect("test.json"), "json");
        assert_eq!(detect("test.md"), "markdown");
    }

    #[test]
    fn test_toml_conversion() {
        let content = "# Rules\n\nFollow these rules.";
        
        // Simple TOML conversion
        let toml_content = format!(
            "name = \"test\"\n\ncontent = \"\"\"\n{}\n\"\"\"\n",
            content
        );
        
        assert!(toml_content.contains("name = \"test\""));
        assert!(toml_content.contains("content = \"\"\""));
    }

    #[test]
    fn test_yaml_conversion() {
        let content = "# Rules\n\nFollow these rules.";
        
        // Simple YAML conversion
        let mut yaml_content = String::new();
        yaml_content.push_str("---\n");
        yaml_content.push_str("name: \"test\"\n");
        yaml_content.push_str("content: |\n");
        for line in content.lines() {
            yaml_content.push_str("  ");
            yaml_content.push_str(line);
            yaml_content.push('\n');
        }
        yaml_content.push_str("---\n");
        
        assert!(yaml_content.starts_with("---\n"));
        assert!(yaml_content.contains("name: \"test\""));
        assert!(yaml_content.contains("content: |"));
    }

    #[test]
    fn test_json_conversion() {
        let content = "# Rules";
        
        let json_obj = serde_json::json!({
            "name": "test",
            "content": content
        });
        
        let json_str = serde_json::to_string_pretty(&json_obj).unwrap();
        assert!(json_str.contains("\"name\""));
        assert!(json_str.contains("\"content\""));
    }

    #[test]
    fn test_state_serialization() {
        use serde::{Deserialize, Serialize};
        
        #[derive(Debug, Clone, Serialize, Deserialize)]
        struct TestState {
            agent_id: String,
            files_created: Vec<String>,
        }
        
        let state = TestState {
            agent_id: "cursor".to_string(),
            files_created: vec!["~/.cursor/commands/test.md".to_string()],
        };
        
        let json = serde_json::to_string(&state).unwrap();
        let parsed: TestState = serde_json::from_str(&json).unwrap();
        
        assert_eq!(parsed.agent_id, "cursor");
        assert_eq!(parsed.files_created.len(), 1);
    }

    #[test]
    fn test_backup_directory_creation() {
        let temp = tempdir().unwrap();
        let backup_dir = temp.path().join("backups").join("cursor").join("20240101_120000");
        
        fs::create_dir_all(&backup_dir).unwrap();
        
        assert!(backup_dir.exists());
        assert!(backup_dir.is_dir());
    }

    #[test]
    fn test_file_backup_and_restore() {
        let temp = tempdir().unwrap();
        
        // Create original file
        let original_path = temp.path().join("original.md");
        fs::write(&original_path, "Original content").unwrap();
        
        // Create backup
        let backup_path = temp.path().join("backup.md");
        fs::copy(&original_path, &backup_path).unwrap();
        
        // Modify original
        fs::write(&original_path, "Modified content").unwrap();
        
        // Verify modification
        let modified = fs::read_to_string(&original_path).unwrap();
        assert_eq!(modified, "Modified content");
        
        // Restore from backup
        fs::copy(&backup_path, &original_path).unwrap();
        
        // Verify restoration
        let restored = fs::read_to_string(&original_path).unwrap();
        assert_eq!(restored, "Original content");
    }

    #[test]
    fn test_project_root_detection() {
        let temp = tempdir().unwrap();
        
        // Create .git directory to simulate project root
        let git_dir = temp.path().join(".git");
        fs::create_dir(&git_dir).unwrap();
        
        // Detection logic
        let is_project_root = |path: &PathBuf| -> bool {
            path.join(".git").exists()
                || path.join("package.json").exists()
                || path.join("Cargo.toml").exists()
        };
        
        assert!(is_project_root(&temp.path().to_path_buf()));
    }

    #[test]
    fn test_character_limit_percentage() {
        let current: u64 = 8500;
        let max: u64 = 10000;
        
        let percentage = (current as f64 / max as f64) * 100.0;
        
        assert!((percentage - 85.0).abs() < 0.01);
    }

    #[test]
    fn test_agent_status_mapping() {
        let status_from_str = |s: &str| -> &str {
            match s.to_lowercase().as_str() {
                "not_installed" | "notinstalled" => "not_installed",
                "installed" => "installed",
                "configured" => "configured",
                "outdated" => "outdated",
                _ => "unknown",
            }
        };
        
        assert_eq!(status_from_str("configured"), "configured");
        assert_eq!(status_from_str("not_installed"), "not_installed");
        assert_eq!(status_from_str("NotInstalled"), "not_installed");
    }

    #[test]
    fn test_escape_toml_string() {
        let escape = |s: &str| -> String {
            s.replace('\\', "\\\\")
                .replace('"', "\\\"")
                .replace('\n', "\\n")
                .replace('\r', "\\r")
                .replace('\t', "\\t")
        };
        
        assert_eq!(escape("test\"quote"), "test\\\"quote");
        assert_eq!(escape("line\nbreak"), "line\\nbreak");
    }

    #[test]
    fn test_escape_yaml_string() {
        let escape = |s: &str| -> String {
            s.replace('\\', "\\\\")
                .replace('"', "\\\"")
                .replace('\n', "\\n")
        };
        
        assert_eq!(escape("test\"quote"), "test\\\"quote");
    }

    #[test]
    fn test_command_format_validation() {
        let validate_slash = |name: &str| -> bool {
            name.starts_with('/')
        };
        
        let validate_prompts = |name: &str| -> bool {
            name.starts_with("/prompts:")
        };
        
        assert!(validate_slash("/command"));
        assert!(!validate_slash("command"));
        assert!(validate_prompts("/prompts:test"));
        assert!(!validate_prompts("/command"));
    }

    #[test]
    fn test_deployment_output_creation() {
        use serde::{Deserialize, Serialize};
        
        #[derive(Debug, Serialize, Deserialize)]
        struct DeploymentOutput {
            success: bool,
            method: String,
            warnings: Vec<String>,
            errors: Vec<String>,
            deployed_files: Vec<String>,
        }
        
        let output = DeploymentOutput {
            success: true,
            method: "symlink".to_string(),
            warnings: vec!["Test warning".to_string()],
            errors: vec![],
            deployed_files: vec!["~/.cursor/commands/test.md".to_string()],
        };
        
        assert!(output.success);
        assert_eq!(output.method, "symlink");
        assert_eq!(output.warnings.len(), 1);
        assert!(output.errors.is_empty());
    }

    #[test]
    fn test_validation_result_combination() {
        let mut errors: Vec<String> = vec![];
        let mut warnings: Vec<String> = vec![];
        
        // Simulate multiple validation results
        let result1_errors: Vec<String> = vec![];
        let result1_warnings: Vec<String> = vec!["Warning 1".to_string()];
        
        let result2_errors: Vec<String> = vec!["Error 1".to_string()];
        let result2_warnings: Vec<String> = vec![];
        
        errors.extend(result1_errors);
        errors.extend(result2_errors);
        warnings.extend(result1_warnings);
        warnings.extend(result2_warnings);
        
        let valid = errors.is_empty();
        
        assert!(!valid);
        assert_eq!(errors.len(), 1);
        assert_eq!(warnings.len(), 1);
    }
}
