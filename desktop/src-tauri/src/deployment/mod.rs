//! Deployment module
//!
//! Provides the deployment orchestration system for deploying AGENTS.md
//! and custom commands to various AI coding agents.

pub mod agents;
pub mod command_loader;
pub mod command_validator;
pub mod converters;
pub mod deployer;
pub mod error;
pub mod logger;
pub mod project;
pub mod registry;
pub mod state;
pub mod validator;

use std::path::PathBuf;
use std::sync::Arc;

use crate::fs_manager;
use crate::ipc;
use crate::command_registry;
use crate::out_reference_manager;
use crate::types::RulePack;
use crate::deployment::validator::DeploymentValidator;
use serde_json;

pub use deployer::{
    AgentDeployer, AgentStatus, BudgetUsage, DeploymentConfig, DeploymentOutput,
    PreparedDeployment, TargetLevel, ValidationReport,
};
pub use error::{DeploymentError, DeploymentResult};
pub use registry::DeployerRegistry;
pub use state::{BackupManager, DeploymentState, StateManager};

/// Main deployment manager that orchestrates all deployment operations
pub struct DeploymentManager {
    registry: DeployerRegistry,
    state_manager: StateManager,
    backup_manager: BackupManager,
    logger: logger::DeploymentLogger,
}

impl DeploymentManager {
    /// Create a new deployment manager
    pub fn new() -> DeploymentResult<Self> {
        Ok(Self {
            registry: DeployerRegistry::new()?,
            state_manager: StateManager::new()?,
            backup_manager: BackupManager::new()?,
            logger: logger::DeploymentLogger::new()?,
        })
    }

    fn merge_with_command_validation(
        &self,
        mut validation: ValidationReport,
        config: &DeploymentConfig,
    ) -> DeploymentResult<ValidationReport> {
        if config.custom_command_ids.is_empty() {
            return Ok(validation);
        }

        let command_validation = DeploymentValidator::validate_commands_for_agent(
            &config.custom_command_ids,
            &config.agent_id,
        )?;

        validation.warnings.extend(command_validation.warnings);
        validation.errors.extend(command_validation.errors);
        validation.valid = validation.valid && command_validation.valid && validation.errors.is_empty();

        Ok(validation)
    }

    /// Deploy to a specific agent
    pub fn deploy(&self, config: &DeploymentConfig) -> DeploymentResult<DeploymentOutput> {
        let deployer = self
            .registry
            .get_deployer(&config.agent_id)
            .ok_or_else(|| DeploymentError::agent_not_found(&config.agent_id))?;

        // Log the start of deployment
        self.logger.log_success(
            &config.agent_id,
            logger::DeploymentOperation::Prepare,
            Some(format!("Starting deployment with {} packs", config.pack_ids.len())),
        )?;

        // Prepare deployment
        let prepared = match deployer.prepare(config) {
            Ok(p) => p,
            Err(e) => {
                self.logger.log_failure(
                    &config.agent_id,
                    logger::DeploymentOperation::Prepare,
                    vec![e.to_string()],
                    None,
                )?;
                return Err(e);
            }
        };

        // Validate deployment
        let validation = match deployer.validate(&prepared) {
            Ok(v) => v,
            Err(e) => {
                self.logger.log_failure(
                    &config.agent_id,
                    logger::DeploymentOperation::Validate,
                    vec![e.to_string()],
                    None,
                )?;
                return Err(e);
            }
        };

        let validation = match self.merge_with_command_validation(validation, config) {
            Ok(v) => v,
            Err(e) => {
                self.logger.log_failure(
                    &config.agent_id,
                    logger::DeploymentOperation::Validate,
                    vec![e.to_string()],
                    None,
                )?;
                return Err(e);
            }
        };

        if !validation.valid {
            self.logger.log_failure(
                &config.agent_id,
                logger::DeploymentOperation::Validate,
                validation.errors.clone(),
                None,
            )?;
            return Err(DeploymentError::ValidationFailed(
                validation.errors.join("; "),
            ));
        }

        self.logger.log_success(
            &config.agent_id,
            logger::DeploymentOperation::Validate,
            Some(format!(
                "Validated: {} chars, {:.1}% of limit",
                validation.budget_usage.current_chars,
                validation.budget_usage.percentage.unwrap_or(0.0)
            )),
        )?;

        // Create backup of existing files
        let files_to_backup: Vec<PathBuf> = prepared
            .target_paths
            .iter()
            .filter(|p| p.exists())
            .cloned()
            .collect();

        let backup_path = self.backup_manager.create_backup(&config.agent_id, &files_to_backup)?;

        // Execute deployment
        let result = match deployer.deploy(prepared.clone(), config) {
            Ok(r) => r,
            Err(e) => {
                // Attempt rollback on failure
                if let Some(ref backup) = backup_path {
                    let _ = self.backup_manager.restore_backup(backup, &files_to_backup);
                }
                self.logger.log_failure(
                    &config.agent_id,
                    logger::DeploymentOperation::Deploy,
                    vec![e.to_string()],
                    None,
                )?;
                return Err(e);
            }
        };

        // Record deployment state
        let state = DeploymentState::new(
            config.agent_id.clone(),
            result.method.clone(),
            match config.target_level {
                TargetLevel::User => "user".to_string(),
                TargetLevel::Project => "project".to_string(),
            },
        )
        .with_packs(config.pack_ids.clone())
        .with_commands(config.custom_command_ids.clone())
        .with_files(result.deployed_files.clone());

        let state = if let Some(backup) = backup_path {
            state.with_backup(backup.to_string_lossy().to_string())
        } else {
            state
        };

        let state = if let Some(ref project) = config.project_path {
            state.with_project(project.clone())
        } else {
            state
        };

        self.state_manager.record_deployment(state)?;

        self.logger.log_success(
            &config.agent_id,
            logger::DeploymentOperation::Deploy,
            Some(format!(
                "Deployed {} files using {}",
                result.deployed_files.len(),
                result.method
            )),
        )?;

        Ok(result)
    }

