//! Project-level detection utilities
//!
//! Handles detection of project roots and project-level configuration paths.

use std::env;
use std::path::PathBuf;

use super::error::{DeploymentError, DeploymentResult};

/// Detects project roots and provides project-level paths
pub struct ProjectDetector;

impl ProjectDetector {
    /// Detect the project root by walking up from the current directory
    /// 
    /// Looks for common project indicators like .git, package.json, Cargo.toml, etc.
    pub fn detect_project_root() -> Option<PathBuf> {
        let current_dir = env::current_dir().ok()?;
        Self::detect_project_root_from(&current_dir)
    }

    /// Detect project root from a specific starting directory
    pub fn detect_project_root_from(start_dir: &PathBuf) -> Option<PathBuf> {
        let mut current = start_dir.clone();

        loop {
            // Check for .git directory (most common indicator)
            if current.join(".git").exists() {
                return Some(current);
            }

            // Check for other project indicators
            if current.join("package.json").exists()
                || current.join("Cargo.toml").exists()
                || current.join("pyproject.toml").exists()
                || current.join("go.mod").exists()
                || current.join(".agentsmd").exists()
            {
                return Some(current);
            }

            // Move up to parent directory
            if let Some(parent) = current.parent() {
                if parent == current {
                    // Reached filesystem root
                    break;
                }
                current = parent.to_path_buf();
            } else {
                break;
            }
        }

        None
    }

    /// Get the project-level config path for a specific agent
    pub fn get_project_config_path(agent_id: &str, project_root: &PathBuf) -> DeploymentResult<PathBuf> {
        let config_path = match agent_id.to_lowercase().as_str() {
            "copilot" => project_root.join(".github").join("copilot-instructions.md"),
            "cline" => project_root.join(".cline").join("config.json"),
            "cursor" => project_root.join(".cursor").join("rules.md"),
            "claude" => project_root.join(".claude").join("CLAUDE.md"),
            "gemini" => project_root.join(".gemini").join("GEMINI.md"),
            "aider" => project_root.join(".aider.conf.yml"),
            "azure_devops" | "azuredevops" => project_root.join(".azure-pipelines").join("agents.md"),
            "roocode" => project_root.join(".roo").join("rules.md"),
            "kilocode" => project_root.join(".kilo").join("rules.md"),
            _ => {
                return Err(DeploymentError::ConfigurationError(format!(
                    "Agent '{}' does not support project-level configuration",
                    agent_id
                )));
            }
        };

        Ok(config_path)
    }

    /// Check if an agent supports project-level deployment
    pub fn supports_project_level(agent_id: &str) -> bool {
        matches!(
            agent_id.to_lowercase().as_str(),
            "copilot" | "cline" | "cursor" | "claude" | "gemini" | "aider" | "azure_devops" | "azuredevops" | "roocode" | "kilocode"
        )
    }

    /// Get all project indicators (files/directories that indicate a project root)
    pub fn project_indicators() -> &'static [&'static str] {
        &[
            ".git",
            "package.json",
            "Cargo.toml",
            "pyproject.toml",
            "go.mod",
            "Makefile",
            ".agentsmd",
            "requirements.txt",
            "setup.py",
            "pom.xml",
            "build.gradle",
            "CMakeLists.txt",
        ]
    }

    /// Validate that a path is a valid project root
    pub fn is_valid_project_root(path: &PathBuf) -> bool {
        if !path.exists() || !path.is_dir() {
            return false;
        }

        Self::project_indicators()
            .iter()
            .any(|indicator| path.join(indicator).exists())
    }
}

/// Information about a detected project
#[derive(Debug, Clone)]
pub struct ProjectInfo {
    /// The project root path
    pub root: PathBuf,
    /// Detected project type based on indicators
    pub project_type: ProjectType,
    /// Name of the project (from directory or manifest)
    pub name: String,
}

impl ProjectInfo {
    pub fn from_root(root: PathBuf) -> Option<Self> {
        if !root.exists() {
            return None;
        }

        let project_type = Self::detect_project_type(&root);
        let name = Self::extract_project_name(&root, &project_type);

        Some(Self {
            root,
            project_type,
            name,
        })
    }

    fn detect_project_type(root: &PathBuf) -> ProjectType {
        if root.join("package.json").exists() {
            ProjectType::Node
        } else if root.join("Cargo.toml").exists() {
            ProjectType::Rust
        } else if root.join("pyproject.toml").exists() || root.join("setup.py").exists() {
            ProjectType::Python
        } else if root.join("go.mod").exists() {
            ProjectType::Go
        } else if root.join("pom.xml").exists() || root.join("build.gradle").exists() {
            ProjectType::Java
        } else {
            ProjectType::Unknown
        }
    }

    fn extract_project_name(root: &PathBuf, _project_type: &ProjectType) -> String {
        // Try to get name from directory
        root.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

/// Detected project type
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectType {
    Node,
    Rust,
    Python,
    Go,
    Java,
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_detect_git_project() {
        let temp = tempdir().unwrap();
        fs::create_dir(temp.path().join(".git")).unwrap();

        let root = ProjectDetector::detect_project_root_from(&temp.path().to_path_buf());
        assert!(root.is_some());
        assert_eq!(root.unwrap(), temp.path());
    }

    #[test]
    fn test_supports_project_level() {
        assert!(ProjectDetector::supports_project_level("copilot"));
        assert!(ProjectDetector::supports_project_level("cline"));
        assert!(!ProjectDetector::supports_project_level("warp"));
    }
}
