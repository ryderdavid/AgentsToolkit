#!/usr/bin/env python3
"""protect.py - Enable branch protection and PR-to-issue checks.

Applies GitHub branch protections per AGENTS.md standards:
- Prevents direct commits to main/master
- Requires PRs to contain issue links
- Installs PR issue check GitHub Action

Usage:
    protect.py [--branch BRANCH] [--skip-action]
    
Options:
    --branch BRANCH    Branch to protect (default: auto-detect main/master)
    --skip-action      Skip installing GitHub Action workflow
"""

import argparse
import shutil
import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import (
    colors, print_error, print_success, print_warning, print_info,
    check_git_repo, get_repo_root
)
from lib.github import (
    get_repo_info, get_repo_default_branch, check_admin_access,
    enable_branch_protection, is_branch_protected, get_branch_protection
)


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Enable branch protection and PR-to-issue checks'
    )
    parser.add_argument(
        '--branch',
        metavar='BRANCH',
        help='Branch to protect (default: auto-detect main/master)'
    )
    parser.add_argument(
        '--skip-action',
        action='store_true',
        help='Skip installing GitHub Action workflow'
    )
    return parser.parse_args()


def check_prerequisites() -> bool:
    """Check if prerequisites are met.
    
    Returns:
        True if all prerequisites met
    """
    if not check_git_repo():
        print_error("Error: Not in a git repository")
        return False
    
    # Check gh auth
    import subprocess
    result = subprocess.run(['gh', 'auth', 'status'], capture_output=True)
    if result.returncode != 0:
        print_error("Error: GitHub CLI not authenticated")
        print_info("Run: gh auth login")
        return False
    
    return True


