#!/usr/bin/env python3
"""agentsdotmd-init - Initialize repository with AgentsToolkit.

Usage: 
    agentsdotmd-init [--subdir path] [--update]
    
Options:
    --subdir PATH   Initialize in subdirectory (for monorepos)
    --update        Update mode: refresh templates without overwriting customizations
"""

import argparse
import shutil
import sys
from pathlib import Path

# Add lib to path for imports
SCRIPT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(SCRIPT_DIR / 'scripts'))

from lib.common import (
    colors, print_error, print_success, print_warning, print_info,
    check_git_repo, get_repo_root
)
from lib.symlinks import create_link, check_symlink_support


TOOLKIT_DIR = Path.home() / '.agents_toolkit'


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Initialize repository with AgentsToolkit'
    )
    parser.add_argument(
        '--subdir',
        metavar='PATH',
        help='Initialize in subdirectory (for monorepos)'
    )
    parser.add_argument(
        '--update',
        action='store_true',
        help='Update mode: refresh templates without overwriting customizations'
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
    
    if not TOOLKIT_DIR.exists():
        print_error(f"Error: Toolkit not installed at {TOOLKIT_DIR}")
        print_info("Run install.py first")
        return False
    
    return True


def create_agents_md_symlink(target_dir: Path, update_mode: bool) -> bool:
    """Create AGENTS.md symlink.
    
    Returns:
        True if successful
    """
    print_info("[1/9] Symlinking AGENTS.md...")
    
    agents_md = target_dir / 'AGENTS.md'
    source = TOOLKIT_DIR / 'AGENTS.md'
    
    if agents_md.exists() and not agents_md.is_symlink():
        print_warning("⚠️  AGENTS.md exists (not a symlink)")
        response = input("Overwrite with symlink? (y/N): ").strip().lower()
        if response == 'y':
            agents_md.unlink()
            success, method, warning = create_link(agents_md, source)
            if success:
                print_success("✓ Created symlink")
                if warning:
                    print_warning(warning)
                return True
            else:
                print_error(f"Failed to create symlink: {method}")
                return False
        else:
            print_warning("⊘ Skipped")
            return True
    elif not agents_md.exists():
        success, method, warning = create_link(agents_md, source)
        if success:
            print_success(f"✓ Created AGENTS.md -> ~/.agents_toolkit/AGENTS.md")
            if warning:
                print_warning(warning)
            return True
        else:
            print_error(f"Failed to create symlink: {method}")
            return False
    else:
        print_success("✓ Already exists")
        return True


def create_agents_local_md(target_dir: Path, update_mode: bool) -> bool:
    """Create AGENTS.local.md from template.
    
    Returns:
        True if successful
    """
    print()
    print_info("[2/9] Creating AGENTS.local.md...")
    
    if update_mode:
        print_warning("⊘ Skipped (preserving existing AGENTS.local.md)")
        return True
    
    agents_local = target_dir / 'AGENTS.local.md'
    template = TOOLKIT_DIR / 'templates' / 'AGENTS.local.md.example'
    
    if not agents_local.exists():
        # Check template file exists before copying
        if not template.exists():
            print_error(f"Template not found: {template}")
            return False
        shutil.copy2(template, agents_local)
        print_success("✓ Created with examples (uncomment to customize)")
        return True
    else:
        print_success("✓ Already exists")
        return True


def create_claude_md(target_dir: Path, update_mode: bool) -> bool:
    """Copy CLAUDE.md for Claude Code enforcement.
    
    Returns:
        True if successful
    """
    print()
    print_info("[3/9] Installing CLAUDE.md (Claude Code enforcement)...")
    
    claude_md = target_dir / 'CLAUDE.md'
    claude_template = TOOLKIT_DIR / 'templates' / 'CLAUDE.md'
    
    if update_mode:
        if claude_md.exists():
            response = input("Update existing CLAUDE.md? (y/N): ").strip().lower()
            if response == 'y':
                # Remove symlink if it exists, then copy
                if claude_md.is_symlink():
                    claude_md.unlink()
                shutil.copy2(claude_template, claude_md)
                print_success("✓ Updated CLAUDE.md")
                return True
            else:
                print_warning("⊘ Skipped CLAUDE.md")
                return True
        else:
            shutil.copy2(claude_template, claude_md)
            print_success("✓ Created CLAUDE.md")
            return True
    elif claude_md.exists() and not claude_md.is_symlink():
        print_success("✓ Already exists (standalone file)")
        return True
    elif claude_md.is_symlink():
        print_warning("⚠️  CLAUDE.md is a symlink (old format)")
        response = input("Replace with standalone file? (Y/n): ").strip().lower()
        if response != 'n':
            claude_md.unlink()
            shutil.copy2(claude_template, claude_md)
            print_success("✓ Replaced symlink with standalone CLAUDE.md")
            return True
        else:
            print_warning("⊘ Kept symlink")
            return True
    else:
        shutil.copy2(claude_template, claude_md)
        print_success("✓ Created CLAUDE.md")
        return True


def create_agents_commands_symlink(target_dir: Path) -> bool:
    """Create .agents/commands/ symlink to toolkit scripts.
    
    Returns:
        True if successful
    """
    print()
    print_info("[4/9] Symlinking .agents/commands/...")
    
    agents_dir = target_dir / '.agents'
    agents_dir.mkdir(exist_ok=True)
    
    commands_link = agents_dir / 'commands'
    commands_source = TOOLKIT_DIR / 'scripts'
    
    if not commands_link.exists():
        success, method, warning = create_link(commands_link, commands_source)
        if success:
            print_success("✓ Created .agents/commands/ -> ~/.agents_toolkit/scripts/")
            if warning:
                print_warning(warning)
            return True
        else:
            print_error(f"Failed to create symlink: {method}")
            return False
    else:
        print_success("✓ Already exists")
        return True


def install_cursor_commands(target_dir: Path, update_mode: bool) -> bool:
    """Install Cursor command wrappers.
    
    Returns:
        True if successful
    """
    print()
    print_info("[5/9] Installing Cursor command wrappers...")
    
    commands_src = TOOLKIT_DIR / 'templates' / 'cursor-commands'
    commands_dst = target_dir / '.cursor' / 'commands'
    commands_dst.mkdir(parents=True, exist_ok=True)
    
    if update_mode:
        existing = list(commands_dst.glob('*.md'))
        if existing:
            response = input("Update existing .cursor/commands/*.md from templates? (y/N): ").strip().lower()
            if response == 'y':
                for src_file in commands_src.glob('*.md'):
                    shutil.copy2(src_file, commands_dst)
                print_success("✓ Updated Cursor command wrappers")
                return True
            else:
                print_warning("⊘ Skipped updating Cursor command wrappers")
                return True
        else:
            # No existing files, install them
            for src_file in commands_src.glob('*.md'):
                shutil.copy2(src_file, commands_dst)
            print_success("✓ Installed Cursor command wrappers")
            return True
    else:
        # Initial installation
        installed_any = False
        for src_file in commands_src.glob('*.md'):
            dst_file = commands_dst / src_file.name
            if not dst_file.exists():
                shutil.copy2(src_file, commands_dst)
                installed_any = True
                print_success(f"✓ {src_file.name}")
        
        if not installed_any:
            print_success("✓ Cursor command wrappers already present")
        
        return True


def install_cursor_rules(target_dir: Path, update_mode: bool) -> bool:
    """Install Cursor rules.
    
    Returns:
        True if successful
    """
    print()
    print_info("[6/9] Installing .cursor/rules/...")
    
    rules_dir = target_dir / '.cursor' / 'rules' / 'agents-workflow'
    rules_dir.mkdir(parents=True, exist_ok=True)
    
    rule_file = rules_dir / 'RULE.md'
    rule_template = TOOLKIT_DIR / 'cursor-rules' / 'agents-workflow' / 'RULE.md.template'
    
    if rule_file.exists():
        if update_mode:
            response = input("Update existing RULE.md from template? (y/N): ").strip().lower()
            if response == 'y':
                rule_file.unlink()
                shutil.copy2(rule_template, rule_file)
                print_success("✓ Updated .cursor/rules/agents-workflow/RULE.md")
                return True
            else:
                print_warning("⊘ Skipped update")
                return True
        else:
            print_success("✓ Already exists")
            return True
    else:
        shutil.copy2(rule_template, rule_file)
        print_success("✓ Installed .cursor/rules/agents-workflow/RULE.md")
        return True


def create_issue_screenshots_dir(target_dir: Path) -> bool:
    """Create .issue_screenshots/ directory.
    
    Returns:
        True if successful
    """
    print()
    print_info("[7/9] Creating .issue_screenshots/...")
    
    screenshots_dir = target_dir / '.issue_screenshots'
    screenshots_dir.mkdir(exist_ok=True)
    
    gitkeep = screenshots_dir / '.gitkeep'
    if not gitkeep.exists():
        gitkeep.touch()
    
    print_success("✓ Created .issue_screenshots/")
    return True


def install_github_templates(target_dir: Path, update_mode: bool) -> bool:
    """Install GitHub templates (optional).
    
    Returns:
        True if successful
    """
    print()
    print_info("[8/9] GitHub templates")
    
    github_dir = target_dir / '.github'
    issue_template = github_dir / 'ISSUE_TEMPLATE.md'
    pr_template = github_dir / 'PULL_REQUEST_TEMPLATE.md'
    
    if update_mode:
        updated_any = False
        
        if issue_template.exists():
            response = input("Update existing ISSUE_TEMPLATE.md? (y/N): ").strip().lower()
            if response == 'y':
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'ISSUE_TEMPLATE.md', issue_template)
                print_success("✓ Updated ISSUE_TEMPLATE.md")
                updated_any = True
            else:
                print_warning("⊘ Skipped ISSUE_TEMPLATE.md")
        
        if pr_template.exists():
            response = input("Update existing PULL_REQUEST_TEMPLATE.md? (y/N): ").strip().lower()
            if response == 'y':
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'PULL_REQUEST_TEMPLATE.md', pr_template)
                print_success("✓ Updated PULL_REQUEST_TEMPLATE.md")
                updated_any = True
            else:
                print_warning("⊘ Skipped PULL_REQUEST_TEMPLATE.md")
        
        if not updated_any:
            print_warning("⊘ No existing templates to update")
        
        return True
    else:
        print_warning("Install .github/ templates?")
        response = input("Install .github/ templates? (Y/n): ").strip().lower()
        
        if response != 'n':
            github_dir.mkdir(exist_ok=True)
            
            if not issue_template.exists():
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'ISSUE_TEMPLATE.md', issue_template)
                print_success("✓ ISSUE_TEMPLATE.md")
            
            if not pr_template.exists():
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'PULL_REQUEST_TEMPLATE.md', pr_template)
                print_success("✓ PULL_REQUEST_TEMPLATE.md")
            
            return True
        else:
            print_warning("⊘ Skipped")
            return True


