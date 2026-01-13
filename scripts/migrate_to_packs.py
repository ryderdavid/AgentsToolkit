#!/usr/bin/env python3
"""Migration script from legacy AGENTS.md to modular rule packs.

This script helps users migrate from the monolithic AGENTS.md to the
modular rule pack system introduced in AgentsToolkit v2.0.

Usage: python3 ~/.agentsmd/scripts/migrate_to_packs.py
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# Add lib to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from lib.common import colors, print_error, print_success, print_warning, print_info
except ImportError:
    # Fallback if lib not available
    class colors:
        GREEN = '\033[0;32m'
        BLUE = '\033[0;34m'
        YELLOW = '\033[0;33m'
        RED = '\033[0;31m'
        NC = '\033[0m'
    
    def print_error(msg): print(f"{colors.RED}✗ {msg}{colors.NC}")
    def print_success(msg): print(f"{colors.GREEN}✓ {msg}{colors.NC}")
    def print_warning(msg): print(f"{colors.YELLOW}⚠ {msg}{colors.NC}")
    def print_info(msg): print(f"{colors.BLUE}ℹ {msg}{colors.NC}")


def get_install_dir() -> Path:
    """Get the AgentsToolkit installation directory."""
    return Path(os.environ.get('AGENTSMD_HOME', Path.home() / '.agentsmd'))


def detect_customizations(agents_md: Path, legacy_md: Path) -> bool:
    """Detect if user has customized AGENTS.md beyond the default."""
    if not agents_md.exists() or not legacy_md.exists():
        return False
    
    current = agents_md.read_text()
    legacy = legacy_md.read_text()
    
    # Simple comparison - if different from legacy, likely customized
    return current.strip() != legacy.strip()


def extract_custom_rules(agents_md: Path) -> str:
    """Extract custom rules that aren't in the standard sections."""
    content = agents_md.read_text()
    
    # Known standard section headers
    standard_sections = [
        '## Prime Directives',
        '## Issue-First Development',
        '## Branch Management',
        '## Screenshot Handling',
        '## Pull Request Protocol',
        '## Commit Standards',
        '## Scope Management',
        '## Feedback Discipline',
        '## Walkthrough Documentation',
        '## GitHub Output',
        '## Safety & Execution',
        '## Anti-Patterns'
    ]
    
    # Find any additional sections
    lines = content.split('\n')
    custom_sections = []
    in_custom = False
    current_section = []
    
    for line in lines:
        if line.startswith('## '):
            if in_custom and current_section:
                custom_sections.append('\n'.join(current_section))
            
            # Check if this is a standard section
            is_standard = any(line.startswith(s) for s in standard_sections)
            in_custom = not is_standard
            current_section = [line] if in_custom else []
        elif in_custom:
            current_section.append(line)
    
    if in_custom and current_section:
        custom_sections.append('\n'.join(current_section))
    
    return '\n\n'.join(custom_sections)


def create_custom_pack(install_dir: Path, custom_content: str) -> bool:
    """Create a custom pack from extracted rules."""
    packs_dir = install_dir / 'rule-packs'
    custom_dir = packs_dir / 'custom'
    custom_dir.mkdir(parents=True, exist_ok=True)
    
    # Create pack.json
    pack_json = {
        "id": "custom",
        "name": "Custom Rules",
        "version": "1.0.0",
        "description": "Custom workflow rules migrated from legacy AGENTS.md",
        "dependencies": ["core"],
        "targetAgents": ["*"],
        "files": ["custom-rules.md"],
        "metadata": {
            "wordCount": len(custom_content.split()),
            "characterCount": len(custom_content),
            "category": "workflow",
            "tags": ["custom", "migrated"]
        }
    }
    
    with open(custom_dir / 'pack.json', 'w') as f:
        json.dump(pack_json, f, indent=2)
    
    # Create custom rules markdown
    custom_md = f"""# Custom Rules

*Migrated from legacy AGENTS.md on {datetime.now().strftime('%Y-%m-%d')}*

{custom_content}
"""
    
    with open(custom_dir / 'custom-rules.md', 'w') as f:
        f.write(custom_md)
    
    return True


