//! Deployment registry
//!
//! Maps agent IDs to their respective deployers.

use std::collections::HashMap;
use std::sync::Arc;

use super::agents::{
    aider::AiderDeployer,
    azure_devops::AzureDevOpsDeployer,
    claude::ClaudeDeployer,
    cline::ClineDeployer,
    codex::CodexDeployer,
    copilot::CopilotDeployer,
    cursor::CursorDeployer,
    gemini::GeminiDeployer,
    placeholder::PlaceholderDeployer,
    warp::WarpDeployer,
};
use super::deployer::AgentDeployer;
use super::error::{DeploymentError, DeploymentResult};
use crate::fs_manager;
use crate::types::AgentDefinition;

/// Registry of all available agent deployers
pub struct DeployerRegistry {
    deployers: HashMap<String, Arc<dyn AgentDeployer>>,
}

impl DeployerRegistry {
    /// Create a new registry and initialize all deployers
    pub fn new() -> DeploymentResult<Self> {
        let mut deployers: HashMap<String, Arc<dyn AgentDeployer>> = HashMap::new();

        // Load agent registry
        let agents = fs_manager::load_agent_registry()
            .map_err(|e| DeploymentError::ConfigurationError(format!("Failed to load agents: {}", e)))?;

        // Create deployers for each agent
        for agent in agents {
            let deployer: Arc<dyn AgentDeployer> = Self::create_deployer_for_agent(agent)?;
            deployers.insert(deployer.agent_id().to_string(), deployer);
        }

        Ok(Self { deployers })
    }

    /// Create the appropriate deployer for an agent
    fn create_deployer_for_agent(agent: AgentDefinition) -> DeploymentResult<Arc<dyn AgentDeployer>> {
        let deployer: Arc<dyn AgentDeployer> = match agent.id.to_lowercase().as_str() {
            "cursor" => Arc::new(CursorDeployer::new(agent)),
            "claude" => Arc::new(ClaudeDeployer::new(agent)),
            "copilot" => Arc::new(CopilotDeployer::new(agent)),
            "gemini" => Arc::new(GeminiDeployer::new(agent)),
            "antigravity" => Arc::new(GeminiDeployer::new_antigravity(agent)),
            "warp" => Arc::new(WarpDeployer::new(agent)),
            "cline" => Arc::new(ClineDeployer::new(agent)),
            "aider" => Arc::new(AiderDeployer::new(agent)),
            "codex" => Arc::new(CodexDeployer::new(agent)),
            "azure_devops" | "azuredevops" => Arc::new(AzureDevOpsDeployer::new(agent)),
            // Placeholder deployers for agents with unverified paths
            "kilocode" | "opencode" | "roocode" => {
                Arc::new(PlaceholderDeployer::new(agent))
            }
            _ => {
                // Unknown agent - use placeholder
                Arc::new(PlaceholderDeployer::new(agent))
            }
        };

        Ok(deployer)
    }

    /// Get a deployer for a specific agent ID
    pub fn get_deployer(&self, agent_id: &str) -> Option<Arc<dyn AgentDeployer>> {
        self.deployers.get(&agent_id.to_lowercase()).cloned()
    }

    /// Get all registered agent IDs
    pub fn agent_ids(&self) -> Vec<String> {
        self.deployers.keys().cloned().collect()
    }

    /// Check if a deployer exists for an agent
    pub fn has_deployer(&self, agent_id: &str) -> bool {
        self.deployers.contains_key(&agent_id.to_lowercase())
    }

    /// Get the number of registered deployers
    pub fn len(&self) -> usize {
        self.deployers.len()
    }

    /// Check if registry is empty
    pub fn is_empty(&self) -> bool {
        self.deployers.is_empty()
    }
}

impl Default for DeployerRegistry {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            deployers: HashMap::new(),
        })
    }
}