def install_vscode_tasks(target_dir: Path, update_mode: bool) -> bool:
    """Install VS Code tasks (optional).
    
    Returns:
        True if successful
    """
    print()
    print_info("[9/9] VS Code tasks")
    
    vscode_dir = target_dir / '.vscode'
    tasks_file = vscode_dir / 'tasks.json'
    
    if update_mode:
        if tasks_file.exists():
            response = input("Update existing .vscode/tasks.json? (y/N): ").strip().lower()
            if response == 'y':
                vscode_dir.mkdir(exist_ok=True)
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'vscode-tasks.json', tasks_file)
                print_success("✓ Updated .vscode/tasks.json")
                return True
            else:
                print_warning("⊘ Skipped .vscode/tasks.json")
                return True
        else:
            print_warning("⊘ No existing .vscode/tasks.json to update")
            return True
    else:
        print_warning("Install VS Code tasks?")
        response = input("Install .vscode/tasks.json? (Y/n): ").strip().lower()
        
        if response != 'n':
            vscode_dir.mkdir(exist_ok=True)
            if not tasks_file.exists():
                shutil.copy2(TOOLKIT_DIR / 'templates' / 'vscode-tasks.json', tasks_file)
                print_success("✓ .vscode/tasks.json")
            else:
                print_success("✓ .vscode/tasks.json already exists")
            return True
        else:
            print_warning("⊘ Skipped")
            return True