def update_agents_md_imports(install_dir: Path, include_custom: bool = False) -> bool:
    """Update AGENTS.md to use modular imports."""
    agents_md = install_dir / 'AGENTS.md'
    modular_md = install_dir / 'AGENTS.modular.md'
    
    # If we have a modular template, use it
    if modular_md.exists():
        content = modular_md.read_text()
    else:
        # Generate fresh modular AGENTS.md
        content = """# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

Non-negotiable rules for all AI agents. Violations constitute workflow failures.

**Version:** 2.0.0 (Modular Rule Packs)  
**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

---

## Active Rule Packs

This configuration loads the following rule packs:

- **Core Workflow Standards** (`rule-packs/core/`) — Universal rules
- **GitHub Workflow Hygiene** (`rule-packs/github-hygiene/`) — GitHub-specific rules

---

<!-- BEGIN PACK IMPORTS -->

@rule-packs/core/prime-directives.md
@rule-packs/core/scope-management.md
@rule-packs/core/feedback-discipline.md
@rule-packs/core/safety-execution.md

@rule-packs/github-hygiene/issue-first.md
@rule-packs/github-hygiene/branch-management.md
@rule-packs/github-hygiene/screenshot-handling.md
@rule-packs/github-hygiene/pr-protocol.md
@rule-packs/github-hygiene/commit-standards.md
@rule-packs/github-hygiene/walkthrough-docs.md
@rule-packs/github-hygiene/github-output.md
@rule-packs/github-hygiene/anti-patterns.md

<!-- END PACK IMPORTS -->

---

## Configuration

**Character Budget:**
- Core: ~450 words (~2,800 chars)
- GitHub Hygiene: ~650 words (~4,200 chars)
- **Total:** ~1,100 words (~7,000 chars)
"""
    
    # Add custom pack import if needed
    if include_custom:
        content = content.replace(
            '<!-- END PACK IMPORTS -->',
            '\n@rule-packs/custom/custom-rules.md\n\n<!-- END PACK IMPORTS -->'
        )
    
    with open(agents_md, 'w') as f:
        f.write(content)
    
    return True


def backup_current_config(install_dir: Path) -> Path:
    """Create a backup of current configuration."""
    backup_dir = install_dir / 'backups'
    backup_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = backup_dir / f'AGENTS.md.{timestamp}.bak'
    
    agents_md = install_dir / 'AGENTS.md'
    if agents_md.exists():
        shutil.copy2(agents_md, backup_path)
    
    return backup_path


def main():
    """Main migration flow."""
    print(f"{colors.BLUE}================================================{colors.NC}")
    print(f"{colors.BLUE}   AgentsToolkit Migration to Rule Packs{colors.NC}")
    print(f"{colors.BLUE}================================================{colors.NC}")
    print()
    
    install_dir = get_install_dir()
    agents_md = install_dir / 'AGENTS.md'
    legacy_md = install_dir / 'AGENTS.legacy.md'
    packs_dir = install_dir / 'rule-packs'
    
    # Check if already using modular packs
    if agents_md.exists():
        content = agents_md.read_text()
        if '<!-- BEGIN PACK IMPORTS -->' in content:
            print_success("Already using modular rule packs!")
            print_info("No migration needed.")
            return 0
    
    # Check if rule packs exist
    if not packs_dir.exists():
        print_error(f"Rule packs not found at {packs_dir}")
        print_info("Please run install.py to set up the toolkit first.")
        return 1
    
    print_info("Checking current configuration...")
    print()
    
    # Detect customizations
    has_customizations = detect_customizations(agents_md, legacy_md)
    
    if has_customizations:
        print_warning("Customizations detected in your AGENTS.md")
        print()
        response = input("Would you like to preserve your custom rules as a pack? [Y/n]: ").strip().lower()
        
        if response != 'n':
            custom_content = extract_custom_rules(agents_md)
            
            if custom_content.strip():
                print_info("Extracting custom rules...")
                create_custom_pack(install_dir, custom_content)
                print_success("Created custom pack at rule-packs/custom/")
            else:
                print_info("No custom sections found to extract.")
                has_customizations = False
    
    # Create backup
    print_info("Creating backup...")
    backup_path = backup_current_config(install_dir)
    print_success(f"Backup saved to {backup_path}")
    
    # Update AGENTS.md
    print_info("Updating AGENTS.md to use modular imports...")
    update_agents_md_imports(install_dir, include_custom=has_customizations)
    print_success("AGENTS.md updated!")
    
    print()
    print(f"{colors.GREEN}================================================{colors.NC}")
    print(f"{colors.GREEN}   Migration Complete!{colors.NC}")
    print(f"{colors.GREEN}================================================{colors.NC}")
    print()
    print(f"{colors.BLUE}Active packs:{colors.NC}")
    print("  • core (universal rules)")
    print("  • github-hygiene (GitHub-specific)")
    if has_customizations:
        print("  • custom (your preserved customizations)")
    print()
    print(f"{colors.BLUE}To switch to Azure DevOps:{colors.NC}")
    print("  Edit AGENTS.md and replace github-hygiene imports with azure-devops")
    print()
    print(f"{colors.BLUE}To revert to legacy mode:{colors.NC}")
    print(f"  cp {backup_path} {agents_md}")
    print()
    
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print()
        print_warning("Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Migration failed: {e}")
        sys.exit(1)
