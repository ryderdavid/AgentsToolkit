#!/usr/bin/env python3
"""check_workflow.py - Verify workflow prerequisites.

Checks:
- In git repository
- GitHub CLI installed and authenticated
- On a feature branch (not main/master)
"""

import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_warning,
    check_git_repo, get_current_branch, check_gh_auth,
    check_command_exists
)


def main():
    """Check workflow prerequisites."""
    all_ok = True
    
    print(f"{colors.BLUE}Workflow Prerequisites Check{colors.NC}")
    print("─────────────────────────────")
    
    # Check if in git repo
    if check_git_repo():
        print_success("✓ In git repository")
    else:
        print_error("✗ Not in a git repository")
        all_ok = False
    
    # Check if gh CLI installed
    if check_command_exists('gh'):
        print_success("✓ GitHub CLI (gh) installed")
    else:
        print_error("✗ GitHub CLI (gh) not installed")
        print_warning("  Install: https://cli.github.com/")
        all_ok = False
    
    # Check if gh authenticated
    is_auth, username = check_gh_auth()
    if is_auth:
        print_success(f"✓ GitHub CLI authenticated as: {username or 'user'}")
    else:
        print_error("✗ GitHub CLI not authenticated")
        print_warning("  Run: gh auth login")
        all_ok = False
    
    # Check current branch
    branch = get_current_branch()
    if branch:
        if branch in ['main', 'master']:
            print_warning(f"⚠  On {branch} branch - create a feature branch before making changes")
            print_warning("  Run: branch.py <description>")
        else:
            print_success(f"✓ On feature branch: {branch}")
    else:
        print_warning("⚠  Could not determine current branch")
    
    print()
    if all_ok:
        print_success("✅ All checks passed - ready to use workflow commands")
        sys.exit(0)
    else:
        print_error("❌ Some checks failed - fix issues above")
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print_error(f"Check failed: {e}")
        sys.exit(1)

