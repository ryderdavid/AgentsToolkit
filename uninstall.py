#!/usr/bin/env python3
"""AgentsToolkit Uninstaller - Cross-platform.

Removes toolkit files from a repository while preserving AGENTS.md
and .github/ templates.
"""

import shutil
import sys
from pathlib import Path

# Add lib to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'scripts'))

from lib.common import (
    colors, print_error, print_success, print_warning, print_info,
    check_git_repo, get_repo_root
)
from lib.symlinks import remove_link


def main():
    """Main uninstallation flow."""
    print_warning("Agents Toolkit Uninstaller")
    print()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    repo_root = get_repo_root()
    if not repo_root:
        print_error("Error: Could not determine repository root")
        sys.exit(1)
    
    print_warning("This will remove:")
    print("  • .agents/commands (symlink)")
    print("  • .cursor/rules/agents-workflow/")
    print("  • .cursor/commands/*.md")
    print("  • .issue_screenshots/ (if empty)")
    print()
    print_error("AGENTS.md, .github/ templates will NOT be removed")
    print()
    
    response = input("Continue? (y/N): ").strip().lower()
    if response != 'y':
        print("Cancelled")
        sys.exit(0)
    
    # Remove Cursor rules
    cursor_rules = repo_root / '.cursor' / 'rules' / 'agents-workflow'
    if cursor_rules.exists():
        shutil.rmtree(cursor_rules)
        print_success("✓ Removed .cursor/rules/agents-workflow/")
    
    # Remove .agents/commands symlink
    agents_commands = repo_root / '.agents' / 'commands'
    if agents_commands.exists() or agents_commands.is_symlink():
        remove_link(agents_commands)
        
        # Remove .agents directory if empty
        agents_dir = repo_root / '.agents'
        if agents_dir.exists() and not any(agents_dir.iterdir()):
            agents_dir.rmdir()
        
        print_success("✓ Removed .agents/commands")
    
    # Remove cursor command wrappers
    cursor_commands = repo_root / '.cursor' / 'commands'
    if cursor_commands.exists():
        # Remove only .md files
        removed = False
        for md_file in cursor_commands.glob('*.md'):
            md_file.unlink()
            removed = True
        
        if removed:
            print_success("✓ Removed .cursor/commands/*.md")
        
        # Remove commands directory if empty
        if not any(cursor_commands.iterdir()):
            cursor_commands.rmdir()
            print_success("✓ Removed empty .cursor/commands/")
    
    # Remove .issue_screenshots if empty
    screenshots_dir = repo_root / '.issue_screenshots'
    if screenshots_dir.exists():
        contents = list(screenshots_dir.iterdir())
        # Check if empty or only contains .gitkeep
        if not contents or (len(contents) == 1 and contents[0].name == '.gitkeep'):
            shutil.rmtree(screenshots_dir)
            print_success("✓ Removed .issue_screenshots/ (was empty)")
        else:
            print_warning("⊘ Kept .issue_screenshots/ (contains files)")
    
    print()
    print_success("Uninstallation complete")
    print()
    print_warning("Note: AGENTS.md and .github/ templates were not removed")
    print("Remove them manually if needed")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_warning("Uninstallation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Uninstallation failed: {e}")
        sys.exit(1)

