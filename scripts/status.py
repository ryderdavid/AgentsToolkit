#!/usr/bin/env python3
"""status.py - Show current workflow status.

Shows: branch, linked issue, commits, PR status
"""

import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_info, check_git_repo,
    get_current_branch, run_git
)
from lib.github import (
    get_issue, get_issue_from_branch, check_pr_exists,
    get_commits_ahead, is_branch_pushed
)


def main():
    """Main status display."""
    # Check if in git repository
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        sys.exit(1)
    
    # Get current branch
    branch = get_current_branch()
    if not branch:
        print_error("Error: No current branch found")
        sys.exit(1)
    
    # Get linked issue from git config or branch name
    issue_num = get_issue_from_branch(branch)
    
    print(f"{colors.BLUE}📋 Current Workflow Status{colors.NC}")
    print("─────────────────────────────")
    print(f"{colors.BLUE}Branch:{colors.NC} {branch}")
    
    # Display issue information
    if issue_num:
        print(f"{colors.BLUE}Linked Issue:{colors.NC} #{issue_num}")
        issue = get_issue(issue_num)
        if issue:
            issue_state = issue.get('state', 'unknown')
            print(f"{colors.BLUE}Issue State:{colors.NC} {issue_state}")
    else:
        print(f"{colors.BLUE}Linked Issue:{colors.NC} None (standalone branch)")
    
    # Check commits ahead of main
    commits_ahead = get_commits_ahead(branch, 'main')
    if commits_ahead == 0:
        # Try master
        commits_ahead = get_commits_ahead(branch, 'master')
    print(f"{colors.BLUE}Commits ahead:{colors.NC} {commits_ahead}")
    
    # Check if pushed
    if is_branch_pushed(branch):
        print(f"{colors.BLUE}Pushed:{colors.NC} ✅ Yes")
    else:
        print(f"{colors.BLUE}Pushed:{colors.NC} ❌ No - run 'git push'")
    
    # Check for existing PR
    pr_num = check_pr_exists(branch, 'main')
    if not pr_num:
        pr_num = check_pr_exists(branch, 'master')
    
    if pr_num:
        from lib.github import get_pr
        pr = get_pr(pr_num)
        print(f"{colors.BLUE}PR:{colors.NC} #{pr_num}")
        
        if pr:
            state = pr.get('state', '').upper()
            is_draft = pr.get('isDraft', False)
            is_merged = pr.get('merged', False)
            
            if is_merged:
                print(f"{colors.GREEN}✅ Merged!{colors.NC}")
            elif state == 'CLOSED':
                print(f"{colors.YELLOW}⚠️  Closed without merge{colors.NC}")
            elif is_draft:
                print(f"{colors.BLUE}📋 Draft PR{colors.NC}")
            else:
                print(f"{colors.BLUE}📋 Open{colors.NC}")
        else:
            print(f"{colors.BLUE}📋 PR open{colors.NC}")
    else:
        if commits_ahead > 0:
            print(f"{colors.BLUE}PR:{colors.NC} None - run 'pr.py' to create")
            print(f"{colors.BLUE}📋 Next step: pr.py{colors.NC}")
        else:
            print(f"{colors.BLUE}PR:{colors.NC} None (no commits yet)")
            print(f"{colors.BLUE}📋 Next step: Make changes and commit{colors.NC}")
    
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(1)
    except Exception as e:
        print_error(f"Status check failed: {e}")
        sys.exit(1)

