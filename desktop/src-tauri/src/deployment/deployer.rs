//! AgentDeployer trait definition
//! 
//! Defines the core trait that all agent deployers must implement.

use crate::types::AgentDefinition;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

use super::error::DeploymentResult;

/// Configuration for a deployment operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentConfig {
    /// The target agent ID
    pub agent_id: String,
    /// IDs of rule packs to include
    pub pack_ids: Vec<String>,
    /// IDs of custom commands to include
    pub custom_command_ids: Vec<String>,
    /// Whether to deploy at user level or project level
    pub target_level: TargetLevel,
    /// Force overwrite existing files
    pub force_overwrite: bool,
    /// Project path for project-level deployments
    pub project_path: Option<String>,
}

/// Target level for deployment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TargetLevel {
    User,
    Project,
}

impl Default for TargetLevel {
    fn default() -> Self {
        TargetLevel::User
    }
}

/// Result of a successful deployment
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentOutput {
    /// Whether the deployment succeeded
    pub success: bool,
    /// The method used for deployment (symlink, copy, etc.)
    pub method: String,
    /// Any warnings generated during deployment
    pub warnings: Vec<String>,
    /// Any errors that occurred
    pub errors: Vec<String>,
    /// List of files that were deployed
    pub deployed_files: Vec<String>,
    /// Manual steps required (if any)
    pub manual_steps: Vec<String>,
}

impl DeploymentOutput {
    pub fn success(method: impl Into<String>, deployed_files: Vec<String>) -> Self {
        Self {
            success: true,
            method: method.into(),
            warnings: Vec::new(),
            errors: Vec::new(),
            deployed_files,
            manual_steps: Vec::new(),
        }
    }

    pub fn with_warnings(mut self, warnings: Vec<String>) -> Self {
        self.warnings = warnings;
        self
    }

    pub fn with_manual_steps(mut self, steps: Vec<String>) -> Self {
        self.manual_steps = steps;
        self
    }

    pub fn failure(errors: Vec<String>) -> Self {
        Self {
            success: false,
            method: String::new(),
            warnings: Vec::new(),
            errors,
            deployed_files: Vec::new(),
            manual_steps: Vec::new(),
        }
    }
}

/// Prepared deployment artifacts ready for deployment
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedDeployment {
    /// The generated AGENTS.md content
    pub agents_md_content: String,
    /// Command files to deploy (path -> content)
    pub commands: HashMap<String, String>,
    /// Config files to create/update (path -> content)
    pub config_files: HashMap<String, String>,
    /// Target paths for each file
    pub target_paths: Vec<PathBuf>,
    /// Character count of the deployment
    pub character_count: u64,
    /// Format used for commands
    pub command_format: String,
}

impl PreparedDeployment {
    pub fn new(agents_md_content: String) -> Self {
        let character_count = agents_md_content.len() as u64;
        Self {
            agents_md_content,
            commands: HashMap::new(),
            config_files: HashMap::new(),
            target_paths: Vec::new(),
            character_count,
            command_format: "markdown".to_string(),
        }
    }

    pub fn add_command(&mut self, name: String, content: String) {
        self.character_count += content.len() as u64;
        self.commands.insert(name, content);
    }

    pub fn add_config_file(&mut self, path: String, content: String) {
        self.config_files.insert(path, content);
    }

    pub fn add_target_path(&mut self, path: PathBuf) {
        self.target_paths.push(path);
    }
}

/// Report from validation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    /// Whether validation passed
    pub valid: bool,
    /// Validation errors
    pub errors: Vec<String>,
    /// Validation warnings
    pub warnings: Vec<String>,
    /// Budget usage information
    pub budget_usage: BudgetUsage,
}

impl ValidationReport {
    pub fn success(budget_usage: BudgetUsage) -> Self {
        Self {
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            budget_usage,
        }
    }

    pub fn failure(errors: Vec<String>, budget_usage: BudgetUsage) -> Self {
        Self {
            valid: false,
            errors,
            warnings: Vec::new(),
            budget_usage,
        }
    }

    pub fn with_warnings(mut self, warnings: Vec<String>) -> Self {
        self.warnings = warnings;
        self
    }
}

/// Budget usage information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BudgetUsage {
    /// Current character count
    pub current_chars: u64,
    /// Maximum allowed characters (if any)
    pub max_chars: Option<u64>,
    /// Percentage of budget used
    pub percentage: Option<f64>,
    /// Whether within the limit
    pub within_limit: bool,
}

impl BudgetUsage {
    pub fn new(current_chars: u64, max_chars: Option<u64>) -> Self {
        let percentage = max_chars.map(|max| (current_chars as f64 / max as f64) * 100.0);
        let within_limit = max_chars.map(|max| current_chars <= max).unwrap_or(true);
        Self {
            current_chars,
            max_chars,
            percentage,
            within_limit,
        }
    }

    pub fn unlimited(current_chars: u64) -> Self {
        Self {
            current_chars,
            max_chars: None,
            percentage: None,
            within_limit: true,
        }
    }
}

/// Status of an agent's deployment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AgentStatus {
    /// Agent application is not installed on the system
    NotInstalled,
    /// Agent is installed but not configured with AGENTS.md
    Installed,
    /// Agent is configured with AGENTS.md
    Configured,
    /// Agent configuration is outdated
    Outdated,
}

impl AgentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentStatus::NotInstalled => "not_installed",
            AgentStatus::Installed => "installed",
            AgentStatus::Configured => "configured",
            AgentStatus::Outdated => "outdated",
        }
    }
}

/// The core trait that all agent deployers must implement
pub trait AgentDeployer: Send + Sync {
    /// Get the agent ID this deployer handles
    fn agent_id(&self) -> &str;

    /// Get the agent definition
    fn agent_definition(&self) -> &AgentDefinition;

    /// Prepare deployment artifacts
    /// 
    /// Loads rule packs, generates AGENTS.md content, and prepares
    /// all files in the appropriate format for this agent.
    fn prepare(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment>;

    /// Validate prepared deployment
    /// 
    /// Checks character limits, format requirements, and other
    /// constraints specific to this agent.
    fn validate(&self, prepared: &PreparedDeployment) -> DeploymentResult<ValidationReport>;

    /// Execute the deployment
    /// 
    /// Writes files, creates symlinks, and updates configurations.
    fn deploy(&self, prepared: PreparedDeployment, config: &DeploymentConfig) -> DeploymentResult<DeploymentOutput>;

    /// Rollback a deployment
    /// 
    /// Reverts to the previous state using backup data.
    fn rollback(&self, state: &super::state::DeploymentState) -> DeploymentResult<()>;

    /// Get current deployment status
    fn get_status(&self) -> DeploymentResult<AgentStatus>;

    /// Check if this agent supports project-level deployment
    fn supports_project_level(&self) -> bool {
        false
    }

    /// Check if this agent supports user-level deployment
    fn supports_user_level(&self) -> bool {
        true
    }

    /// Get the character limit for this agent
    fn character_limit(&self) -> Option<u64> {
        self.agent_definition().character_limits.max_chars
    }
}
