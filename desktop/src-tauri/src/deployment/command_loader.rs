//! Command loading for deployment
//!
//! Handles loading and converting commands for deployment to agents.

use std::path::PathBuf;

use crate::command_registry::{self, get_command_content};
use crate::types::CommandMetadata;

use super::converters::MarkdownConverter;
use super::error::{DeploymentError, DeploymentResult};

/// Load and convert a command for deployment to a specific agent
pub fn load_command_for_deployment(
    command_id: &str,
    agent_id: &str,
) -> DeploymentResult<(String, String)> {
    // Load command metadata
    let command = command_registry::get_command_by_id(command_id)
        .map_err(|e| DeploymentError::ConfigurationError(e))?;

    // Load raw content
    let content = get_command_content(command_id)
        .map_err(|e| DeploymentError::ConfigurationError(e))?;

    // Validate compatibility
    let compatibility = command_registry::validate_command_for_agent(command_id, agent_id)
        .map_err(|e| DeploymentError::ConfigurationError(e))?;

    if !compatibility.compatible {
        return Err(DeploymentError::ValidationFailed(
            compatibility.reason.unwrap_or_else(|| format!(
                "Command {} is not compatible with agent {}",
                command_id, agent_id
            )),
        ));
    }

    // Convert to agent-specific format
    let (filename, formatted_content) = convert_command_for_agent(&command, &content, agent_id)?;

    Ok((filename, formatted_content))
}

/// Convert command content to agent-specific format
fn convert_command_for_agent(
    command: &CommandMetadata,
    content: &str,
    agent_id: &str,
) -> DeploymentResult<(String, String)> {
    let filename: String;
    let formatted_content: String;

    match agent_id.to_lowercase().as_str() {
        "cursor" => {
            filename = format!("{}.md", command.id);
            formatted_content = MarkdownConverter::to_cursor_command(
                &command.id,
                &command.description,
                content,
            );
        }
        "claude" => {
            filename = format!("{}.md", command.id);
            formatted_content = MarkdownConverter::to_claude_command(
                &command.id,
                &command.description,
                content,
            );
        }
        "gemini" => {
            filename = format!("{}.toml", command.id);
            formatted_content = MarkdownConverter::to_gemini_command(
                &command.id,
                &command.description,
                content,
            )?;
        }
        "aider" => {
            filename = format!("{}.yaml", command.id);
            formatted_content = MarkdownConverter::to_aider_command(
                &command.id,
                &command.description,
                content,
            )?;
        }
        "warp" => {
            filename = format!("{}.yaml", command.id);
            formatted_content = MarkdownConverter::to_warp_command(
                &command.id,
                &command.description,
                content,
            )?;
        }
        "cline" => {
            filename = format!("{}.json", command.id);
            formatted_content = MarkdownConverter::to_cline_command(
                &command.id,
                &command.description,
                content,
            )?;
        }
        "codex" => {
            filename = format!("{}.md", command.id);
            formatted_content = MarkdownConverter::to_codex_prompt(
                &command.id,
                &command.description,
                content,
            );
        }
        "copilot" => {
            // Copilot uses inline format, content embedded in instructions
            filename = format!("{}.md", command.id);
            formatted_content = format!(
                "## Command: /{}\n\n{}\n\n---\n\n{}",
                command.id, command.description, content
            );
        }
        _ => {
            // Default to markdown format
            filename = format!("{}.md", command.id);
            formatted_content = format!(
                "# /{}\n\n{}\n\n---\n\n{}",
                command.id, command.description, content
            );
        }
    }

    Ok((filename, formatted_content))
}

/// Extract template section from command content
pub fn extract_template(content: &str) -> Option<String> {
    // Look for template section markers
    let template_markers = [
        ("**Walkthrough Template:**", "\n**"),
        ("**Template:**", "\n**"),
        ("## Template", "\n##"),
    ];

    for (start_marker, end_marker) in template_markers {
        if let Some(start_idx) = content.find(start_marker) {
            let template_start = start_idx + start_marker.len();
            let remaining = &content[template_start..];

            let end_idx = remaining.find(end_marker).unwrap_or(remaining.len());
            let template = remaining[..end_idx].trim();

            if !template.is_empty() {
                return Some(template.to_string());
            }
        }
    }

    // Also check for fenced code blocks labeled as templates
    if let Some(start) = content.find("```markdown\n# Walkthrough") {
        if let Some(end) = content[start + 3..].find("```") {
            let template = &content[start + 12..start + 3 + end];
            return Some(template.trim().to_string());
        }
    }

    None
}

/// Resolve out-references from command content
/// Returns list of paths that the command references
pub fn resolve_out_references(content: &str) -> Vec<PathBuf> {
    let mut references = Vec::new();

    // Match markdown links: [text](path)
    let link_pattern = regex::Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap();

    for caps in link_pattern.captures_iter(content) {
        if let Some(path_match) = caps.get(2) {
            let path = path_match.as_str();
            // Filter for relevant paths
            if path.contains("rule-packs/")
                || path.contains("docs/")
                || path.contains("templates/")
            {
                // Normalize relative path
                let normalized = path
                    .trim_start_matches("../")
                    .trim_start_matches("./");

                references.push(PathBuf::from(normalized));
            }
        }
    }

    references
}

/// Load multiple commands for an agent
pub fn load_commands_for_deployment(
    command_ids: &[String],
    agent_id: &str,
) -> DeploymentResult<Vec<(String, String)>> {
    let mut results = Vec::new();

    for command_id in command_ids {
        let (filename, content) = load_command_for_deployment(command_id, agent_id)?;
        results.push((filename, content));
    }

    Ok(results)
}

/// Get total character count for a set of commands
pub fn calculate_commands_character_count(command_ids: &[String]) -> DeploymentResult<u64> {
    let mut total: u64 = 0;

    for command_id in command_ids {
        let command = command_registry::get_command_by_id(command_id)
            .map_err(|e| DeploymentError::ConfigurationError(e))?;
        total += command.character_count;
    }

    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_template_walkthrough_format() {
        let content = r#"
Create a walkthrough document.

**Walkthrough Template:**
# Walkthrough: #{issue} - W{N}

**Issue:** [#{issue}: Title](link)
**Branch:** `{branch-name}`

## Summary
[Brief summary]

**Next Section:**
This is not part of the template.
"#;

        let template = extract_template(content);
        assert!(template.is_some());
        let template = template.unwrap();
        assert!(template.contains("# Walkthrough:"));
        assert!(!template.contains("Next Section"));
    }

    #[test]
    fn test_resolve_out_references() {
        let content = r#"
See [Issue Template](../../rule-packs/github-hygiene/issue-first.md) for formatting.
Also check [Documentation](../docs/guide.md) and [External](https://example.com).
"#;

        let refs = resolve_out_references(content);
        assert_eq!(refs.len(), 2);
        assert!(refs.iter().any(|p| p.to_str().unwrap().contains("rule-packs")));
        assert!(refs.iter().any(|p| p.to_str().unwrap().contains("docs")));
    }
}
