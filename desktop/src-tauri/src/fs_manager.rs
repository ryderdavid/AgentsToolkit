use crate::types::*;
use dirs::home_dir;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

const AGENT_REGISTRY_JSON: &str =
    include_str!("../../../dist/core/agent-registry.bundled.json");

#[derive(Error, Debug)]
pub enum FsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Path not found: {0}")]
    NotFound(String),
    #[error("Invalid path: {0}")]
    InvalidPath(String),
    #[error("JSON parse error: {0}")]
    JsonParse(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, FsError>;

/// Get the ~/.agentsmd/ directory path
pub fn get_agentsmd_home() -> PathBuf {
    if let Ok(env_path) = std::env::var("AGENTSMD_HOME") {
        return PathBuf::from(env_path);
    }

    let home = home_dir().expect("Could not find home directory");
    home.join(".agentsmd")
}

/// Get the rule-packs directory (~/.agentsmd/rule-packs or AGENTSMD_HOME/rule-packs)
pub fn get_rule_packs_dir() -> PathBuf {
    get_agentsmd_home().join("rule-packs")
}

/// Ensure ~/.agentsmd/ directory exists
pub fn ensure_agentsmd_dir() -> Result<PathBuf> {
    let path = get_agentsmd_home();
    fs::create_dir_all(&path)?;
    Ok(path)
}

/// Read AGENTS.md content from ~/.agentsmd/AGENTS.md
pub fn read_agents_md() -> Result<String> {
    let agentsmd_home = get_agentsmd_home();
    let agents_md_path = agentsmd_home.join("AGENTS.md");
    
    if !agents_md_path.exists() {
        return Ok(String::new());
    }
    
    fs::read_to_string(&agents_md_path)
        .map_err(|e| FsError::Io(e))
}

/// Write AGENTS.md content to ~/.agentsmd/AGENTS.md
pub fn write_agents_md(content: String) -> Result<()> {
    let agentsmd_home = ensure_agentsmd_dir()?;
    let agents_md_path = agentsmd_home.join("AGENTS.md");
    
    fs::write(&agents_md_path, content)
        .map_err(|e| FsError::Io(e))?;
    
    Ok(())
}

/// List available rule packs in rule-packs/ directory
pub fn list_rule_packs() -> Result<Vec<String>> {
    let packs_dir = get_rule_packs_dir();
    
    if !packs_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut packs = Vec::new();
    let entries = fs::read_dir(&packs_dir)
        .map_err(|e| FsError::Io(e))?;
    
    for entry in entries {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            let pack_json = entry.path().join("pack.json");
            if pack_json.exists() {
                if let Some(name) = entry.file_name().to_str() {
                    packs.push(name.to_string());
                }
            }
        }
    }
    
    Ok(packs)
}

/// Read pack.json for a given pack
pub fn read_pack_json(pack_id: String) -> Result<String> {
    let pack_json_path = get_rule_packs_dir().join(&pack_id).join("pack.json");
    
    if !pack_json_path.exists() {
        return Err(FsError::NotFound(format!("Pack not found: {}", pack_id)));
    }
    
    fs::read_to_string(&pack_json_path)
        .map_err(|e| FsError::Io(e))
}

/// Read all pack markdown files and concatenate
pub fn read_pack_content(pack_id: String) -> Result<String> {
    let pack_dir = get_rule_packs_dir().join(&pack_id);
    
    // First read pack.json to get file list
    let pack_json_content = read_pack_json(pack_id.clone())?;
    let pack: RulePack = serde_json::from_str(&pack_json_content)?;
    
    let mut contents = Vec::new();
    for file in &pack.files {
        let file_path = pack_dir.join(file);
        if !file_path.exists() {
            return Err(FsError::NotFound(format!("Pack file not found: {}", file)));
        }
        let content = fs::read_to_string(&file_path)?;
        contents.push(content);
    }
    
    Ok(contents.join("\n\n---\n\n"))
}

/// Get agent's config directory path (expands ~)
pub fn get_agent_config_path(agent_id: String) -> Result<PathBuf> {
    let agents = load_agent_registry()?;
    let agent = agents
        .into_iter()
        .find(|a| a.id == agent_id)
        .ok_or_else(|| FsError::NotFound(format!("Agent not found: {}", agent_id)))?;

    let config_path = agent
        .config_paths
        .get(0)
        .ok_or_else(|| FsError::InvalidPath(format!("No config paths defined for agent {}", agent.id)))?;

    expand_path(config_path)
}

/// Check if a path exists
pub fn check_path_exists(path: String) -> Result<bool> {
    let path_buf = Path::new(&path);
    Ok(path_buf.exists())
}

/// Load agent registry from bundled JSON export
pub fn load_agent_registry() -> Result<Vec<AgentDefinition>> {
    serde_json::from_str(AGENT_REGISTRY_JSON).map_err(FsError::JsonParse)
}

fn expand_path(path: &str) -> Result<PathBuf> {
    let trimmed = path.trim();

    if let Some(stripped) = trimmed.strip_prefix("~/") {
        let home = home_dir()
            .ok_or_else(|| FsError::InvalidPath("Could not find home directory".to_string()))?;
        return Ok(home.join(stripped));
    }

    if trimmed == "~" {
        let home = home_dir()
            .ok_or_else(|| FsError::InvalidPath("Could not find home directory".to_string()))?;
        return Ok(home);
    }

    let path_buf = PathBuf::from(trimmed);
    if path_buf.is_absolute() {
        Ok(path_buf)
    } else {
        let home = home_dir()
            .ok_or_else(|| FsError::InvalidPath("Could not find home directory".to_string()))?;
        Ok(home.join(path_buf))
    }
}