    /// Rollback the last deployment for an agent
    pub fn rollback(&self, agent_id: &str, timestamp: Option<String>) -> DeploymentResult<()> {
        let deployer = self
            .registry
            .get_deployer(agent_id)
            .ok_or_else(|| DeploymentError::agent_not_found(agent_id))?;

        // Get the deployment state to rollback
        let state = match timestamp {
            Some(ts) => {
                // Parse timestamp and find specific deployment
                let dt = chrono::DateTime::parse_from_rfc3339(&ts)
                    .map_err(|e| DeploymentError::StateError(format!("Invalid timestamp: {}", e)))?
                    .with_timezone(&chrono::Utc);
                self.state_manager
                    .get_deployment_by_timestamp(agent_id, &dt)?
                    .ok_or_else(|| {
                        DeploymentError::RollbackFailed(format!(
                            "No deployment found at timestamp {}",
                            ts
                        ))
                    })?
            }
            None => {
                // Get the latest deployment
                self.state_manager
                    .get_agent_state(agent_id)?
                    .ok_or_else(|| {
                        DeploymentError::RollbackFailed(format!(
                            "No deployment found for agent {}",
                            agent_id
                        ))
                    })?
            }
        };

        // Perform rollback
        deployer.rollback(&state)?;

        // If there's a backup, restore it
        if let Some(backup_path) = &state.backup_path {
            let backup = PathBuf::from(backup_path);
            let original_paths: Vec<PathBuf> = state
                .files_created
                .iter()
                .map(|f| PathBuf::from(f))
                .collect();

            self.backup_manager.restore_backup(&backup, &original_paths)?;
        }

        // Remove the deployment from state
        self.state_manager.remove_latest_deployment(agent_id)?;

        self.logger.log_success(
            agent_id,
            logger::DeploymentOperation::Rollback,
            Some("Rollback completed successfully".to_string()),
        )?;

        Ok(())
    }

    /// Get deployment status for an agent
    pub fn get_status(&self, agent_id: &str) -> DeploymentResult<AgentStatus> {
        let deployer = self
            .registry
            .get_deployer(agent_id)
            .ok_or_else(|| DeploymentError::agent_not_found(agent_id))?;

        deployer.get_status()
    }

    /// Get deployment history for an agent
    pub fn get_history(&self, agent_id: &str) -> DeploymentResult<Vec<DeploymentState>> {
        self.state_manager.get_agent_history(agent_id)
    }

    /// Validate a deployment without executing it
    pub fn validate_deployment(&self, config: &DeploymentConfig) -> DeploymentResult<ValidationReport> {
        let deployer = self
            .registry
            .get_deployer(&config.agent_id)
            .ok_or_else(|| DeploymentError::agent_not_found(&config.agent_id))?;

        let prepared = deployer.prepare(config)?;
        let validation = deployer.validate(&prepared)?;
        self.merge_with_command_validation(validation, config)
    }

    /// Preview a deployment without executing it
    pub fn preview_deployment(&self, config: &DeploymentConfig) -> DeploymentResult<PreparedDeployment> {
        let deployer = self
            .registry
            .get_deployer(&config.agent_id)
            .ok_or_else(|| DeploymentError::agent_not_found(&config.agent_id))?;

        let prepared = deployer.prepare(config)?;

        // Also validate to include any warnings
        let _ = deployer.validate(&prepared)?;

        Ok(prepared)
    }