def install_github_action(repo_root: Path) -> bool:
    """Install PR issue check GitHub Action workflow.
    
    Args:
        repo_root: Repository root path
        
    Returns:
        True if successful
    """
    print_info("\n[2/3] Installing GitHub Action workflow...")
    
    # Find toolkit directory
    toolkit_dir = Path.home() / '.agents_toolkit'
    if not toolkit_dir.exists():
        print_error(f"Error: Toolkit not found at {toolkit_dir}")
        return False
    
    template_file = toolkit_dir / 'templates' / 'pr-issue-check.yml'
    if not template_file.exists():
        print_error(f"Error: Template not found at {template_file}")
        return False
    
    # Create .github/workflows directory
    workflows_dir = repo_root / '.github' / 'workflows'
    workflows_dir.mkdir(parents=True, exist_ok=True)
    
    target_file = workflows_dir / 'pr-issue-check.yml'
    
    if target_file.exists():
        print_warning("⚠️  pr-issue-check.yml already exists")
        response = input("Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print_warning("⊘ Skipped - keeping existing workflow")
            return True
    
    # Copy template
    shutil.copy2(template_file, target_file)
    print_success(f"✓ Created .github/workflows/pr-issue-check.yml")
    
    # Commit the workflow file
    print_info("Committing workflow file...")
    import subprocess
    
    subprocess.run(['git', 'add', str(target_file)], cwd=repo_root)
    result = subprocess.run(
        ['git', 'commit', '-m', 'Add PR issue link check workflow'],
        cwd=repo_root,
        capture_output=True
    )
    
    if result.returncode == 0:
        print_success("✓ Committed workflow file")
        print_info("Run 'git push' to activate the workflow")
    else:
        # Check if it's already committed
        if b'nothing to commit' in result.stdout or b'nothing to commit' in result.stderr:
            print_info("Workflow file already committed")
        else:
            print_warning("⚠️  Manual commit required: git add .github/workflows/pr-issue-check.yml")
    
    return True


def main():
    """Main protection setup."""
    args = parse_args()
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Get repo info
    print_info("Checking repository...")
    repo_info = get_repo_info()
    if not repo_info:
        print_error("Error: Failed to get repository information")
        sys.exit(1)
    
    owner = repo_info['owner']['login']
    name = repo_info['name']
    repo_url = repo_info['url']
    
    print_success(f"✓ Repository: {owner}/{name}")
    
    # Check admin access
    if not check_admin_access():
        print_error("Error: You do not have admin access to this repository")
        print_info("Branch protection requires admin permissions")
        sys.exit(1)
    
    print_success("✓ Admin access confirmed")
    
    # Determine branch to protect
    if args.branch:
        branch = args.branch
    else:
        branch = get_repo_default_branch()
        print_info(f"Auto-detected default branch: {branch}")
    
    # Check if already protected
    if is_branch_protected(branch):
        print_warning(f"⚠️  Branch '{branch}' is already protected")
        current = get_branch_protection(branch)
        if current:
            print_info("\nCurrent protection rules:")
            if current.get('required_pull_request_reviews'):
                print_info("  ✓ Requires pull request reviews")
            if current.get('required_status_checks'):
                checks = current['required_status_checks'].get('contexts', [])
                if checks:
                    print_info(f"  ✓ Required status checks: {', '.join(checks)}")
            if current.get('enforce_admins', {}).get('enabled'):
                print_info("  ✓ Enforced for admins")
        
        response = input(f"\nUpdate protection rules? (y/N): ").strip().lower()
        if response != 'y':
            print_info("Skipping branch protection update")
            if not args.skip_action:
                repo_root = get_repo_root()
                if repo_root:
                    install_github_action(Path(repo_root))
            sys.exit(0)
    
    # Display what will be done
    print_info(f"\n{colors.YELLOW}Branch Protection Settings:{colors.NC}")
    print_info(f"  Branch: {branch}")
    print_info(f"  Require pull requests: Yes")
    print_info(f"  Required status checks: PR Issue Link Check")
    print_info(f"  Enforce for admins: No (safety valve)")
    print_info(f"  Allow force pushes: No")
    print_info(f"  Allow deletions: No")
    
    print_info(f"\n{colors.YELLOW}This enforces AGENTS.md Prime Directive #3:{colors.NC}")
    print_info(f"  'NEVER make file changes while on main/master'")
    
    # Confirm
    response = input(f"\n{colors.YELLOW}Enable branch protection?{colors.NC} (y/N): ").strip().lower()
    if response != 'y':
        print_warning("Cancelled - no changes made")
        sys.exit(0)
    
    # Enable protection
    print_info(f"\n[1/3] Enabling branch protection for '{branch}'...")
    
    success, error = enable_branch_protection(
        branch=branch,
        require_pr_reviews=True,
        required_status_checks=['PR Issue Link Check'],
        enforce_admins=False,
        allow_force_pushes=False,
        allow_deletions=False
    )
    
    if not success:
        print_error(f"Error: Failed to enable branch protection: {error}")
        print_info("\nYou can manually configure branch protection at:")
        print_info(f"  {repo_url}/settings/branches")
        sys.exit(1)
    
    print_success(f"✓ Branch protection enabled for '{branch}'")
    
    # Install GitHub Action
    if not args.skip_action:
        repo_root = get_repo_root()
        if repo_root and not install_github_action(Path(repo_root)):
            print_warning("⚠️  Failed to install GitHub Action")
            print_info("You can manually copy the workflow from:")
            print_info("  ~/.agents_toolkit/templates/pr-issue-check.yml")
    else:
        print_info("\n[2/3] Skipped GitHub Action installation (--skip-action)")
    
    # Summary
    print_info(f"\n{colors.GREEN}[3/3] Protection setup complete!{colors.NC}")
    print_info("\n📋 What was configured:")
    print_info(f"  ✓ Branch '{branch}' requires pull requests")
    print_info(f"  ✓ PRs must link to issues (Closes #N)")
    if not args.skip_action:
        print_info(f"  ✓ GitHub Action workflow installed")
    
    print_info(f"\n🔗 View settings:")
    print_info(f"  {repo_url}/settings/branches")
    
    print_info(f"\n{colors.YELLOW}Next steps:{colors.NC}")
    if not args.skip_action:
        print_info("  1. git push  # Push the workflow file")
        print_info("  2. Create a test PR to verify the check works")
    else:
        print_info("  1. Create a test PR to verify protection works")
    
    print_info(f"\n{colors.YELLOW}Note:{colors.NC} Admins can still bypass these protections if needed.")


if __name__ == '__main__':
    main()











