#!/usr/bin/env python3
"""Common utilities for AgentsToolkit workflow scripts.

Provides:
- Terminal colors with auto-detection
- Git command wrappers
- GitHub CLI wrappers
- Path utilities
- Output formatting helpers
"""

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple


class Colors:
    """ANSI color codes with terminal detection."""
    
    def __init__(self):
        # Only use colors if stdout is a TTY and TERM is not 'dumb'
        self.enabled = (
            sys.stdout.isatty() 
            and os.environ.get('TERM', 'dumb') != 'dumb'
        )
    
    @property
    def RED(self) -> str:
        return '\033[0;31m' if self.enabled else ''
    
    @property
    def GREEN(self) -> str:
        return '\033[0;32m' if self.enabled else ''
    
    @property
    def YELLOW(self) -> str:
        return '\033[1;33m' if self.enabled else ''
    
    @property
    def BLUE(self) -> str:
        return '\033[0;34m' if self.enabled else ''
    
    @property
    def PURPLE(self) -> str:
        return '\033[0;35m' if self.enabled else ''
    
    @property
    def NC(self) -> str:
        """No Color - reset."""
        return '\033[0m' if self.enabled else ''


# Global colors instance
colors = Colors()


def print_error(message: str) -> None:
    """Print error message in red."""
    print(f"{colors.RED}{message}{colors.NC}", file=sys.stderr)


def print_success(message: str) -> None:
    """Print success message in green."""
    print(f"{colors.GREEN}{message}{colors.NC}")


def print_warning(message: str) -> None:
    """Print warning message in yellow."""
    print(f"{colors.YELLOW}{message}{colors.NC}")


def print_info(message: str) -> None:
    """Print info message in blue."""
    print(f"{colors.BLUE}{message}{colors.NC}")


def run_command(
    cmd: List[str],
    capture_output: bool = True,
    check: bool = False,
    cwd: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None
) -> subprocess.CompletedProcess:
    """Run a command and return the result.
    
    Args:
        cmd: Command and arguments as list
        capture_output: Whether to capture stdout/stderr
        check: Whether to raise exception on non-zero exit
        cwd: Working directory for command
        env: Environment variables (merged with os.environ)
        
    Returns:
        CompletedProcess with stdout/stderr as strings
    """
    final_env = os.environ.copy()
    if env:
        final_env.update(env)
    
    return subprocess.run(
        cmd,
        capture_output=capture_output,
        text=True,
        check=check,
        cwd=cwd,
        env=final_env
    )


