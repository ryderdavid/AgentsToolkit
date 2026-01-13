//! Deployment state management
//!
//! Handles persistence of deployment state for rollback and history tracking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use super::error::{DeploymentError, DeploymentResult};
use crate::fs_manager;

/// State of a single deployment
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentState {
    /// The agent that was deployed to
    pub agent_id: String,
    /// When the deployment occurred
    pub timestamp: DateTime<Utc>,
    /// Rule packs that were deployed
    pub deployed_packs: Vec<String>,
    /// Custom commands that were deployed
    pub deployed_commands: Vec<String>,
    /// Files that were created during deployment
    pub files_created: Vec<String>,
    /// Path to backup directory (if any)
    pub backup_path: Option<String>,
    /// The deployment method used
    pub method: String,
    /// Whether this was a user-level or project-level deployment
    pub target_level: String,
    /// Project path (for project-level deployments)
    pub project_path: Option<String>,
}

impl DeploymentState {
    pub fn new(agent_id: String, method: String, target_level: String) -> Self {
        Self {
            agent_id,
            timestamp: Utc::now(),
            deployed_packs: Vec::new(),
            deployed_commands: Vec::new(),
            files_created: Vec::new(),
            backup_path: None,
            method,
            target_level,
            project_path: None,
        }
    }

    pub fn with_packs(mut self, packs: Vec<String>) -> Self {
        self.deployed_packs = packs;
        self
    }

    pub fn with_commands(mut self, commands: Vec<String>) -> Self {
        self.deployed_commands = commands;
        self
    }

    pub fn with_files(mut self, files: Vec<String>) -> Self {
        self.files_created = files;
        self
    }

    pub fn with_backup(mut self, backup_path: String) -> Self {
        self.backup_path = Some(backup_path);
        self
    }

    pub fn with_project(mut self, project_path: String) -> Self {
        self.project_path = Some(project_path);
        self
    }
}

/// Overall deployment state containing all deployments
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentStateStore {
    /// Version of the state format
    pub version: String,
    /// All deployment states keyed by agent ID
    pub deployments: HashMap<String, Vec<DeploymentState>>,
}

impl Default for DeploymentStateStore {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            deployments: HashMap::new(),
        }
    }
}

/// Manages deployment state persistence
pub struct StateManager {
    state_path: PathBuf,
}

impl StateManager {
    /// Create a new state manager
    pub fn new() -> DeploymentResult<Self> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let state_path = agentsmd_home.join("deployment-state.json");
        Ok(Self { state_path })
    }

    /// Get the state file path
    pub fn state_path(&self) -> &PathBuf {
        &self.state_path
    }

    /// Load the current state
    pub fn load_state(&self) -> DeploymentResult<DeploymentStateStore> {
        if !self.state_path.exists() {
            return Ok(DeploymentStateStore::default());
        }

        let content = fs::read_to_string(&self.state_path)
            .map_err(|e| DeploymentError::StateError(format!("Failed to read state file: {}", e)))?;

        serde_json::from_str(&content)
            .map_err(|e| DeploymentError::StateError(format!("Failed to parse state file: {}", e)))
    }

    /// Save the current state
    pub fn save_state(&self, state: &DeploymentStateStore) -> DeploymentResult<()> {
        // Ensure parent directory exists
        if let Some(parent) = self.state_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                DeploymentError::fs_error(&self.state_path, format!("Failed to create directory: {}", e))
            })?;
        }

        let content = serde_json::to_string_pretty(state)
            .map_err(|e| DeploymentError::StateError(format!("Failed to serialize state: {}", e)))?;

        fs::write(&self.state_path, content)
            .map_err(|e| DeploymentError::fs_error(&self.state_path, format!("Failed to write state: {}", e)))
    }

    /// Record a new deployment
    pub fn record_deployment(&self, state: DeploymentState) -> DeploymentResult<()> {
        let mut store = self.load_state()?;

        let agent_states = store.deployments.entry(state.agent_id.clone()).or_insert_with(Vec::new);
        agent_states.push(state);

        // Keep only the last 10 deployments per agent
        if agent_states.len() > 10 {
            agent_states.drain(0..agent_states.len() - 10);
        }

        self.save_state(&store)
    }

    /// Get deployment state for a specific agent
    pub fn get_agent_state(&self, agent_id: &str) -> DeploymentResult<Option<DeploymentState>> {
        let store = self.load_state()?;
        Ok(store
            .deployments
            .get(agent_id)
            .and_then(|states| states.last().cloned()))
    }

    /// Get deployment history for a specific agent
    pub fn get_agent_history(&self, agent_id: &str) -> DeploymentResult<Vec<DeploymentState>> {
        let store = self.load_state()?;
        Ok(store
            .deployments
            .get(agent_id)
            .cloned()
            .unwrap_or_default())
    }

    /// Get deployment by timestamp
    pub fn get_deployment_by_timestamp(
        &self,
        agent_id: &str,
        timestamp: &DateTime<Utc>,
    ) -> DeploymentResult<Option<DeploymentState>> {
        let store = self.load_state()?;
        Ok(store.deployments.get(agent_id).and_then(|states| {
            states
                .iter()
                .find(|s| &s.timestamp == timestamp)
                .cloned()
        }))
    }

    /// Clear deployment state for a specific agent
    pub fn clear_agent_state(&self, agent_id: &str) -> DeploymentResult<()> {
        let mut store = self.load_state()?;
        store.deployments.remove(agent_id);
        self.save_state(&store)
    }

    /// Remove the latest deployment for an agent
    pub fn remove_latest_deployment(&self, agent_id: &str) -> DeploymentResult<Option<DeploymentState>> {
        let mut store = self.load_state()?;
        
        if let Some(states) = store.deployments.get_mut(agent_id) {
            let removed = states.pop();
            self.save_state(&store)?;
            Ok(removed)
        } else {
            Ok(None)
        }
    }
}

