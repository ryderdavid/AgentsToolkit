//! Format converters for agent-specific file formats
//!
//! Handles conversion between Markdown and other formats (TOML, YAML, JSON)
//! required by different agents.

use serde_json::Value;
use std::collections::HashMap;

use super::error::{DeploymentError, DeploymentResult};

/// Markdown format converter
pub struct MarkdownConverter;

impl MarkdownConverter {
    /// Convert markdown content to TOML format (for Gemini)
    /// 
    /// Wraps content in a TOML structure with optional frontmatter
    pub fn to_toml(
        content: &str,
        frontmatter: Option<HashMap<String, String>>,
    ) -> DeploymentResult<String> {
        let mut toml_content = String::new();

        // Add frontmatter as TOML key-value pairs
        if let Some(fm) = frontmatter {
            for (key, value) in fm.iter() {
                toml_content.push_str(&format!("{} = \"{}\"\n", key, escape_toml_string(value)));
            }
            toml_content.push('\n');
        }

        // Add content as a multi-line string
        toml_content.push_str("content = \"\"\"\n");
        toml_content.push_str(content);
        if !content.ends_with('\n') {
            toml_content.push('\n');
        }
        toml_content.push_str("\"\"\"\n");

        Ok(toml_content)
    }

    /// Convert markdown content to YAML format (for Warp, Aider)
    /// 
    /// Creates a YAML document with optional frontmatter
    pub fn to_yaml(
        content: &str,
        frontmatter: Option<HashMap<String, String>>,
    ) -> DeploymentResult<String> {
        let mut yaml_content = String::new();

        yaml_content.push_str("---\n");

        // Add frontmatter as YAML key-value pairs
        if let Some(fm) = frontmatter {
            for (key, value) in fm.iter() {
                yaml_content.push_str(&format!("{}: \"{}\"\n", key, escape_yaml_string(value)));
            }
        }

        // Add content as a multi-line string
        yaml_content.push_str("content: |\n");
        for line in content.lines() {
            yaml_content.push_str("  ");
            yaml_content.push_str(line);
            yaml_content.push('\n');
        }

        yaml_content.push_str("---\n");

        Ok(yaml_content)
    }

    /// Convert markdown content to JSON format (for Cline)
    /// 
    /// Creates a JSON object with content and optional metadata
    pub fn to_json(
        content: &str,
        metadata: Option<HashMap<String, Value>>,
    ) -> DeploymentResult<String> {
        let mut json_obj = serde_json::Map::new();

        // Add metadata
        if let Some(meta) = metadata {
            for (key, value) in meta {
                json_obj.insert(key, value);
            }
        }

        // Add content
        json_obj.insert("content".to_string(), Value::String(content.to_string()));

        serde_json::to_string_pretty(&Value::Object(json_obj))
            .map_err(|e| DeploymentError::format_error(format!("JSON serialization failed: {}", e)))
    }

    /// Add YAML frontmatter to markdown content (for Claude, Antigravity, Codex)
    /// 
    /// Prepends YAML frontmatter block to markdown content
    pub fn add_frontmatter(content: &str, frontmatter: HashMap<String, String>) -> String {
        let mut result = String::new();

        result.push_str("---\n");
        for (key, value) in frontmatter.iter() {
            result.push_str(&format!("{}: \"{}\"\n", key, escape_yaml_string(value)));
        }
        result.push_str("---\n\n");
        result.push_str(content);

        result
    }

    /// Parse YAML frontmatter from markdown content
    /// 
    /// Returns (frontmatter, content_without_frontmatter)
    pub fn parse_frontmatter(content: &str) -> (Option<HashMap<String, String>>, String) {
        if !content.starts_with("---\n") {
            return (None, content.to_string());
        }

        // Find the closing ---
        if let Some(end_idx) = content[4..].find("\n---") {
            let frontmatter_str = &content[4..4 + end_idx];
            let remaining_content = &content[4 + end_idx + 4..];

            // Parse simple key: value pairs
            let mut frontmatter = HashMap::new();
            for line in frontmatter_str.lines() {
                if let Some(colon_idx) = line.find(':') {
                    let key = line[..colon_idx].trim().to_string();
                    let value = line[colon_idx + 1..].trim().trim_matches('"').to_string();
                    frontmatter.insert(key, value);
                }
            }

            (Some(frontmatter), remaining_content.trim_start().to_string())
        } else {
            (None, content.to_string())
        }
    }

