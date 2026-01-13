#!/usr/bin/env python3
"""AgentsToolkit Unified Commands Build Script

Converts Cursor-format Markdown commands to all agent formats (Cursor, Claude Code, Codex CLI, Gemini CLI, Antigravity).
Cross-platform Python implementation.
"""

import os
import re
import shutil
import sys
from pathlib import Path

# Add scripts/lib to path for common utilities
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from lib.common import colors, print_error, print_success, print_warning, print_info
from lib.symlinks import create_link
from lib.agent_registry import load_agent_registry, AgentRegistryError

# ============================================================================
# Configuration
# ============================================================================

RESERVED_COMMANDS = ["help", "clear", "model", "quit", "exit", "compact", "init", "review", "plan"]
SUPPORTED_AGENT_IDS = ["cursor", "claude", "codex", "gemini", "antigravity"]

AGENTSMD_DIR = Path(os.environ.get("AGENTSMD_HOME", Path.home() / ".agentsmd"))
SRC_DIR = AGENTSMD_DIR / "commands" / "src"
BUILD_DIR = AGENTSMD_DIR / "build"


# ============================================================================
# Logging
# ============================================================================

def log_info(msg: str) -> None:
    """Log info message."""
    print_success(f"✓ {msg}")


def log_warn(msg: str) -> None:
    """Log warning message."""
    print_warning(f"⚠ {msg}")


def log_error(msg: str) -> None:
    """Log error message."""
    print_error(f"✗ {msg}")


def log_step(msg: str) -> None:
    """Log step message."""
    print_info(f"→ {msg}")


# ============================================================================
# Registry Helpers
# ============================================================================

def load_registry():
    """Load agent registry data and return as dict keyed by id."""
    try:
        agents = load_agent_registry()
    except AgentRegistryError as exc:
        log_error(f"Failed to load agent registry: {exc}")
        sys.exit(1)

    agent_map = {agent["id"]: agent for agent in agents}
    return agent_map


def expand_path(path_str: str) -> Path:
    """Resolve user paths like ~/.cursor/commands."""
    return Path(os.path.expanduser(path_str)).resolve()


# ============================================================================
# Validation
# ============================================================================

def validate_source_dir() -> None:
    """Validate that source directory exists and contains .md files."""
    if not SRC_DIR.exists():
        log_error(f"Source directory not found: {SRC_DIR}")
        sys.exit(1)
    
    md_files = list(SRC_DIR.glob("*.md"))
    if not md_files:
        log_error(f"No .md files found in {SRC_DIR}")
        sys.exit(1)
    
    log_info(f"Found {len(md_files)} source commands")


def validate_filename(file_path: Path) -> bool:
    """Validate a single command filename.
    
    Args:
        file_path: Path to the markdown file
        
    Returns:
        True if valid, False otherwise
    """
    basename = file_path.stem
    
    # Check format: lowercase, alphanumeric, hyphens only
    if not re.match(r'^[a-z0-9-]+$', basename):
        log_error(f"Invalid filename: {basename} (use lowercase, numbers, hyphens only)")
        return False
    
    # Check reserved names
    if basename in RESERVED_COMMANDS:
        log_error(f"Reserved command name: {basename}")
        return False
    
    return True


def validate_all() -> None:
    """Validate all source command files."""
    log_step("Validating source commands...")
    
    errors = 0
    for md_file in SRC_DIR.glob("*.md"):
        if not validate_filename(md_file):
            errors += 1
    
    if errors > 0:
        log_error(f"Validation failed with {errors} errors")
        sys.exit(1)
    
    log_info("All commands validated")


# ============================================================================
# Conversion Functions
# ============================================================================

def convert_to_cursor(src: Path, dest_root: Path) -> None:
    """Convert source file to Cursor format (direct copy).
    
    Args:
        src: Source markdown file path
    """
    rel_path = src.relative_to(SRC_DIR)
    dest = dest_root / rel_path
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def convert_to_claude(src: Path, dest_root: Path) -> None:
    """Convert source file to Claude Code format (add frontmatter).
    
    Args:
        src: Source markdown file path
    """
    rel_path = src.relative_to(SRC_DIR)
    dest = dest_root / rel_path
    basename = src.stem
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    content = f"""---
description: AgentsToolkit {basename} command
---
{src.read_text()}
"""
    dest.write_text(content)


def convert_to_codex(src: Path, dest_root: Path) -> None:
    """Convert source file to Codex CLI format (add frontmatter).
    
    Args:
        src: Source markdown file path
    """
    rel_path = src.relative_to(SRC_DIR)
    dest = dest_root / rel_path
    basename = src.stem
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    content = f"""---
description: AgentsToolkit {basename} command
---
{src.read_text()}
"""
    dest.write_text(content)


def convert_to_gemini(src: Path, dest_root: Path) -> None:
    """Convert source file to Gemini CLI format (TOML).
    
    Args:
        src: Source markdown file path
    """
    rel_path = src.relative_to(SRC_DIR)
    basename = rel_path.stem
    dest = dest_root / rel_path.with_suffix('.toml')
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    # Replace path for Gemini sandbox visibility
    text = src.read_text().replace("~/.agentsmd/scripts", "~/.gemini/scripts")
    
    content = f'''description = "AgentsToolkit {basename} command"
prompt = """
{text}
"""
'''
    dest.write_text(content)