def run_git(*args: str, cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
    """Run git command and return result.
    
    Args:
        *args: Git arguments
        cwd: Working directory (defaults to current)
        
    Returns:
        CompletedProcess with stdout/stderr
    """
    return run_command(['git', *args], cwd=cwd)


def run_gh(
    *args: str,
    json_output: bool = False,
    cwd: Optional[Path] = None
) -> Tuple[subprocess.CompletedProcess, Optional[Any]]:
    """Run GitHub CLI command and optionally parse JSON.
    
    Args:
        *args: gh CLI arguments
        json_output: Whether to parse output as JSON
        cwd: Working directory
        
    Returns:
        Tuple of (CompletedProcess, parsed_json or None)
    """
    result = run_command(['gh', *args], cwd=cwd)
    
    if result.returncode != 0 and result.stderr:
        print_error(f"GitHub CLI Error: {result.stderr.strip()}")
    
    if json_output and result.returncode == 0 and result.stdout:
        try:
            parsed = json.loads(result.stdout)
            return result, parsed
        except json.JSONDecodeError:
            print_error(f"Failed to parse JSON output from gh: {result.stdout}")
            return result, None
    
    return result, None


def check_git_repo() -> bool:
    """Check if current directory is in a git repository.
    
    Returns:
        True if in git repo, False otherwise
    """
    result = run_git('rev-parse', '--git-dir')
    return result.returncode == 0


def get_repo_root() -> Optional[Path]:
    """Get the root directory of the git repository.
    
    Returns:
        Path to repo root, or None if not in a repo
    """
    result = run_git('rev-parse', '--show-toplevel')
    if result.returncode == 0 and result.stdout:
        return Path(result.stdout.strip())
    return None


def get_current_branch() -> Optional[str]:
    """Get the name of the current git branch.
    
    Returns:
        Branch name, or None if not on a branch
    """
    result = run_git('branch', '--show-current')
    if result.returncode == 0 and result.stdout:
        return result.stdout.strip()
    return None


def check_gh_auth() -> Tuple[bool, Optional[str]]:
    """Check if GitHub CLI is authenticated.
    
    Returns:
        Tuple of (is_authenticated, username or None)
    """
    result = run_command(['gh', 'auth', 'status'])
    if result.returncode == 0:
        # Try to get username
        result2, parsed = run_gh('api', 'user', '-q', '.login', json_output=False)
        if result2.returncode == 0 and result2.stdout:
            return True, result2.stdout.strip()
        return True, None
    return False, None


def get_repo_info() -> Optional[Dict[str, str]]:
    """Get repository owner and name from GitHub.
    
    Returns:
        Dict with 'owner' and 'name', or None if not available
    """
    result, parsed = run_gh('repo', 'view', '--json', 'owner,name', json_output=True)
    if parsed:
        return {
            'owner': parsed.get('owner', {}).get('login', ''),
            'name': parsed.get('name', '')
        }
    return None


def sanitize_branch_name(text: str, max_length: int = 50) -> str:
    """Convert text to valid git branch name component.
    
    Args:
        text: Input text
        max_length: Maximum length for output
        
    Returns:
        Sanitized branch name component
    """
    import re
    # Convert to lowercase
    result = text.lower()
    # Replace non-alphanumeric with dash
    result = re.sub(r'[^a-z0-9]+', '-', result)
    # Remove leading/trailing dashes
    result = result.strip('-')
    # Collapse multiple dashes
    result = re.sub(r'-+', '-', result)
    # Limit length
    return result[:max_length]


def detect_branch_type(title: str) -> str:
    """Detect branch type from issue/commit title.
    
    Args:
        title: Issue or commit title
        
    Returns:
        Branch type: feat, fix, docs, refactor, chore, or test
    """
    title_lower = title.lower()
    
    if any(word in title_lower for word in ['fix', 'bug', 'error', 'broken', 'issue']):
        return 'fix'
    elif any(word in title_lower for word in ['test', 'spec', 'testing']):
        return 'test'
    elif any(word in title_lower for word in ['docs', 'documentation', 'readme']):
        return 'docs'
    elif any(word in title_lower for word in ['refactor', 'cleanup', 'optimize', 'restructure']):
        return 'refactor'
    elif any(word in title_lower for word in ['chore', 'update', 'upgrade', 'bump', 'deps']):
        return 'chore'
    else:
        # Default to feature
        return 'feat'


def format_branch_name(
    category: str,
    description: str,
    issue_num: Optional[int] = None
) -> str:
    """Format branch name per AGENTS.md conventions.
    
    Format: {type}/{issue-num}-{description} or {type}/pending-{description}
    
    Args:
        category: Branch type (feat, fix, docs, etc.)
        description: Short description
        issue_num: Issue number (optional)
        
    Returns:
        Formatted branch name
    """
    sanitized = sanitize_branch_name(description)
    
    if issue_num:
        return f"{category}/{issue_num}-{sanitized}"
    else:
        return f"{category}/pending-{sanitized}"


def check_command_exists(command: str) -> bool:
    """Check if a command exists in PATH.
    
    Args:
        command: Command name to check
        
    Returns:
        True if command exists, False otherwise
    """
    result = run_command(['which', command] if os.name != 'nt' else ['where', command])
    return result.returncode == 0