    /// Convert to Warp workflow YAML format
    /// 
    /// Creates a Warp-specific workflow structure
    pub fn to_warp_workflow(
        name: &str,
        description: &str,
        content: &str,
    ) -> DeploymentResult<String> {
        let workflow = WarpWorkflow {
            name: name.to_string(),
            description: description.to_string(),
            steps: vec![WarpStep {
                command: format!("echo \"{}\"", escape_shell_string(content)),
                description: Some("Execute AGENTS.md rules".to_string()),
            }],
        };

        serde_yaml::to_string(&workflow)
            .map_err(|e| DeploymentError::format_error(format!("YAML serialization failed: {}", e)))
    }

    /// Convert command to Claude command format with frontmatter
    pub fn to_claude_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> String {
        let mut frontmatter = HashMap::new();
        frontmatter.insert("name".to_string(), name.to_string());
        frontmatter.insert("description".to_string(), description.to_string());

        Self::add_frontmatter(content, frontmatter)
    }

    /// Convert command to Cursor slash command format
    pub fn to_cursor_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> String {
        // Cursor commands are plain markdown files with descriptive headers
        format!(
            "# /{}\n\n{}\n\n---\n\n{}",
            name, description, content
        )
    }

    /// Convert command to Codex prompt format
    pub fn to_codex_prompt(
        name: &str,
        description: &str,
        content: &str,
    ) -> String {
        let mut frontmatter = HashMap::new();
        frontmatter.insert("name".to_string(), format!("/prompts:{}", name));
        frontmatter.insert("description".to_string(), description.to_string());

        Self::add_frontmatter(content, frontmatter)
    }

    /// Convert command to Gemini TOML format
    /// 
    /// Creates a TOML command structure for Gemini CLI
    pub fn to_gemini_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> DeploymentResult<String> {
        let mut frontmatter = HashMap::new();
        frontmatter.insert("name".to_string(), name.to_string());
        frontmatter.insert("description".to_string(), description.to_string());
        frontmatter.insert("type".to_string(), "command".to_string());

        Self::to_toml(content, Some(frontmatter))
    }

    /// Convert command to Aider YAML format
    /// 
    /// Creates a YAML command structure for Aider
    pub fn to_aider_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> DeploymentResult<String> {
        let mut yaml_content = String::new();

        yaml_content.push_str("---\n");
        yaml_content.push_str(&format!("name: \"{}\"\n", escape_yaml_string(name)));
        yaml_content.push_str(&format!("description: \"{}\"\n", escape_yaml_string(description)));
        yaml_content.push_str("type: command\n");
        yaml_content.push_str("content: |\n");

        for line in content.lines() {
            yaml_content.push_str("  ");
            yaml_content.push_str(line);
            yaml_content.push('\n');
        }

        yaml_content.push_str("---\n");

        Ok(yaml_content)
    }

    /// Convert command to Warp workflow format
    /// 
    /// Creates a Warp-specific workflow command structure
    pub fn to_warp_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> DeploymentResult<String> {
        // Warp workflows use a specific YAML structure
        let workflow = WarpWorkflow {
            name: name.to_string(),
            description: description.to_string(),
            steps: vec![
                WarpStep {
                    command: format!("# {}\n{}", description, content),
                    description: Some(format!("Execute {} command", name)),
                },
            ],
        };

        serde_yaml::to_string(&workflow)
            .map_err(|e| DeploymentError::format_error(format!("YAML serialization failed: {}", e)))
    }

