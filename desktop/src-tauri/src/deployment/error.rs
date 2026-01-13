//! Deployment error types
//! 
//! Defines custom error types for the deployment system with proper error context.

use std::path::PathBuf;
use thiserror::Error;

/// Errors that can occur during deployment operations
#[derive(Error, Debug)]
pub enum DeploymentError {
    #[error("Validation failed: {0}")]
    ValidationFailed(String),

    #[error("File system error at {path}: {message}")]
    FileSystemError {
        path: PathBuf,
        message: String,
    },

    #[error("Format conversion error: {0}")]
    FormatConversionError(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Rollback failed: {0}")]
    RollbackFailed(String),

    #[error("State error: {0}")]
    StateError(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Character limit exceeded: {current} / {limit} characters")]
    CharacterLimitExceeded {
        current: u64,
        limit: u64,
    },

    #[error("Backup failed: {0}")]
    BackupFailed(String),

    #[error("Agent not installed: {0}")]
    AgentNotInstalled(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("YAML error: {0}")]
    YamlError(#[from] serde_yaml::Error),

    #[error("TOML serialization error: {0}")]
    TomlSerError(#[from] toml::ser::Error),

    #[error("TOML deserialization error: {0}")]
    TomlDeError(#[from] toml::de::Error),
}

impl DeploymentError {
    /// Create a file system error with context
    pub fn fs_error(path: impl Into<PathBuf>, message: impl Into<String>) -> Self {
        DeploymentError::FileSystemError {
            path: path.into(),
            message: message.into(),
        }
    }

    /// Create a validation error
    pub fn validation(message: impl Into<String>) -> Self {
        DeploymentError::ValidationFailed(message.into())
    }

    /// Create a format conversion error
    pub fn format_error(message: impl Into<String>) -> Self {
        DeploymentError::FormatConversionError(message.into())
    }

    /// Create an agent not found error
    pub fn agent_not_found(agent_id: impl Into<String>) -> Self {
        DeploymentError::AgentNotFound(agent_id.into())
    }

    /// Check if this error is recoverable (can retry)
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            DeploymentError::IoError(_) | DeploymentError::FileSystemError { .. }
        )
    }
}

/// Result type alias for deployment operations
pub type DeploymentResult<T> = Result<T, DeploymentError>;
