#!/usr/bin/env python3
"""link.py - Link an existing PR to an issue.

Usage: link.py <pr_number> <issue_number>
"""

import argparse
import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_info,
    check_git_repo
)
from lib.github import get_pr, get_issue, update_pr


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Link an existing PR to an issue'
    )
    parser.add_argument('pr_number', type=int, help='Pull request number')
    parser.add_argument('issue_number', type=int, help='Issue number')
    return parser.parse_args()


def main():
    """Main link flow."""
    args = parse_args()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    print_info(f"Linking PR #{args.pr_number} to issue #{args.issue_number}...")
    
    # Verify PR exists
    pr = get_pr(args.pr_number)
    if not pr:
        print_error(f"Error: PR #{args.pr_number} not found")
        sys.exit(1)
    
    # Verify issue exists
    issue = get_issue(args.issue_number)
    if not issue:
        print_error(f"Error: Issue #{args.issue_number} not found")
        sys.exit(1)
    
    # Get current PR body
    current_body = pr.get('body', '')
    
    # Check if already linked
    if f"#{args.issue_number}" in current_body:
        print_info(f"PR already mentions issue #{args.issue_number}")
    
    # Add "Closes #N" to PR body
    if not current_body.endswith('\n'):
        current_body += '\n'
    
    # Remove any existing "Closes #N" lines
    lines = current_body.split('\n')
    filtered_lines = [line for line in lines if not line.strip().startswith('Closes #')]
    new_body = '\n'.join(filtered_lines)
    
    # Add new link
    if not new_body.endswith('\n'):
        new_body += '\n'
    new_body += f"\nCloses #{args.issue_number}\n"
    
    # Update PR
    if update_pr(args.pr_number, body=new_body):
        print_success(f"✓ Linked PR #{args.pr_number} to issue #{args.issue_number}")
        print_info(f"PR URL: {pr.get('url', '')}")
        print_info(f"Issue URL: {issue.get('url', '')}")
        print_success("✅ Issue will auto-close when PR merges")
        sys.exit(0)
    else:
        print_error("Failed to update PR")
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"Link operation failed: {e}")
        sys.exit(1)

