use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub config_paths: Vec<String>,
    pub agents_md_support: String, // "native" | "config" | "manual" | "none"
    pub command_format: String,    // "slash" | "prompts-prefix" | "cli" | "workflow" | "inline"
    pub character_limits: CharacterLimits,
    pub deployment_strategy: String, // "symlink" | "copy" | "inline" | "api"
    pub build_output: String,
    pub file_format: String, // "markdown" | "toml" | "yaml" | "json"
    pub requires_frontmatter: Option<bool>,
    pub sandbox_script_path: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterLimits {
    pub max_chars: Option<u64>,
    pub supports_out_references: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RulePack {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub dependencies: Vec<String>,
    pub target_agents: Vec<String>,
    pub files: Vec<String>,
    pub metadata: PackMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackMetadata {
    pub word_count: u64,
    pub character_count: u64,
    pub category: String, // "workflow" | "vcs" | "universal"
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedPack {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub dependencies: Vec<String>,
    pub target_agents: Vec<String>,
    pub files: Vec<String>,
    pub metadata: PackMetadata,
    pub path: String,
    pub content: String,
    pub actual_word_count: u64,
    pub actual_character_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackValidationError {
    pub pack_id: String,
    pub message: String,
    pub severity: String, // "error" | "warning"
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackValidationResult {
    pub valid: bool,
    pub errors: Vec<PackValidationError>,
    pub warnings: Vec<PackValidationError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyResolution {
    pub order: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
    pub circular_path: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PackBudgetItem {
    pub pack_id: String,
    pub chars: u64,
    pub words: u64,
    pub percentage_of_total: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetInfo {
    pub total_chars: u64,
    pub max_chars: Option<u64>,
    pub percentage: Option<u64>,
    pub within_limit: bool,
    pub pack_breakdown: Vec<PackBudgetItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResult {
    pub success: bool,
    pub content: String,
    pub budget: BudgetInfo,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LinkMethod {
    Symlink,
    Junction,
    Hardlink,
    Copy,
    Existing,
}
