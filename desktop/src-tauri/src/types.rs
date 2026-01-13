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
    #[serde(default)]
    pub out_references: Vec<String>,
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
    #[serde(default)]
    pub out_references: Vec<String>,
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

// ============================================================================
// Command Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub script_path: String,
    pub agent_compatibility: Vec<String>,
    pub requires_github: bool,
    pub out_references: Vec<String>,
    pub category: String, // "workflow" | "git" | "documentation" | "utility"
    pub template: Option<String>,
    pub character_count: u64,
    pub word_count: u64,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandCompatibilityResult {
    pub compatible: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandBudgetItem {
    pub command_id: String,
    pub chars: u64,
    pub words: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandBudgetInfo {
    pub total_chars: u64,
    pub command_breakdown: Vec<CommandBudgetItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandValidationError {
    pub command_id: String,
    pub message: String,
    pub severity: String, // "error" | "warning"
    pub file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandValidationResult {
    pub valid: bool,
    pub errors: Vec<CommandValidationError>,
    pub warnings: Vec<CommandValidationError>,
}

// ============================================================================
// Out-Reference Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutReference {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: OutReferenceCategory,
    pub file_path: String,
    pub format: FileFormat,
    pub tags: Vec<String>,
    pub linked_from: Vec<String>,
    pub character_count: u64,
    pub word_count: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OutReferenceCategory {
    Templates,
    Examples,
    Schemas,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileFormat {
    Markdown,
    Json,
    Yaml,
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutReferenceValidationReport {
    pub valid: bool,
    pub broken_links: Vec<BrokenLink>,
    pub unused_references: Vec<String>,
    pub orphaned_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokenLink {
    pub source_type: String,
    pub source_id: String,
    pub target_path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceLink {
    pub link_type: String,
    pub id: String,
    pub name: String,
    pub link_count: u64,
}
