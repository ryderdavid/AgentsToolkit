#!/usr/bin/env python3
"""followup.py - Add follow-up comment to an issue.

Usage: followup.py <issue_number> <comment> [screenshot1] [screenshot2] ...
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_info,
    check_git_repo, get_current_branch, run_git
)
from lib.github import get_issue, add_issue_comment, get_repo_info


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Add a follow-up comment to an issue with optional screenshots'
    )
    parser.add_argument('issue_number', type=int, help='Issue number')
    parser.add_argument('comment', help='Comment text')
    parser.add_argument(
        'screenshots',
        nargs='*',
        help='Optional screenshot files to attach'
    )
    return parser.parse_args()


def main():
    """Main followup flow."""
    args = parse_args()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    print_info(f"Adding comment to issue #{args.issue_number}...")
    
    # Verify issue exists
    issue = get_issue(args.issue_number)
    if not issue:
        print_error(f"Error: Issue #{args.issue_number} not found")
        sys.exit(1)
    
    # Get repo info for screenshot URLs
    repo_info = get_repo_info()
    if not repo_info:
        print_error("Error: Could not get repository information")
        sys.exit(1)
    
    owner = repo_info['owner']
    repo_name = repo_info['name']
    
    # Process screenshots if provided
    comment_body = args.comment
    
    if args.screenshots:
        branch = get_current_branch()
        if not branch:
            print_error("Error: Could not determine current branch")
            sys.exit(1)
        
        print_info(f"Processing {len(args.screenshots)} screenshot(s)...")
        
        # Create screenshots directory
        screenshots_dir = Path('.issue_screenshots')
        screenshots_dir.mkdir(exist_ok=True)
        
        date_prefix = datetime.now().strftime('%Y%m%d')
        
        for screenshot in args.screenshots:
            screenshot_path = Path(screenshot)
            if not screenshot_path.exists():
                print_error(f"Warning: Screenshot not found: {screenshot}")
                continue
            
            # Generate filename: YYYYMMDD_{issue}_{branch}_{original-name}
            from lib.common import sanitize_branch_name
            branch_slug = sanitize_branch_name(branch, 30)
            ext = screenshot_path.suffix
            base_name = sanitize_branch_name(screenshot_path.stem, 20)
            
            dest_name = f"{date_prefix}_{args.issue_number}_{branch_slug}_{base_name}{ext}"
            dest_path = screenshots_dir / dest_name
            
            # Copy screenshot
            import shutil
            shutil.copy2(screenshot_path, dest_path)
            
            # Stage for commit
            run_git('add', str(dest_path))
            
            # Add to comment body
            image_url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/{branch}/.issue_screenshots/{dest_name}"
            comment_body += f"\n\n![Screenshot]({image_url})"
            
            print_success(f"  Added: {screenshot} -> {dest_name}")
        
        # Commit screenshots
        result = run_git('commit', '-m', f"#{args.issue_number}: Add follow-up screenshots")
        if result.returncode == 0:
            print_success("✓ Committed screenshots")
            
            # Push to remote
            result = run_git('push')
            if result.returncode == 0:
                print_success("✓ Pushed screenshots")
            else:
                print_error("Warning: Failed to push - push manually before commenting")
        else:
            print_info("Note: No changes to commit (screenshots may already be committed)")
    
    # Add comment to issue
    if add_issue_comment(args.issue_number, comment_body):
        print_success(f"✓ Added comment to issue #{args.issue_number}")
        print_info(f"Issue URL: {issue.get('url', '')}")
        sys.exit(0)
    else:
        print_error("Failed to add comment")
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"Follow-up failed: {e}")
        sys.exit(1)

