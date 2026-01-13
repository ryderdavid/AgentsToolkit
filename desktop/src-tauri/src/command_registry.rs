use crate::fs_manager;
use crate::types::*;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use serde_json;

/// Cached commands to avoid re-parsing on every request
static COMMAND_CACHE: Lazy<Mutex<Option<Vec<CommandMetadata>>>> = Lazy::new(|| Mutex::new(None));

/// Get the commands source directory path
pub fn get_commands_directory() -> PathBuf {
    fs_manager::get_agentsmd_home().join("commands").join("src")
}

/// Count words in text
fn count_words(text: &str) -> u64 {
    text.split_whitespace().count() as u64
}

/// Convert filename to command ID (kebab-case)
fn filename_to_id(filename: &str) -> String {
    filename.trim_end_matches(".md").to_string()
}

/// Convert command ID to display name (Title Case)
fn id_to_name(id: &str) -> String {
    id.split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Extract script path from command markdown content
fn extract_script_path(content: &str) -> String {
    static PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
        vec![
            Regex::new(r"python3?\s+~/\.agentsmd/scripts/(\w+\.py)").unwrap(),
            Regex::new(r"Run:\s*`python3?\s+~/\.agentsmd/scripts/(\w+\.py)`").unwrap(),
            Regex::new(r"`python3?\s+~/\.agentsmd/scripts/(\w+\.py)`").unwrap(),
        ]
    });

    for pattern in PATTERNS.iter() {
        if let Some(caps) = pattern.captures(content) {
            if let Some(script_name) = caps.get(1) {
                return format!("~/.agentsmd/scripts/{}", script_name.as_str());
            }
        }
    }

    String::new()
}

/// Extract out-references from command markdown content
fn extract_out_references(content: &str) -> Vec<String> {
    static LINK_PATTERN: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap());

    let mut references = Vec::new();

    for caps in LINK_PATTERN.captures_iter(content) {
        if let Some(link_path) = caps.get(2) {
            let path = link_path.as_str();
            // Filter for relevant paths
            if path.contains("rule-packs/") || path.contains("docs/") || path.contains("templates/")
            {
                // Normalize path (remove relative prefixes)
                let normalized = path
                    .trim_start_matches("../")
                    .trim_start_matches("./")
                    .to_string();
                if !references.contains(&normalized) {
                    references.push(normalized);
                }
            }
        }
    }

    references
}

/// Path to persisted out-reference overrides for commands
fn command_out_ref_overrides_path() -> PathBuf {
    fs_manager::get_agentsmd_home()
        .join("commands")
        .join("out-references.json")
}

/// Load persisted out-reference overrides for commands
fn load_command_out_ref_overrides() -> HashMap<String, Vec<String>> {
    let path = command_out_ref_overrides_path();
    if !path.exists() {
        return HashMap::new();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(e) => {
            log::warn!("Failed to read command out-reference overrides: {}", e);
            HashMap::new()
        }
    }
}

/// Persist command out-reference overrides
fn save_command_out_ref_overrides(map: &HashMap<String, Vec<String>>) -> Result<(), String> {
    let path = command_out_ref_overrides_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create overrides directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(map)
        .map_err(|e| format!("Failed to serialize overrides: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write overrides file: {}", e))
}

/// Update a command's out-references and persist the override
pub fn update_command_out_references(command_id: &str, references: Vec<String>) -> Result<(), String> {
    let mut overrides = load_command_out_ref_overrides();

    let mut unique_refs = references;
    unique_refs.sort();
    unique_refs.dedup();

    overrides.insert(command_id.to_string(), unique_refs);
    save_command_out_ref_overrides(&overrides)?;

    // Clear cache so subsequent reads return updated metadata
    clear_cache();
    Ok(())
}

