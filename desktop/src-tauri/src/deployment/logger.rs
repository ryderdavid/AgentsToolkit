//! Deployment logging
//!
//! Provides structured logging for deployment operations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;

use super::error::DeploymentResult;
use crate::fs_manager;

/// Log entry for a deployment operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentLogEntry {
    /// Timestamp of the operation
    pub timestamp: DateTime<Utc>,
    /// The agent being deployed to
    pub agent_id: String,
    /// The operation being performed
    pub operation: DeploymentOperation,
    /// Result of the operation
    pub result: OperationResult,
    /// Any errors that occurred
    pub errors: Vec<String>,
    /// Additional context
    pub context: Option<String>,
}

/// Types of deployment operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentOperation {
    Prepare,
    Validate,
    Deploy,
    Rollback,
    Backup,
    Restore,
}

/// Result of an operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationResult {
    Success,
    Failure,
    Skipped,
}

/// Deployment logger
pub struct DeploymentLogger {
    log_path: PathBuf,
    max_size_bytes: u64,
    max_files: usize,
}

impl DeploymentLogger {
    /// Create a new deployment logger
    pub fn new() -> DeploymentResult<Self> {
        let agentsmd_home = fs_manager::get_agentsmd_home();
        let log_dir = agentsmd_home.join("logs");
        fs::create_dir_all(&log_dir).ok();

        let log_path = log_dir.join("deployment.log");

        Ok(Self {
            log_path,
            max_size_bytes: 1024 * 1024, // 1MB
            max_files: 10,
        })
    }

    /// Log a deployment entry
    pub fn log(&self, entry: &DeploymentLogEntry) -> DeploymentResult<()> {
        // Check if rotation is needed
        if self.needs_rotation() {
            self.rotate_logs()?;
        }

        // Open log file in append mode
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)?;

        let mut writer = BufWriter::new(file);

        // Write JSON line
        let json = serde_json::to_string(entry)?;
        writeln!(writer, "{}", json)?;

        Ok(())
    }

    /// Log a successful operation
    pub fn log_success(
        &self,
        agent_id: &str,
        operation: DeploymentOperation,
        context: Option<String>,
    ) -> DeploymentResult<()> {
        let entry = DeploymentLogEntry {
            timestamp: Utc::now(),
            agent_id: agent_id.to_string(),
            operation,
            result: OperationResult::Success,
            errors: Vec::new(),
            context,
        };
        self.log(&entry)
    }

    /// Log a failed operation
    pub fn log_failure(
        &self,
        agent_id: &str,
        operation: DeploymentOperation,
        errors: Vec<String>,
        context: Option<String>,
    ) -> DeploymentResult<()> {
        let entry = DeploymentLogEntry {
            timestamp: Utc::now(),
            agent_id: agent_id.to_string(),
            operation,
            result: OperationResult::Failure,
            errors,
            context,
        };
        self.log(&entry)
    }

    /// Check if log rotation is needed
    fn needs_rotation(&self) -> bool {
        if !self.log_path.exists() {
            return false;
        }

        match fs::metadata(&self.log_path) {
            Ok(meta) => meta.len() >= self.max_size_bytes,
            Err(_) => false,
        }
    }

    /// Rotate log files
    fn rotate_logs(&self) -> DeploymentResult<()> {
        // Get log directory
        let log_dir = self.log_path.parent().ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::Other, "Invalid log path")
        })?;

        // Find existing rotated logs
        let mut rotated_logs: Vec<_> = fs::read_dir(log_dir)?
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("deployment.")
                    && e.file_name().to_string_lossy().ends_with(".log")
            })
            .collect();

        // Sort by name (which includes number)
        rotated_logs.sort_by_key(|e| e.path());

        // Remove oldest if we have too many
        while rotated_logs.len() >= self.max_files {
            if let Some(oldest) = rotated_logs.first() {
                fs::remove_file(oldest.path()).ok();
                rotated_logs.remove(0);
            }
        }

        // Rename current log
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let rotated_name = format!("deployment.{}.log", timestamp);
        let rotated_path = log_dir.join(rotated_name);

        fs::rename(&self.log_path, rotated_path)?;

        Ok(())
    }

    /// Read recent log entries
    pub fn read_recent(&self, count: usize) -> DeploymentResult<Vec<DeploymentLogEntry>> {
        if !self.log_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&self.log_path)?;
        let entries: Vec<DeploymentLogEntry> = content
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();

        // Return the last `count` entries
        let start = entries.len().saturating_sub(count);
        Ok(entries[start..].to_vec())
    }

    /// Read entries for a specific agent
    pub fn read_for_agent(&self, agent_id: &str, count: usize) -> DeploymentResult<Vec<DeploymentLogEntry>> {
        let all_entries = self.read_recent(count * 10)?; // Read more to filter

        let filtered: Vec<_> = all_entries
            .into_iter()
            .filter(|e| e.agent_id == agent_id)
            .collect();

        let start = filtered.len().saturating_sub(count);
        Ok(filtered[start..].to_vec())
    }
}

impl Default for DeploymentLogger {
    fn default() -> Self {
        Self::new().unwrap_or_else(|_| Self {
            log_path: PathBuf::from("deployment.log"),
            max_size_bytes: 1024 * 1024,
            max_files: 10,
        })
    }
}