/// Manages backup creation and restoration
pub struct BackupManager {
    backup_root: PathBuf,
}

impl BackupManager {
    /// Create a new backup manager
    pub fn new() -> DeploymentResult<Self> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let backup_root = agentsmd_home.join("backups");
        Ok(Self { backup_root })
    }

    /// Create a backup of existing files before deployment
    pub fn create_backup(
        &self,
        agent_id: &str,
        files_to_backup: &[PathBuf],
    ) -> DeploymentResult<Option<PathBuf>> {
        if files_to_backup.is_empty() {
            return Ok(None);
        }

        // Check if any files actually exist
        let existing_files: Vec<_> = files_to_backup
            .iter()
            .filter(|f| f.exists())
            .collect();

        if existing_files.is_empty() {
            return Ok(None);
        }

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_dir = self.backup_root.join(agent_id).join(timestamp.to_string());

        fs::create_dir_all(&backup_dir).map_err(|e| {
            DeploymentError::BackupFailed(format!("Failed to create backup directory: {}", e))
        })?;

        for file in existing_files {
            let relative = file
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let backup_path = backup_dir.join(&relative);

            if file.is_dir() {
                copy_dir_all(file, &backup_path)?;
            } else {
                fs::copy(file, &backup_path).map_err(|e| {
                    DeploymentError::BackupFailed(format!("Failed to backup {}: {}", relative, e))
                })?;
            }
        }

        // Clean up old backups (keep last 5)
        self.cleanup_old_backups(agent_id, 5)?;

        Ok(Some(backup_dir))
    }

    /// Restore files from a backup
    pub fn restore_backup(&self, backup_path: &PathBuf, original_paths: &[PathBuf]) -> DeploymentResult<()> {
        if !backup_path.exists() {
            return Err(DeploymentError::RollbackFailed(
                "Backup directory does not exist".to_string(),
            ));
        }

        for entry in fs::read_dir(backup_path).map_err(|e| {
            DeploymentError::RollbackFailed(format!("Failed to read backup directory: {}", e))
        })? {
            let entry = entry.map_err(|e| {
                DeploymentError::RollbackFailed(format!("Failed to read backup entry: {}", e))
            })?;

            let backup_file = entry.path();
            let file_name = backup_file
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Find the original path for this file
            if let Some(original) = original_paths.iter().find(|p| {
                p.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default()
                    == file_name
            }) {
                // Remove current file/dir
                if original.exists() {
                    if original.is_dir() {
                        fs::remove_dir_all(original).map_err(|e| {
                            DeploymentError::RollbackFailed(format!(
                                "Failed to remove {}: {}",
                                original.display(),
                                e
                            ))
                        })?;
                    } else {
                        fs::remove_file(original).map_err(|e| {
                            DeploymentError::RollbackFailed(format!(
                                "Failed to remove {}: {}",
                                original.display(),
                                e
                            ))
                        })?;
                    }
                }

                // Restore from backup
                if backup_file.is_dir() {
                    copy_dir_all(&backup_file, original)?;
                } else {
                    fs::copy(&backup_file, original).map_err(|e| {
                        DeploymentError::RollbackFailed(format!(
                            "Failed to restore {}: {}",
                            file_name,
                            e
                        ))
                    })?;
                }
            }
        }

        Ok(())
    }

    /// Clean up old backups, keeping only the most recent ones
    fn cleanup_old_backups(&self, agent_id: &str, keep_count: usize) -> DeploymentResult<()> {
        let agent_backup_dir = self.backup_root.join(agent_id);

        if !agent_backup_dir.exists() {
            return Ok(());
        }

        let mut backups: Vec<_> = fs::read_dir(&agent_backup_dir)
            .map_err(|e| {
                DeploymentError::BackupFailed(format!("Failed to read backup directory: {}", e))
            })?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .collect();

        // Sort by name (which includes timestamp)
        backups.sort_by_key(|e| e.path());

        // Remove oldest backups if we have too many
        if backups.len() > keep_count {
            let to_remove = backups.len() - keep_count;
            for entry in backups.into_iter().take(to_remove) {
                fs::remove_dir_all(entry.path()).map_err(|e| {
                    DeploymentError::BackupFailed(format!(
                        "Failed to remove old backup: {}",
                        e
                    ))
                })?;
            }
        }

        Ok(())
    }
}

/// Recursively copy a directory
fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> DeploymentResult<()> {
    fs::create_dir_all(dst).map_err(|e| {
        DeploymentError::BackupFailed(format!("Failed to create directory {}: {}", dst.display(), e))
    })?;

    for entry in fs::read_dir(src).map_err(|e| {
        DeploymentError::BackupFailed(format!("Failed to read directory {}: {}", src.display(), e))
    })? {
        let entry = entry.map_err(|e| {
            DeploymentError::BackupFailed(format!("Failed to read entry: {}", e))
        })?;

        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| {
                DeploymentError::BackupFailed(format!(
                    "Failed to copy {}: {}",
                    src_path.display(),
                    e
                ))
            })?;
        }
    }

    Ok(())
}