def print_summary(target_dir: Path, update_mode: bool):
    """Print initialization summary."""
    print()
    print(f"{colors.GREEN}================================================{colors.NC}")
    if update_mode:
        print(f"{colors.GREEN}   Update Complete!{colors.NC}")
    else:
        print(f"{colors.GREEN}   Initialization Complete!{colors.NC}")
    print(f"{colors.GREEN}================================================{colors.NC}")
    print()
    print(f"{colors.BLUE}Files managed:{colors.NC}")
    print("  • AGENTS.md (symlink to global constitution; auto-updates via toolkit)")
    print("  • CLAUDE.md (copied; Claude Code enforcement; refreshed via --update)")
    print("  • .agents/commands/ (symlink to toolkit scripts; agent-agnostic)")
    print("  • .cursor/commands/*.md (Cursor prompt wrappers for slash commands)")
    print("  • .cursor/rules/agents-workflow/RULE.md (copied; refreshed via --update)")
    print("  • AGENTS.local.md (repo overrides; left untouched in --update)")
    print("  • .issue_screenshots/")
    if update_mode:
        print("  • .github templates (updated only when already present)")
        print("  • .vscode/tasks.json (updated only when already present)")
    else:
        print("  • .github templates (optional install)")
        print("  • .vscode/tasks.json (optional install)")
    print()
    print(f"{colors.BLUE}Next steps:{colors.NC}")
    if update_mode:
        print("  1. Review updated files and commit if desired")
        print("  2. Open Cursor - rules will auto-load")
    else:
        print("  1. Review AGENTS.local.md and uncomment customizations")
        print("  2. Commit files: git add AGENTS.md CLAUDE.md .agents/ .cursor/ .issue_screenshots/")
        print("  3. Open Cursor - rules will auto-load")
    print("  4. Try: .agents/commands/status.py (Cursor users can also use /status)")
    print()
    print(f"{colors.YELLOW}Note: Symlinks are committed to git for team visibility{colors.NC}")
    print()