    /// Get all available agent IDs
    pub fn available_agents(&self) -> Vec<String> {
        self.registry.agent_ids()
    }
}

/// Helper function to generate AGENTS.md content from pack IDs
pub fn generate_agents_md_content(
    pack_ids: &[String],
    inline_content: bool,
) -> DeploymentResult<String> {
    let result = ipc::generate_agents_md(
        pack_ids.to_vec(),
        Some(true),  // include_metadata
        Some(inline_content),
    )
    .map_err(|e| DeploymentError::ConfigurationError(e))?;

    if !result.success {
        return Err(DeploymentError::ConfigurationError(
            result.error.unwrap_or_else(|| "Failed to generate AGENTS.md".to_string()),
        ));
    }

    Ok(result.content)
}

/// Resolved out-reference ready for deployment
#[derive(Debug, Clone)]
pub struct ResolvedOutReference {
    pub file_path: String,
    pub source_path: PathBuf,
    pub content: String,
}

/// Collect out-references required by the selected commands and packs
pub fn collect_out_references_for_selection(
    command_ids: &[String],
    pack_ids: &[String],
) -> DeploymentResult<Vec<ResolvedOutReference>> {
    let mut requested_paths: Vec<String> = Vec::new();

    // Commands
    for command_id in command_ids {
        let command = command_registry::get_command_by_id(command_id)
            .map_err(DeploymentError::ConfigurationError)?;
        requested_paths.extend(command.out_references.clone());
    }

    // Packs (respect overrides stored in metadata)
    let pack_overrides = fs_manager::read_pack_out_ref_overrides().unwrap_or_default();
    for pack_id in pack_ids {
        let json = fs_manager::read_pack_json(pack_id.clone())
            .map_err(|e| DeploymentError::ConfigurationError(e.to_string()))?;
        let mut pack: RulePack = serde_json::from_str(&json)
            .map_err(|e| DeploymentError::ConfigurationError(e.to_string()))?;
        if let Some(refs) = pack_overrides.get(pack_id) {
            pack.out_references = refs.clone();
        }
        requested_paths.extend(pack.out_references.clone());
    }

    requested_paths.sort();
    requested_paths.dedup();

    if requested_paths.is_empty() {
        return Ok(Vec::new());
    }

    let available_refs = out_reference_manager::list_out_references()
        .map_err(DeploymentError::ConfigurationError)?;
    let base_dir = out_reference_manager::get_out_references_dir();
    let mut resolved: Vec<ResolvedOutReference> = Vec::new();

    for path in requested_paths {
        if let Some(meta) = available_refs
            .iter()
            .find(|r| path.contains(&r.file_path) || r.file_path.contains(&path))
        {
            let content = out_reference_manager::read_out_reference_content(meta.id.clone())
                .map_err(DeploymentError::ConfigurationError)?;
            resolved.push(ResolvedOutReference {
                file_path: meta.file_path.clone(),
                source_path: base_dir.join(&meta.file_path),
                content,
            });
        } else {
            return Err(DeploymentError::ConfigurationError(format!(
                "Out-reference not found for path: {}",
                path
            )));
        }
    }

    Ok(resolved)
}

/// Shared base deployer implementation for common functionality
pub struct BaseDeployer {
    agent: crate::types::AgentDefinition,
}

impl BaseDeployer {
    pub fn new(agent: crate::types::AgentDefinition) -> Self {
        Self { agent }
    }

    pub fn agent(&self) -> &crate::types::AgentDefinition {
        &self.agent
    }

    pub fn agent_id(&self) -> &str {
        &self.agent.id
    }

    pub fn character_limit(&self) -> Option<u64> {
        self.agent.character_limits.max_chars
    }

    /// Generate AGENTS.md content for this agent
    pub fn generate_agents_md(&self, pack_ids: &[String], inline: bool) -> DeploymentResult<String> {
        generate_agents_md_content(pack_ids, inline)
    }

    /// Get the config path for this agent
    pub fn get_config_path(&self) -> DeploymentResult<PathBuf> {
        fs_manager::get_agent_config_path(self.agent.id.clone())
            .map_err(|e| DeploymentError::ConfigurationError(e.to_string()))
    }

    /// Check if agent is installed
    pub fn is_installed(&self) -> bool {
        if let Ok(path) = self.get_config_path() {
            path.parent().map(|p| p.exists()).unwrap_or(false)
        } else {
            false
        }
    }
}
