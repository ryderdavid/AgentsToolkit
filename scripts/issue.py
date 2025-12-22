#!/usr/bin/env python3
"""issue.py - Create a GitHub issue with optional screenshots and branch.

Usage: issue.py <title> <body> [screenshot1] [screenshot2] ...
"""

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_info, print_warning,
    check_git_repo, get_current_branch, run_git,
    detect_branch_type, sanitize_branch_name
)
from lib.github import create_issue, get_repo_info, link_branch_to_issue


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Create a GitHub issue with optional screenshots'
    )
    parser.add_argument('title', help='Issue title')
    parser.add_argument('body', help='Issue body (markdown)')
    parser.add_argument(
        'screenshots',
        nargs='*',
        help='Optional screenshot files to attach'
    )
    return parser.parse_args()


def main():
    """Main issue creation flow."""
    args = parse_args()
    
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    # Get repo info
    repo_info = get_repo_info()
    if not repo_info:
        print_error("Error: Could not get repository information")
        sys.exit(1)
    
    owner = repo_info['owner']
    repo_name = repo_info['name']
    
    # Get current branch
    current_branch = get_current_branch()
    
    # Warn if on main/master
    if current_branch in ['main', 'master']:
        print_info("Creating issue with new branch (not on main)")
    
    # Detect branch type from title
    branch_type = detect_branch_type(args.title)
    branch_slug = sanitize_branch_name(args.title)
    
    # Use pending- prefix initially
    branch_name = f"{branch_type}/pending-{branch_slug}"
    
    print_success(f"Creating issue: {args.title}")
    print_success(f"Branch name: {branch_name}")
    
    # Create and checkout new branch
    print_info("Creating branch...")
    result = run_git('checkout', '-b', branch_name)
    if result.returncode != 0:
        # Check if branch already exists
        check_result = run_git('show-ref', '--verify', f'refs/heads/{branch_name}')
        if check_result.returncode == 0:
            print_error(f"Branch '{branch_name}' already exists!")
            print_error("This might indicate a previous incomplete workflow.")
            print_error("Options:")
            print_error(f"  1. Delete the existing branch: git branch -D {branch_name}")
            print_error(f"  2. Check it out manually: git checkout {branch_name}")
            print_error("  3. Choose a different branch name")
            sys.exit(1)
        else:
            # Other error occurred
            print_error(f"Failed to create branch: {result.stderr}")
            sys.exit(1)
    
    # Create .issue_screenshots directory
    screenshots_dir = Path('.issue_screenshots')
    screenshots_dir.mkdir(exist_ok=True)
    
    # Process screenshots
    image_markdown = ""
    screenshot_paths = []
    
    if args.screenshots:
        print_info(f"Processing {len(args.screenshots)} screenshot(s)...")
        
        date_prefix = datetime.now().strftime('%Y%m%d')
        
        for screenshot in args.screenshots:
            screenshot_path = Path(screenshot)
            if not screenshot_path.exists():
                print_warning(f"Warning: Screenshot not found: {screenshot}")
                continue
            
            # Generate temporary filename (will rename after issue creation)
            ext = screenshot_path.suffix
            base_name = sanitize_branch_name(screenshot_path.stem, 20)
            temp_name = f"{date_prefix}_pending_{branch_slug}_{base_name}{ext}"
            dest_path = screenshots_dir / temp_name
            
            # Copy screenshot
            shutil.copy2(screenshot_path, dest_path)
            screenshot_paths.append(dest_path)
            
            # Add to git
            run_git('add', str(dest_path))
            
            # Generate GitHub raw URL (temporary, will update after issue creation)
            image_url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/{branch_name}/{dest_path.as_posix()}"
            image_markdown += f"\n\n![Screenshot]({image_url})"
            
            print_success(f"  Added: {screenshot} -> {temp_name}")
    
    # Commit screenshots if any
    if screenshot_paths:
        print_info("Committing screenshots...")
        result = run_git('commit', '-m', "Add screenshot evidence for pending issue")
        if result.returncode != 0:
            print_warning("Note: Commit may have failed (screenshots might already be committed)")
    
    # Push branch to remote
    print_info("Pushing branch...")
    result = run_git('push', '-u', 'origin', branch_name)
    if result.returncode != 0:
        print_warning("Note: Branch push will happen after issue creation")
    
    # Build issue body with screenshots
    full_body = args.body + image_markdown
    
    # Add branch reference
    full_body += f"\n\n---\n\n**Branch:** `{branch_name}`"
    
    # Create GitHub issue
    print_info("Creating GitHub issue...")
    issue_result = create_issue(title=args.title, body=full_body)
    
    if not issue_result:
        print_error("Failed to create issue")
        sys.exit(1)
    
    issue_num = issue_result.get('number')
    issue_url = issue_result.get('url')
    
    # Rename branch from pending to include issue number
    new_branch_name = f"{branch_type}/{issue_num}-{branch_slug}"
    print_info("Renaming branch to include issue number...")
    
    # Rename local branch
    result = run_git('branch', '-m', new_branch_name)
    if result.returncode != 0:
        print_error(f"Failed to rename branch: {result.stderr}")
        sys.exit(1)
    
    # Delete old remote branch and push new one
    run_git('push', 'origin', '--delete', branch_name)
    result = run_git('push', '-u', 'origin', new_branch_name)
    if result.returncode != 0:
        print_warning("Warning: Failed to push renamed branch")
    
    print_success(f"✓ Branch renamed: {branch_name} → {new_branch_name}")
    
    # Rename screenshot files to include issue number
    if screenshot_paths:
        print_info("Renaming screenshots with issue number...")
        
        date_prefix = datetime.now().strftime('%Y%m%d')
        
        for old_path in screenshot_paths:
            old_name = old_path.name
            ext = old_path.suffix
            
            # Extract descriptive name from old filename
            base_name = old_name.replace(f"{date_prefix}_pending_{branch_slug}_", "").replace(ext, "")
            
            # Create new filename
            new_name = f"{date_prefix}_{issue_num}_{branch_type}-{branch_slug}_{base_name}{ext}"
            new_path = screenshots_dir / new_name
            
            # Rename the file
            if old_path != new_path:
                result = run_git('mv', str(old_path), str(new_path))
                if result.returncode != 0:
                    shutil.move(old_path, new_path)
                run_git('add', str(new_path))
        
        # Commit the rename
        result = run_git('commit', '-m', f"#{issue_num}: Rename screenshots with issue number")
        if result.returncode == 0:
            print_success("✓ Committed renamed screenshots")
            
            # Push
            result = run_git('push')
            if result.returncode == 0:
                print_success("✓ Pushed screenshots")
    
    # Link branch to issue in git config
    link_branch_to_issue(new_branch_name, issue_num)
    print_success("✓ Stored issue-branch association in git config")
    
    # Output results
    print()
    print_success("✓ Issue created successfully!")
    print_success(f"  Issue #{issue_num}: {issue_url}")
    print_success(f"  Branch: {new_branch_name}")
    print_info("📋 Workflow: Make your changes → commit → git push → pr.py")
    
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"Issue creation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