/// Determine command category based on content and purpose
fn determine_category(id: &str, content: &str) -> String {
    let lower_content = content.to_lowercase();
    let lower_id = id.to_lowercase();

    // Workflow commands (issue, pr, branch creation)
    if lower_id.contains("issue")
        || lower_id.contains("pr")
        || lower_id.contains("branch")
        || lower_content.contains("github issue")
        || lower_content.contains("pull request")
    {
        return "workflow".to_string();
    }

    // Git commands (status, push, check operations)
    if lower_id.contains("status")
        || lower_id.contains("push")
        || lower_id.contains("check")
        || lower_id.contains("protect")
        || lower_content.contains("git status")
        || lower_content.contains("workflow status")
    {
        return "git".to_string();
    }

    // Documentation commands (walkthrough, docs)
    if lower_id.contains("walkthrough")
        || lower_id.contains("doc")
        || lower_content.contains("documentation")
        || lower_content.contains("walkthrough document")
    {
        return "documentation".to_string();
    }

    // Default to utility
    "utility".to_string()
}

/// Check if command requires GitHub authentication
fn requires_github(content: &str) -> bool {
    let indicators = [
        "gh issue",
        "gh pr",
        "GitHub issue",
        "GitHub CLI",
        "github.com",
        "check_auth.py",
        "Creates GitHub issue",
    ];

    indicators.iter().any(|indicator| content.contains(indicator))
}

/// Extract template section from command content
fn extract_template(content: &str) -> Option<String> {
    static TEMPLATE_PATTERN: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r"(?i)\*\*(?:Walkthrough\s+)?Template:\*\*\s*([\s\S]*?)(?:\n\*\*|\n##|$)").unwrap()
    });

    static CODE_BLOCK_PATTERN: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"```(?:markdown)?\s*\n([\s\S]*?)```").unwrap());

    // Look for template section
    if let Some(caps) = TEMPLATE_PATTERN.captures(content) {
        if let Some(template) = caps.get(1) {
            return Some(template.as_str().trim().to_string());
        }
    }

    // Look for template in code block
    if let Some(caps) = CODE_BLOCK_PATTERN.captures(content) {
        if let Some(code_block) = caps.get(1) {
            let code = code_block.as_str();
            if code.contains("##") {
                return Some(code.trim().to_string());
            }
        }
    }

    None
}

/// Load a command from a markdown file
fn load_command_from_file(file_path: &PathBuf) -> Result<CommandMetadata, String> {
    if !file_path.exists() {
        return Err(format!("Command file not found: {:?}", file_path));
    }

    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read command file: {}", e))?;

    let filename = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let id = filename_to_id(filename);
    let name = id_to_name(&id);

    // First line is the description
    let description = content
        .lines()
        .next()
        .unwrap_or("")
        .trim()
        .to_string();

    let script_path = extract_script_path(&content);
    let out_references = extract_out_references(&content);
    let category = determine_category(&id, &content);
    let template = extract_template(&content);

    Ok(CommandMetadata {
        id,
        name,
        description,
        script_path,
        agent_compatibility: Vec::new(), // Empty means all agents
        requires_github: requires_github(&content),
        out_references,
        category,
        template,
        character_count: content.len() as u64,
        word_count: count_words(&content),
        source_path: file_path.to_string_lossy().to_string(),
    })
}

/// Load all commands from the commands directory
pub fn load_commands() -> Result<Vec<CommandMetadata>, String> {
    // Check cache first
    if let Ok(cache) = COMMAND_CACHE.lock() {
        if let Some(ref commands) = *cache {
            return Ok(commands.clone());
        }
    }

    let overrides = load_command_out_ref_overrides();

    let commands_dir = get_commands_directory();

    if !commands_dir.exists() {
        return Ok(Vec::new());
    }

    let mut commands = Vec::new();

    let entries =
        fs::read_dir(&commands_dir).map_err(|e| format!("Failed to read commands directory: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "md").unwrap_or(false) {
            match load_command_from_file(&path) {
                Ok(mut cmd) => {
                    if let Some(override_refs) = overrides.get(&cmd.id) {
                        cmd.out_references = override_refs.clone();
                    }
                    commands.push(cmd)
                }
                Err(e) => {
                    log::warn!("Skipping invalid command file {:?}: {}", path, e);
                }
            }
        }
    }

    // Update cache
    if let Ok(mut cache) = COMMAND_CACHE.lock() {
        *cache = Some(commands.clone());
    }

    Ok(commands)
}

