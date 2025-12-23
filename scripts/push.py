#!/usr/bin/env python3
"""push.py - Commit and push changes to PR branch.

Commits current changes with AGENTS.md format and pushes to remote.
"""

import argparse
import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_info, print_warning,
    check_git_repo, get_current_branch, run_git
)
from lib.github import get_issue_from_branch, check_pr_exists


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Commit and push changes to PR branch'
    )
    parser.add_argument(
        'message',
        nargs='?',
        help='Commit message (optional, will prompt if not provided)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Stage all changes (default: stage all)'
    )
    parser.add_argument(
        '--no-verify',
        action='store_true',
        help='Skip git hooks (use with caution)'
    )
    return parser.parse_args()


def main():
    """Main push workflow."""
    args = parse_args()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    # Get current branch
    branch = get_current_branch()
    if not branch:
        print_error("Error: No current branch found")
        sys.exit(1)
    
    # Check if on main/master (safety check)
    if branch in ('main', 'master'):
        print_error("Error: Cannot push to main/master")
        print_info("Create a feature branch first: git checkout -b feat/123-description")
        sys.exit(1)
    
    # Detect issue number
    issue_num = get_issue_from_branch(branch)
    
    # Check for uncommitted changes
    result = run_git('status', '--porcelain')
    if not result.stdout.strip():
        print_warning("No changes to commit")
        sys.exit(0)
    
    # Show what will be committed
    print_info("Changes to commit:")
    result = run_git('status', '--short')
    if result.stdout:
        print(result.stdout)
    
    # Get commit message
    if args.message:
        commit_message = args.message
    else:
        print()
        commit_message = input(f"{colors.YELLOW}Commit message:{colors.NC} ").strip()
        if not commit_message:
            print_error("Error: Commit message is required")
            sys.exit(1)
    
    # Format commit message per AGENTS.md
    if issue_num:
        if not commit_message.startswith(f"#{issue_num}:"):
            formatted_message = f"#{issue_num}: {commit_message}"
        else:
            formatted_message = commit_message
        print_info(f"Using issue #{issue_num} for commit message")
    else:
        formatted_message = commit_message
        print_warning("⚠️  No issue number detected - commit won't follow AGENTS.md format")
        print_info("Branch name should contain issue number (e.g., feat/123-description)")
    
    # Stage changes
    print()
    print_info("Staging changes...")
    if args.all:
        result = run_git('add', '-A')
    else:
        result = run_git('add', '-A')  # Default to staging all
    
    if result.returncode != 0:
        print_error("Error: Failed to stage changes")
        sys.exit(1)
    
    # Commit
    print_info(f"Committing: {formatted_message}")
    commit_args = ['commit', '-m', formatted_message]
    if args.no_verify:
        commit_args.append('--no-verify')
    
    result = run_git(*commit_args)
    if result.returncode != 0:
        print_error("Error: Failed to commit")
        if result.stderr:
            print_error(result.stderr)
        sys.exit(1)
    
    # Get commit hash
    result = run_git('rev-parse', '--short', 'HEAD')
    commit_hash = result.stdout.strip() if result.returncode == 0 else 'unknown'
    
    print_success(f"✓ Committed: {commit_hash}")
    
    # Push to remote
    print()
    print_info(f"Pushing to origin/{branch}...")
    result = run_git('push', '-u', 'origin', branch)
    
    if result.returncode != 0:
        print_error("Error: Failed to push")
        if result.stderr:
            print_error(result.stderr)
        sys.exit(1)
    
    print_success(f"✓ Pushed to origin/{branch}")
    
    # Check for PR
    pr_num = check_pr_exists(branch, 'main')
    if not pr_num:
        pr_num = check_pr_exists(branch, 'master')
    
    if pr_num:
        from lib.github import get_pr
        pr = get_pr(pr_num)
        if pr:
            pr_url = pr.get('url', '')
            print()
            print_success(f"📋 PR: #{pr_num}")
            print_info(f"   {pr_url}")
    
    print()
    print_success(f"{colors.GREEN}✓ Push complete!{colors.NC}")
    print_info(f"Commit: {commit_hash}")
    if issue_num:
        print_info(f"Issue: #{issue_num}")
    if pr_num:
        print_info(f"PR: #{pr_num}")


if __name__ == '__main__':
    main()

