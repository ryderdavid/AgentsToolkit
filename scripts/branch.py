#!/usr/bin/env python3
"""branch.py - Smart branch creation.

Usage:
    branch.py [category] <description>
    branch.py <description>  # Auto-detects category from description

Categories: feat, fix, refactor, docs, chore, test
"""

import argparse
import re
import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_info, print_warning,
    check_git_repo, get_current_branch, run_git,
    detect_branch_type, format_branch_name
)
from lib.github import get_issue, link_branch_to_issue


VALID_CATEGORIES = ['feat', 'fix', 'refactor', 'docs', 'chore', 'test']


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Create a feature branch with proper naming'
    )
    parser.add_argument(
        'args',
        nargs='+',
        help='[category] description or just description'
    )
    parser.add_argument(
        '--issue',
        type=int,
        help='Link to issue number'
    )
    return parser.parse_args()


def detect_category_and_description(args_list):
    """Parse arguments to extract category and description.
    
    Returns:
        Tuple of (category, description)
    """
    if len(args_list) == 1:
        # Just description, auto-detect category
        description = args_list[0]
        category = detect_branch_type(description)
        return category, description
    
    # Check if first arg is a valid category
    if args_list[0] in VALID_CATEGORIES:
        category = args_list[0]
        description = ' '.join(args_list[1:])
        return category, description
    else:
        # Treat all as description
        description = ' '.join(args_list)
        category = detect_branch_type(description)
        return category, description


def check_branch_exists(branch_name):
    """Check if branch already exists locally.
    
    Returns:
        True if exists, False otherwise
    """
    result = run_git('show-ref', '--verify', '--quiet', f'refs/heads/{branch_name}')
    return result.returncode == 0


def make_unique_branch_name(base_name):
    """Ensure branch name is unique by adding counter if needed.
    
    Returns:
        Unique branch name
    """
    if not check_branch_exists(base_name):
        return base_name
    
    # Try adding counter
    counter = 1
    while counter <= 10:
        candidate = f"{base_name}-{counter}"
        if not check_branch_exists(candidate):
            return candidate
        counter += 1
    
    print_error("Error: Too many similar branches exist")
    sys.exit(1)


def main():
    """Main branch creation flow."""
    args = parse_args()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    # Get current branch
    current_branch = get_current_branch()
    if not current_branch:
        print_error("Error: No current branch found")
        sys.exit(1)
    
    print_info(f"📍 Current branch: {current_branch}")
    
    # Parse category and description
    category, description = detect_category_and_description(args.args)
    
    print_info(f"🧠 Analyzing: \"{description}\"")
    print_info(f"📋 Detected category: {category}")
    
    # Check for issue linking
    issue_num = args.issue
    if issue_num:
        print_info(f"🔗 Using issue: #{issue_num}")
        # Verify issue exists
        issue = get_issue(issue_num)
        if not issue:
            print_warning(f"Warning: Issue #{issue_num} not found")
            response = input("Continue anyway? (y/N): ").strip().lower()
            if response != 'y':
                sys.exit(1)
    
    # Generate branch name
    branch_name = format_branch_name(category, description, issue_num)
    final_branch_name = make_unique_branch_name(branch_name)
    
    if branch_name != final_branch_name:
        print_warning(f"Branch '{branch_name}' exists, using '{final_branch_name}'")
    
    # Create and switch to branch
    print_success(f"✓ Creating branch: {final_branch_name}")
    result = run_git('checkout', '-b', final_branch_name)
    
    if result.returncode != 0:
        print_error("Error: Failed to create branch")
        print_error(result.stderr)
        sys.exit(1)
    
    # Link to issue if provided
    if issue_num:
        if link_branch_to_issue(final_branch_name, issue_num):
            print_success(f"✓ Linked to issue #{issue_num}")
    
    # Success message
    print_success(f"✓ Switched to new branch: {final_branch_name}")
    print_success(f"✓ Created from: {current_branch}")
    print_info("📋 Next: Make your changes → commit → push → pr.py")
    
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"Branch creation failed: {e}")
        sys.exit(1)

