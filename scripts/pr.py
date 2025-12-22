#!/usr/bin/env python3
"""pr.py - Smart PR creation with automatic issue detection.

Usage: pr.py [issue_number]
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
from lib.github import (
    get_issue, check_pr_exists, create_pr, get_repo_default_branch,
    get_issue_from_branch, is_branch_pushed, get_commits_ahead,
    format_pr_body
)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Create a pull request with automatic issue detection'
    )
    parser.add_argument(
        'issue_number',
        nargs='?',
        type=int,
        help='Explicit issue number to link (optional)'
    )
    return parser.parse_args()


def validate_branch_ready(branch, base):
    """Validate that branch is ready for PR.
    
    Returns:
        True if ready, False otherwise
    """
    print_info("Validating branch...")
    
    # Check if branch is pushed
    if not is_branch_pushed(branch):
        print_error(f"Error: Branch '{branch}' is not pushed to remote")
        print_warning(f"Run: git push -u origin {branch}")
        return False
    
    # Check if branch has commits ahead of base
    ahead_count = get_commits_ahead(branch, base)
    if ahead_count == 0:
        print_error(f"Error: Branch '{branch}' has no commits ahead of '{base}'")
        print_warning("Make some commits first")
        return False
    
    print_success(f"✓ Branch has {ahead_count} commits ahead of {base}")
    return True


def generate_pr_title(issue_num, branch):
    """Generate PR title from issue or branch.
    
    Returns:
        PR title string
    """
    if issue_num:
        issue = get_issue(issue_num)
        if issue:
            return f"#{issue_num}: {issue['title']}"
    
    # Use branch name as fallback
    return branch.replace('-', ' ').replace('_', ' ').title()


def get_commit_list(branch, base):
    """Get list of commits for PR description.
    
    Returns:
        List of commit messages
    """
    result = run_git('log', '--oneline', f'{base}..{branch}')
    if result.returncode == 0 and result.stdout:
        commits = []
        for line in result.stdout.strip().split('\n'):
            if line:
                # Remove commit hash, keep message
                commits.append(line.split(' ', 1)[1] if ' ' in line else line)
        return commits
    return []


def main():
    """Main PR creation flow."""
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
    
    print_info(f"Working on branch: {branch}")
    
    # Get default/base branch
    base_branch = get_repo_default_branch()
    print_info(f"Base branch: {base_branch}")
    
    # Check for existing PR
    print_info("Checking for existing PRs...")
    existing_pr = check_pr_exists(branch, base_branch)
    if existing_pr:
        print_warning(f"PR #{existing_pr} already exists for this branch")
        print_info(f"Use 'link.py {existing_pr} <issue_number>' to link it to an issue")
        sys.exit(0)
    
    # Detect or use explicit issue number
    print_info("Detecting associated issue...")
    issue_num = args.issue_number or get_issue_from_branch(branch)
    
    if issue_num:
        # Verify issue exists and is open
        issue = get_issue(issue_num)
        if issue:
            issue_state = issue.get('state', '').upper()
            if issue_state != 'OPEN':
                print_warning(f"⚠️  Issue #{issue_num} is {issue_state}")
                response = input("Continue anyway? (y/N): ").strip().lower()
                if response != 'y':
                    sys.exit(1)
        else:
            print_warning(f"Warning: Issue #{issue_num} not found")
            response = input("Continue anyway? (y/N): ").strip().lower()
            if response != 'y':
                sys.exit(1)
    else:
        print_warning("Creating standalone PR (no issue linking)")
    
    # Validate branch
    if not validate_branch_ready(branch, base_branch):
        sys.exit(1)
    
    # Generate PR content
    print_info("Generating PR content...")
    pr_title = generate_pr_title(issue_num, branch)
    
    # Get issue summary if available
    summary = ""
    if issue_num:
        issue = get_issue(issue_num)
        if issue and issue.get('body'):
            # Use first paragraph of issue body as summary
            summary = issue['body'].split('\n\n')[0][:500]
    
    if not summary:
        summary = pr_title
    
    # Get commit list
    commits = get_commit_list(branch, base_branch)
    
    # Format PR body
    pr_body = format_pr_body(
        issue_num=issue_num,
        summary=summary,
        changes=commits[:10]  # Limit to first 10 commits
    )
    
    print_success(f"✓ PR Title: {pr_title}")
    
    # Create the PR
    print_info("Creating pull request...")
    pr_result = create_pr(
        title=pr_title,
        body=pr_body,
        base=base_branch,
        head=branch
    )
    
    if pr_result:
        pr_num = pr_result.get('number')
        pr_url = pr_result.get('url')
        
        print_success("✓ Pull request created successfully!")
        print_success(f"  PR #{pr_num}: {pr_url}")
        
        if issue_num:
            print_success(f"  Linked to issue #{issue_num}")
            print_success("  ✅ Issue will auto-close when PR merges")
        else:
            print_warning("  Standalone PR (not linked to any issue)")
        
        print_info("📋 Next: Get review → Merge PR → Issue closes automatically")
        sys.exit(0)
    else:
        print_error("Failed to create pull request")
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"PR creation failed: {e}")
        sys.exit(1)