/// Get a command by its ID
pub fn get_command_by_id(command_id: &str) -> Result<CommandMetadata, String> {
    let commands = load_commands()?;
    commands
        .into_iter()
        .find(|c| c.id == command_id)
        .ok_or_else(|| format!("Command not found: {}", command_id))
}

/// Get commands compatible with a specific agent
pub fn get_commands_for_agent(agent_id: &str) -> Result<Vec<CommandMetadata>, String> {
    let commands = load_commands()?;
    let agents = fs_manager::load_agent_registry()
        .map_err(|e| format!("Failed to load agent registry: {}", e))?;

    // Find the agent
    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    Ok(commands
        .into_iter()
        .filter(|cmd| {
            // Empty agent_compatibility means all agents
            if cmd.agent_compatibility.is_empty() {
                return true;
            }
            cmd.agent_compatibility.contains(&agent_id.to_string())
        })
        .collect())
}

/// Get commands by category
pub fn get_commands_by_category(category: &str) -> Result<Vec<CommandMetadata>, String> {
    let commands = load_commands()?;
    Ok(commands
        .into_iter()
        .filter(|cmd| cmd.category == category)
        .collect())
}

/// Read raw command content
pub fn get_command_content(command_id: &str) -> Result<String, String> {
    let commands_dir = get_commands_directory();
    let file_path = commands_dir.join(format!("{}.md", command_id));

    if !file_path.exists() {
        return Err(format!("Command not found: {}", command_id));
    }

    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read command file: {}", e))
}

/// Validate command compatibility with a specific agent
pub fn validate_command_for_agent(
    command_id: &str,
    agent_id: &str,
) -> Result<CommandCompatibilityResult, String> {
    let command = get_command_by_id(command_id)?;
    let agents = fs_manager::load_agent_registry()
        .map_err(|e| format!("Failed to load agent registry: {}", e))?;

    let agent = agents
        .iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    // Check explicit compatibility list
    if !command.agent_compatibility.is_empty() && !command.agent_compatibility.contains(&agent_id.to_string()) {
        return Ok(CommandCompatibilityResult {
            compatible: false,
            reason: Some(format!(
                "Command {} is not compatible with agent {}",
                command_id, agent_id
            )),
        });
    }

    // Check if agent supports out-references when command has them
    if !command.out_references.is_empty() && !agent.character_limits.supports_out_references {
        return Ok(CommandCompatibilityResult {
            compatible: false,
            reason: Some(format!(
                "Agent {} does not support out-references required by {}",
                agent_id, command_id
            )),
        });
    }

    // Check character limits
    if let Some(max_chars) = agent.character_limits.max_chars {
        if command.character_count > max_chars {
            return Ok(CommandCompatibilityResult {
                compatible: false,
                reason: Some(format!(
                    "Command {} exceeds character limit for {} ({} > {})",
                    command_id, agent_id, command.character_count, max_chars
                )),
            });
        }
    }

    Ok(CommandCompatibilityResult {
        compatible: true,
        reason: None,
    })
}

/// Clear the command cache (useful after file changes)
pub fn clear_cache() {
    if let Ok(mut cache) = COMMAND_CACHE.lock() {
        *cache = None;
    }
}

/// Calculate total character budget for a set of commands
pub fn calculate_command_budget(command_ids: &[String]) -> Result<CommandBudgetInfo, String> {
    let mut total_chars: u64 = 0;
    let mut command_breakdown = Vec::new();

    for command_id in command_ids {
        let command = get_command_by_id(command_id)?;
        total_chars += command.character_count;
        command_breakdown.push(CommandBudgetItem {
            command_id: command.id,
            chars: command.character_count,
            words: command.word_count,
        });
    }

    Ok(CommandBudgetInfo {
        total_chars,
        command_breakdown,
    })
}