def convert_to_antigravity(src: Path, dest_root: Path) -> None:
    """Convert source file to Antigravity Workflow format (Markdown).
    
    Structure: global_workflows/{command_name}.md
    Adds YAML frontmatter.
    
    Args:
        src: Source markdown file path
    """
    basename = src.stem
    dest = dest_root / f"{basename}.md"
    
    dest.parent.mkdir(parents=True, exist_ok=True)
    
    # Replace path for Antigravity sandbox visibility
    text = src.read_text().replace("~/.agentsmd/scripts", "~/.gemini/scripts")
    
    content = f"""---
name: {basename}
description: AgentsToolkit {basename} command
---
{text}
"""
    dest.write_text(content)


# ============================================================================
# Build
# ============================================================================

def build() -> None:
    """Build commands for all agents."""
    log_step(f"Building commands from {SRC_DIR}")
    
    registry = load_registry()
    missing_agents = [agent_id for agent_id in SUPPORTED_AGENT_IDS if agent_id not in registry]
    if missing_agents:
        log_error(f"Registry missing required agents: {', '.join(missing_agents)}")
        sys.exit(1)

    dest_roots = {agent_id: BUILD_DIR / registry[agent_id]["buildOutput"] for agent_id in SUPPORTED_AGENT_IDS}

    # Clean previous build
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    
    # Create build directories
    for dest in dest_roots.values():
        dest.mkdir(parents=True, exist_ok=True)
    
    count = 0
    for src_file in sorted(SRC_DIR.glob("*.md")):
        rel_path = src_file.relative_to(SRC_DIR)
        log_info(f"Converting: {rel_path}")
        
        convert_to_cursor(src_file, dest_roots["cursor"])
        convert_to_claude(src_file, dest_roots["claude"])
        convert_to_codex(src_file, dest_roots["codex"])
        convert_to_gemini(src_file, dest_roots["gemini"])
        convert_to_antigravity(src_file, dest_roots["antigravity"])
        
        count += 1
    
    log_info(f"Built {count} commands for {len(SUPPORTED_AGENT_IDS)} agents")


# ============================================================================
# Installation
# ============================================================================

def install_symlinks() -> None:
    """Install symlinks to agent config directories."""
    log_step("Installing symlinks to agent config directories...")
    
    registry = load_registry()
    for agent_id in SUPPORTED_AGENT_IDS:
        agent = registry.get(agent_id)
        if not agent or agent.get("deploymentStrategy") != "symlink":
            continue

        link_path = expand_path(agent["configPaths"][0])
        target_path = BUILD_DIR / agent["buildOutput"]

        # Ensure parent directory exists
        link_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Remove existing link/directory
        if link_path.exists() or link_path.is_symlink():
            if link_path.is_dir() and not link_path.is_symlink():
                shutil.rmtree(link_path)
            else:
                link_path.unlink()
        
        # Create symlink
        success, method, warning = create_link(link_path, target_path, force=True)
        if success:
            display_path = str(link_path).replace(str(Path.home()), "~")
            log_info(f"{agent['name']}: {display_path}")
            if warning:
                log_warn(warning)
        else:
            log_warn(f"Could not create symlink: {link_path}")


def show_summary() -> None:
    """Show installation summary."""
    print()
    print("======================================")
    print("  Commands installed successfully!")
    print("======================================")
    print()
    print("Available commands:")
    print()
    print("  Cursor:      /branch, /issue, /pr, /push, /status, ...")
    print("  Claude Code: /branch, /issue, /pr, /push, /status, ...")
    print("  Codex CLI:   /prompts:branch, /prompts:issue, ...")
    print("  Gemini CLI:  /branch, /issue, /pr, /push, /status, ...")
    print("  Antigravity: /branch, /issue, /pr, /push, /status, ... (as Global Workflows)")
    print()
    print("Note: Codex uses /prompts: prefix for custom commands.")
    print()


# ============================================================================
# CLI
# ============================================================================

def usage() -> None:
    """Show usage information."""
    script_name = Path(__file__).name
    print(f"Usage: {script_name} {{build|install|validate|clean|help}}")
    print()
    print("Commands:")
    print("  build     Build commands for all agents (no install)")
    print("  install   Build and install symlinks to agent configs")
    print("  validate  Validate source commands only")
    print("  clean     Remove build directory")
    print("  help      Show this help message")


def main() -> None:
    """Main entry point."""
    if len(sys.argv) < 2:
        command = "help"
    else:
        command = sys.argv[1].lower()
    
    if command in ("-h", "--help", "help"):
        usage()
    elif command == "build":
        validate_source_dir()
        validate_all()
        build()
    elif command == "install":
        validate_source_dir()
        validate_all()
        build()
        install_symlinks()
        show_summary()
    elif command == "validate":
        validate_source_dir()
        validate_all()
    elif command == "clean":
        if BUILD_DIR.exists():
            shutil.rmtree(BUILD_DIR)
            log_info("Cleaned build directory")
        else:
            log_info("Build directory does not exist")
    else:
        log_error(f"Unknown command: {command}")
        usage()
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        log_warn("Build cancelled by user")
        sys.exit(1)
    except Exception as e:
        log_error(f"Unexpected error: {e}")
        sys.exit(1)