    /// Convert command to Cline JSON format
    /// 
    /// Creates a JSON command structure for Cline
    pub fn to_cline_command(
        name: &str,
        description: &str,
        content: &str,
    ) -> DeploymentResult<String> {
        let mut json_obj = serde_json::Map::new();

        json_obj.insert("name".to_string(), Value::String(name.to_string()));
        json_obj.insert("description".to_string(), Value::String(description.to_string()));
        json_obj.insert("type".to_string(), Value::String("command".to_string()));
        json_obj.insert("content".to_string(), Value::String(content.to_string()));

        // Add metadata
        let mut metadata = serde_json::Map::new();
        metadata.insert("version".to_string(), Value::String("1.0".to_string()));
        metadata.insert("format".to_string(), Value::String("markdown".to_string()));
        json_obj.insert("metadata".to_string(), Value::Object(metadata));

        serde_json::to_string_pretty(&Value::Object(json_obj))
            .map_err(|e| DeploymentError::format_error(format!("JSON serialization failed: {}", e)))
    }
}

/// Warp workflow structure
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WarpWorkflow {
    name: String,
    description: String,
    steps: Vec<WarpStep>,
}

/// Warp workflow step
#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct WarpStep {
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
}

/// Escape special characters for TOML strings
fn escape_toml_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

/// Escape special characters for YAML strings
fn escape_yaml_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

/// Escape special characters for shell strings
fn escape_shell_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "\\$")
        .replace('`', "\\`")
}

/// Format detection utilities
pub struct FormatDetector;

impl FormatDetector {
    /// Detect format from file extension
    pub fn from_extension(path: &str) -> FileFormat {
        if path.ends_with(".toml") {
            FileFormat::Toml
        } else if path.ends_with(".yaml") || path.ends_with(".yml") {
            FileFormat::Yaml
        } else if path.ends_with(".json") {
            FileFormat::Json
        } else {
            FileFormat::Markdown
        }
    }

    /// Detect format from content
    pub fn from_content(content: &str) -> FileFormat {
        let trimmed = content.trim();

        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            FileFormat::Json
        } else if trimmed.starts_with("---\n") {
            // Could be YAML or markdown with frontmatter
            FileFormat::Yaml
        } else if trimmed.contains(" = ") && !trimmed.contains('#') {
            // Likely TOML (has assignments, no markdown headers)
            FileFormat::Toml
        } else {
            FileFormat::Markdown
        }
    }
}

/// Supported file formats
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileFormat {
    Markdown,
    Toml,
    Yaml,
    Json,
}

impl FileFormat {
    pub fn extension(&self) -> &'static str {
        match self {
            FileFormat::Markdown => "md",
            FileFormat::Toml => "toml",
            FileFormat::Yaml => "yaml",
            FileFormat::Json => "json",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_frontmatter() {
        let mut fm = HashMap::new();
        fm.insert("name".to_string(), "test".to_string());
        fm.insert("version".to_string(), "1.0".to_string());

        let result = MarkdownConverter::add_frontmatter("# Content", fm);
        assert!(result.starts_with("---\n"));
        assert!(result.contains("name: \"test\""));
        assert!(result.contains("# Content"));
    }

    #[test]
    fn test_parse_frontmatter() {
        let content = "---\nname: \"test\"\nversion: \"1.0\"\n---\n\n# Content";
        let (fm, body) = MarkdownConverter::parse_frontmatter(content);

        assert!(fm.is_some());
        let fm = fm.unwrap();
        assert_eq!(fm.get("name"), Some(&"test".to_string()));
        assert!(body.contains("# Content"));
    }

    #[test]
    fn test_format_detection() {
        assert_eq!(FormatDetector::from_extension("test.toml"), FileFormat::Toml);
        assert_eq!(FormatDetector::from_extension("test.yaml"), FileFormat::Yaml);
        assert_eq!(FormatDetector::from_extension("test.json"), FileFormat::Json);
        assert_eq!(FormatDetector::from_extension("test.md"), FileFormat::Markdown);
    }
}