def main():
    """Main initialization flow."""
    args = parse_args()
    
    print(f"{colors.BLUE}================================================{colors.NC}")
    if args.update:
        print(f"{colors.BLUE}   Agents Toolkit Update Mode{colors.NC}")
    else:
        print(f"{colors.BLUE}   Agents Toolkit Initialization{colors.NC}")
    print(f"{colors.BLUE}================================================{colors.NC}")
    print()
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Determine target directory
    repo_root = get_repo_root()
    if not repo_root:
        print_error("Error: Could not determine repository root")
        sys.exit(1)
    
    if args.subdir:
        target_dir = repo_root / args.subdir
        target_dir.mkdir(parents=True, exist_ok=True)
    else:
        target_dir = repo_root
    
    print_success(f"Target: {target_dir}")
    print()
    
    # Check symlink support and warn if needed
    supports_symlinks, msg = check_symlink_support()
    if not supports_symlinks:
        print_warning(f"⚠️  {msg}")
        print()
    
    # Run installation steps
    if not create_agents_md_symlink(target_dir, args.update):
        sys.exit(1)
    
    if not create_agents_local_md(target_dir, args.update):
        sys.exit(1)
    
    if not create_claude_md(target_dir, args.update):
        sys.exit(1)
    
    if not create_agents_commands_symlink(target_dir):
        sys.exit(1)
    
    if not install_cursor_commands(target_dir, args.update):
        sys.exit(1)
    
    if not install_cursor_rules(target_dir, args.update):
        sys.exit(1)
    
    if not create_issue_screenshots_dir(target_dir):
        sys.exit(1)
    
    if not install_github_templates(target_dir, args.update):
        sys.exit(1)
    
    if not install_vscode_tasks(target_dir, args.update):
        sys.exit(1)
    
    # Print summary
    print_summary(target_dir, args.update)
    
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_warning("Initialization cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Initialization failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

