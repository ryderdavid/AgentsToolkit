#!/usr/bin/env python3
"""AgentsToolkit Uninstall/Disable Script for Agents.

Allows users to:
- Disable AGENTS.md from selected agents (rename to .disabled)
- Uninstall AGENTS.md from selected agents (remove completely)

Supports:
- Cursor
- Claude Code
- Gemini CLI / Antigravity
- GitHub Copilot
- OpenAI Codex
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List, Tuple, Optional

# Add lib to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import colors, print_error, print_success, print_warning, print_info
from lib.symlinks import remove_link


class AgentStatus:
    """Represents installation status of an agent."""

    def __init__(self, name: str, installed: bool, details: str = ""):
        self.name = name
        self.installed = installed
        self.details = details


def ensure_inquirer():
    """Auto-install inquirer if missing."""
    try:
        import inquirer
        return inquirer
    except ImportError:
        print_info("📦 Installing required dependency: inquirer...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "inquirer"])
            import inquirer
            return inquirer
        except Exception as e:
            print_warning(f"⚠️  Could not install inquirer: {e}")
            return None


def check_cursor_status() -> AgentStatus:
    """Check if Cursor is configured with AGENTS.md."""
    cursor_commands_dir = Path.home() / '.cursor' / 'commands'

    if not cursor_commands_dir.exists() and not cursor_commands_dir.is_symlink():
        return AgentStatus("Cursor", False)

    # Check if it points to AgentsToolkit commands
    try:
        if cursor_commands_dir.is_symlink() or cursor_commands_dir.exists():
            target = cursor_commands_dir.resolve()
            if '.agentsmd' in str(target) or 'AgentsToolkit' in str(target):
                return AgentStatus("Cursor", True, f"→ {target}")
    except Exception:
        pass

    return AgentStatus("Cursor", False)


def check_claude_code_status() -> AgentStatus:
    """Check if Claude Code is configured (check instructions)."""
    # Claude Code uses project-specific config, not global
    # We can only provide instructions
    return AgentStatus("Claude Code", False, "Manual configuration")


def check_gemini_cli_status() -> AgentStatus:
    """Check if Gemini CLI / Antigravity is configured."""
    gemini_prompts = Path.home() / '.config' / 'gemini' / 'prompts' / 'agents.md'
    gemini_scripts = Path.home() / '.gemini' / 'scripts'
    gemini_settings = Path.home() / '.gemini' / 'settings.json'
    gemini_md = Path.home() / '.gemini' / 'GEMINI.md'

    installed = False
    details = []

    if gemini_prompts.exists() or gemini_prompts.is_symlink():
        installed = True
        details.append("prompts/agents.md")

    if gemini_scripts.exists() or gemini_scripts.is_symlink():
        installed = True
        details.append("scripts symlink")

    if gemini_settings.exists():
        try:
            with open(gemini_settings, 'r') as f:
                settings = json.load(f)
                context_files = settings.get('context', {}).get('fileName', [])
                if 'AGENTS.md' in context_files:
                    installed = True
                    details.append("settings.json")
        except Exception:
            pass

    if gemini_md.exists():
        try:
            content = gemini_md.read_text()
            if '@~/.agentsmd/AGENTS.md' in content:
                installed = True
                details.append("GEMINI.md import")
        except Exception:
            pass

    return AgentStatus("Gemini CLI / Antigravity", installed, ", ".join(details) if details else "")


def check_github_copilot_status() -> AgentStatus:
    """Check if GitHub Copilot is configured (manual)."""
    return AgentStatus("GitHub Copilot", False, "Manual configuration")


def check_openai_codex_status() -> AgentStatus:
    """Check if OpenAI Codex is configured (manual)."""
    return AgentStatus("OpenAI Codex", False, "Manual configuration")


def detect_installed_agents() -> List[AgentStatus]:
    """Detect which agents have AGENTS.md installed."""
    return [
        check_cursor_status(),
        check_claude_code_status(),
        check_gemini_cli_status(),
        check_github_copilot_status(),
        check_openai_codex_status(),
    ]


def disable_cursor() -> bool:
    """Disable Cursor by renaming symlink/directory."""
    print_info("  [Cursor]")
    cursor_commands_dir = Path.home() / '.cursor' / 'commands'
    disabled_path = Path.home() / '.cursor' / 'commands.disabled'

    if not cursor_commands_dir.exists() and not cursor_commands_dir.is_symlink():
        print_warning("    ⚠️  Commands not found, nothing to disable")
        return True

    try:
        if disabled_path.exists():
            print_warning("    ⚠️  .disabled backup already exists, removing it first")
            remove_link(disabled_path)

        cursor_commands_dir.rename(disabled_path)
        print_success("    ✓ Disabled: ~/.cursor/commands → ~/.cursor/commands.disabled")
        return True
    except Exception as e:
        print_error(f"    Failed to disable: {e}")
        return False


def uninstall_cursor() -> bool:
    """Uninstall Cursor by removing symlink/directory."""
    print_info("  [Cursor]")
    cursor_commands_dir = Path.home() / '.cursor' / 'commands'

    if not cursor_commands_dir.exists() and not cursor_commands_dir.is_symlink():
        print_success("    ✓ Already uninstalled")
        return True

    try:
        if remove_link(cursor_commands_dir):
            print_success("    ✓ Removed ~/.cursor/commands")
            return True
        else:
            print_error("    Failed to remove ~/.cursor/commands")
            return False
    except Exception as e:
        print_error(f"    Failed to uninstall: {e}")
        return False


def disable_claude_code() -> bool:
    """Display instructions for disabling Claude Code."""
    print_info("  [Claude Code]")
    print_info("    To disable, comment out or remove from .claude/config.yml:")
    print_info("    # rules: ['~/.agentsmd/AGENTS.md']")
    print_success("    ✓ Instructions displayed")
    return True


def uninstall_claude_code() -> bool:
    """Display instructions for uninstalling Claude Code."""
    print_info("  [Claude Code]")
    print_info("    To uninstall, remove from .claude/config.yml:")
    print_info("    rules: ['~/.agentsmd/AGENTS.md']")
    print_success("    ✓ Instructions displayed")
    return True


def disable_gemini_cli() -> bool:
    """Disable Gemini CLI / Antigravity by renaming files."""
    print_info("  [Gemini CLI / Antigravity]")

    success = True

    # 1. Disable prompts/agents.md
    gemini_prompts = Path.home() / '.config' / 'gemini' / 'prompts' / 'agents.md'
    if gemini_prompts.exists() or gemini_prompts.is_symlink():
        try:
            disabled_path = gemini_prompts.parent / 'agents.md.disabled'
            if disabled_path.exists():
                remove_link(disabled_path)
            gemini_prompts.rename(disabled_path)
            print_success("    ✓ Disabled ~/.config/gemini/prompts/agents.md")
        except Exception as e:
            print_error(f"    Failed to disable prompts/agents.md: {e}")
            success = False

    # 2. Disable scripts symlink
    gemini_scripts = Path.home() / '.gemini' / 'scripts'
    if gemini_scripts.exists() or gemini_scripts.is_symlink():
        try:
            disabled_path = Path.home() / '.gemini' / 'scripts.disabled'
            if disabled_path.exists():
                remove_link(disabled_path)
            gemini_scripts.rename(disabled_path)
            print_success("    ✓ Disabled ~/.gemini/scripts")
        except Exception as e:
            print_error(f"    Failed to disable scripts: {e}")
            success = False

    # 3. Comment out in settings.json
    gemini_settings = Path.home() / '.gemini' / 'settings.json'
    if gemini_settings.exists():
        try:
            with open(gemini_settings, 'r') as f:
                settings = json.load(f)

            context_files = settings.get('context', {}).get('fileName', [])
            if 'AGENTS.md' in context_files:
                context_files.remove('AGENTS.md')
                settings['context']['fileName'] = context_files

                with open(gemini_settings, 'w') as f:
                    json.dump(settings, f, indent=2)
                print_success("    ✓ Removed AGENTS.md from settings.json")
        except Exception as e:
            print_error(f"    Failed to update settings.json: {e}")
            success = False

    # 4. Comment out import in GEMINI.md
    gemini_md = Path.home() / '.gemini' / 'GEMINI.md'
    if gemini_md.exists():
        try:
            content = gemini_md.read_text()
            import_line = '@~/.agentsmd/AGENTS.md'
            if import_line in content:
                # Comment out the import line
                new_content = content.replace(import_line, f'# {import_line}')
                gemini_md.write_text(new_content)
                print_success("    ✓ Commented out import in GEMINI.md")
        except Exception as e:
            print_error(f"    Failed to update GEMINI.md: {e}")
            success = False

    return success


def uninstall_gemini_cli() -> bool:
    """Uninstall Gemini CLI / Antigravity by removing files and config."""
    print_info("  [Gemini CLI / Antigravity]")

    success = True

    # 1. Remove prompts/agents.md
    gemini_prompts = Path.home() / '.config' / 'gemini' / 'prompts' / 'agents.md'
    if gemini_prompts.exists() or gemini_prompts.is_symlink():
        if remove_link(gemini_prompts):
            print_success("    ✓ Removed ~/.config/gemini/prompts/agents.md")
        else:
            print_error("    Failed to remove prompts/agents.md")
            success = False

    # 2. Remove scripts symlink
    gemini_scripts = Path.home() / '.gemini' / 'scripts'
    if gemini_scripts.exists() or gemini_scripts.is_symlink():
        if remove_link(gemini_scripts):
            print_success("    ✓ Removed ~/.gemini/scripts")
        else:
            print_error("    Failed to remove scripts")
            success = False

    # 3. Remove from settings.json
    gemini_settings = Path.home() / '.gemini' / 'settings.json'
    if gemini_settings.exists():
        try:
            with open(gemini_settings, 'r') as f:
                settings = json.load(f)

            context_files = settings.get('context', {}).get('fileName', [])
            if 'AGENTS.md' in context_files:
                context_files.remove('AGENTS.md')
                settings['context']['fileName'] = context_files

                with open(gemini_settings, 'w') as f:
                    json.dump(settings, f, indent=2)
                print_success("    ✓ Removed AGENTS.md from settings.json")
        except Exception as e:
            print_error(f"    Failed to update settings.json: {e}")
            success = False

    # 4. Remove import line from GEMINI.md
    gemini_md = Path.home() / '.gemini' / 'GEMINI.md'
    if gemini_md.exists():
        try:
            content = gemini_md.read_text()
            import_line = '@~/.agentsmd/AGENTS.md'
            if import_line in content:
                # Remove the import line
                lines = content.split('\n')
                lines = [line for line in lines if import_line not in line]
                gemini_md.write_text('\n'.join(lines))
                print_success("    ✓ Removed import from GEMINI.md")
        except Exception as e:
            print_error(f"    Failed to update GEMINI.md: {e}")
            success = False

    return success


def disable_github_copilot() -> bool:
    """Display instructions for disabling GitHub Copilot."""
    print_info("  [GitHub Copilot]")
    print_info("    To disable, comment out in .github/copilot-instructions.md:")
    print_info("    'See AGENTS.md for workflow standards'")
    print_success("    ✓ Instructions displayed")
    return True


def uninstall_github_copilot() -> bool:
    """Display instructions for uninstalling GitHub Copilot."""
    print_info("  [GitHub Copilot]")
    print_info("    To uninstall, remove from .github/copilot-instructions.md:")
    print_info("    'See AGENTS.md for workflow standards'")
    print_success("    ✓ Instructions displayed")
    return True


def disable_openai_codex() -> bool:
    """Display instructions for disabling OpenAI Codex."""
    print_info("  [OpenAI Codex]")
    print_info("    To disable, comment out in ~/.openai-codex-prompt:")
    print_info("    # 'Always read and follow ~/.agentsmd/AGENTS.md'")
    print_success("    ✓ Instructions displayed")
    return True


def uninstall_openai_codex() -> bool:
    """Display instructions for uninstalling OpenAI Codex."""
    print_info("  [OpenAI Codex]")
    print_info("    To uninstall, remove from ~/.openai-codex-prompt:")
    print_info("    'Always read and follow ~/.agentsmd/AGENTS.md'")
    print_success("    ✓ Instructions displayed")
    return True


def process_agents(agents: List[str], mode: str) -> bool:
    """Process selected agents (disable or uninstall).

    Args:
        agents: List of agent names to process
        mode: 'disable' or 'uninstall'

    Returns:
        True if all operations succeeded
    """
    print()
    print_info(f"{mode.capitalize()}ing selected agents...")
    print()

    success = True

    for agent in agents:
        if 'Cursor' in agent:
            if mode == 'disable':
                success &= disable_cursor()
            else:
                success &= uninstall_cursor()
        elif 'Claude Code' in agent:
            if mode == 'disable':
                success &= disable_claude_code()
            else:
                success &= uninstall_claude_code()
        elif 'Gemini' in agent:
            if mode == 'disable':
                success &= disable_gemini_cli()
            else:
                success &= uninstall_gemini_cli()
        elif 'Copilot' in agent:
            if mode == 'disable':
                success &= disable_github_copilot()
            else:
                success &= uninstall_github_copilot()
        elif 'Codex' in agent:
            if mode == 'disable':
                success &= disable_openai_codex()
            else:
                success &= uninstall_openai_codex()

    return success


def main():
    """Main flow."""
    print(f"{colors.BLUE}================================================{colors.NC}")
    print(f"{colors.BLUE}   AgentsToolkit - Disable/Uninstall Agents{colors.NC}")
    print(f"{colors.BLUE}================================================{colors.NC}")
    print()

    # Detect installed agents
    print_info("Detecting installed agents...")
    statuses = detect_installed_agents()

    installed = [s for s in statuses if s.installed]
    not_installed = [s for s in statuses if not s.installed]

    print()
    if installed:
        print_success("Installed agents:")
        for status in installed:
            details = f" ({status.details})" if status.details else ""
            print(f"  ✓ {status.name}{details}")

    if not_installed:
        print()
        print_warning("Not installed:")
        for status in not_installed:
            details = f" ({status.details})" if status.details else ""
            print(f"  ⊘ {status.name}{details}")

    print()
    print("─" * 72)
    print()

    # Ask if user wants to proceed
    response = input("Proceed with disable/uninstall? [Y/n]: ").strip().lower()
    if response == 'n':
        print_warning("⊘ Cancelled")
        return

    # Get inquirer
    inquirer = ensure_inquirer()
    if not inquirer:
        print_error("Could not load inquirer for interactive selection")
        sys.exit(1)

    # Select agents
    questions = [
        inquirer.Checkbox(
            'agents',
            message='Select agents to modify (Space=select, Enter=confirm)',
            choices=[
                'Cursor (custom commands + User Rule)',
                'Claude Code (instructions)',
                'Gemini CLI / Antigravity (config symlink)',
                'GitHub Copilot (instructions)',
                'OpenAI Codex (instructions)',
            ],
        ),
    ]

    answers = inquirer.prompt(questions)
    selected = answers['agents'] if answers else []

    if not selected:
        print_warning("⊘ No agents selected")
        return

    # Ask disable or uninstall
    mode_questions = [
        inquirer.List(
            'mode',
            message='What would you like to do?',
            choices=[
                ('Disable (keep files but make inactive)', 'disable'),
                ('Uninstall (remove completely)', 'uninstall'),
            ],
        ),
    ]

    mode_answers = inquirer.prompt(mode_questions)
    mode = mode_answers['mode'] if mode_answers else 'disable'

    # Confirm
    print()
    print_warning(f"This will {mode} AGENTS.md for: {', '.join(selected)}")
    confirm = input("Continue? [y/N]: ").strip().lower()

    if confirm != 'y':
        print_warning("⊘ Cancelled")
        return

    # Process agents
    success = process_agents(selected, mode)

    print()
    if success:
        print_success(f"✓ {mode.capitalize()} complete!")
    else:
        print_warning(f"⚠️  {mode.capitalize()} completed with some errors")

    print()
    print(f"{colors.BLUE}Notes:{colors.NC}")
    if mode == 'disable':
        print("  • Disabled configurations can be re-enabled by renaming .disabled files")
        print("  • Or re-run install.py to reconfigure")
    else:
        print("  • To reinstall, run install.py and select agents to configure")
    print()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_warning("⊘ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
