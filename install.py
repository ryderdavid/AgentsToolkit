#!/usr/bin/env python3
"""AgentsToolkit Global Installer - Cross-platform.

Installs toolkit to ~/.agentsmd/ and adds bin/ to PATH.
Works on Windows, macOS, and Linux.

Note: Workflow scripts expect GitHub CLI (gh) to be installed and authenticated.
"""

import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# Add lib to path for imports
sys.path.insert(0, str(Path(__file__).parent / 'scripts'))

from lib.common import colors, print_error, print_success, print_warning, print_info
from lib.symlinks import create_link


def is_windows() -> bool:
    """Check if running on Windows."""
    return platform.system() == 'Windows'


def get_install_dir() -> Path:
    """Get installation directory path."""
    return Path.home() / '.agentsmd'


def get_script_dir() -> Path:
    """Get the directory containing this script."""
    return Path(__file__).parent.resolve()


def check_already_installed(install_dir: Path, script_dir: Path) -> bool:
    """Check if already installed and prompt for overwrite.
    
    Returns:
        True to continue installation, False to cancel
    """
    if install_dir.exists() and install_dir != script_dir:
        print_warning(f"Toolkit already installed at {install_dir}")
        response = input("Overwrite? (y/N): ").strip().lower()
        if response != 'y':
            print("Installation cancelled")
            return False
        
        # Remove existing installation
        shutil.rmtree(install_dir)
    
    return True


def copy_toolkit(script_dir: Path, install_dir: Path) -> bool:
    """Copy toolkit files to installation directory.
    
    Returns:
        True if successful
    """
    print_info(f"[1/3] Installing toolkit to {install_dir}...")
    
    if script_dir == install_dir:
        print_success("✓ Already installed in correct location")
        return True
    
    try:
        install_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy all files except .git, .venv, __pycache__, etc.
        ignore_patterns = shutil.ignore_patterns(
            '.git', '.venv', '__pycache__', '*.pyc', '.DS_Store',
            '.cursor', '.vscode', 'node_modules'
        )
        
        for item in script_dir.iterdir():
            if item.name in {'.git', '.venv', '__pycache__'}:
                continue
            
            dest = install_dir / item.name
            
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(dest)
                shutil.copytree(item, dest, ignore=ignore_patterns)
            else:
                shutil.copy2(item, dest)
        
        print_success("✓ Copied toolkit files")
        return True
    
    except Exception as e:
        print_error(f"Failed to copy files: {e}")
        return False


def make_scripts_executable(install_dir: Path) -> bool:
    """Make scripts executable (Unix only).
    
    On Windows, .py files are executable by Python interpreter.
    
    Returns:
        True if successful
    """
    print_info("[2/4] Making scripts executable...")
    
    if is_windows():
        print_success("✓ Scripts executable by Python (Windows)")
        return True
    
    try:
        # Make all .py files in scripts/ and bin/ executable
        for pattern in ['scripts/*.py', 'bin/*']:
            for script in install_dir.glob(pattern):
                if script.is_file():
                    script.chmod(0o755)
        
        # Root-level scripts
        for script in ['uninstall.sh', 'install.py', 'uninstall.py']:
            script_path = install_dir / script
            if script_path.exists():
                script_path.chmod(0o755)
        
        print_success("✓ Scripts are executable")
        return True
    
    except Exception as e:
        print_error(f"Failed to make scripts executable: {e}")
        return False


def build_commands(install_dir: Path) -> bool:
    """Build and install agent commands via build_commands.py."""
    print_info("[3/4] Building and installing agent commands...")

    script = install_dir / 'bin' / 'build_commands.py'
    if not script.exists():
        print_warning("⚠️  build_commands.py not found, skipping command build")
        return True

    env = os.environ.copy()
    env['AGENTSMD_HOME'] = str(install_dir)

    try:
        # Use Python to execute the script (cross-platform)
        subprocess.check_call([sys.executable, str(script), 'install'], env=env)
        print_success("✓ Commands built and installed for Cursor/Claude/Codex/Gemini")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to build/install commands: {e}")
        return False
    except (OSError, ValueError) as e:
        # OSError: executable not found or permission denied
        # ValueError: invalid arguments
        print_error(f"Unexpected error running build_commands.py: {e}")
        return False


def create_unix_wrapper(install_dir: Path) -> bool:
    """Create agentsdotmd-init symlink on Unix systems.
    
    On Unix, create a symlink so users can type 'agentsdotmd-init'
    instead of 'agentsdotmd-init.py'.
    
    Returns:
        True if successful
    """
    if is_windows():
        return True  # Not needed on Windows
    
    bin_dir = install_dir / 'bin'
    python_script = bin_dir / 'agentsdotmd-init.py'
    wrapper = bin_dir / 'agentsdotmd-init'
    
    if not python_script.exists():
        print_warning("⚠️  agentsdotmd-init.py not found, skipping wrapper")
        return True
    
    try:
        # Remove existing wrapper if it exists (could be old bash script)
        if wrapper.exists():
            if wrapper.is_symlink() or wrapper.is_file():
                wrapper.unlink()
            else:
                print_warning(f"⚠️  {wrapper} exists but is not a file/symlink, skipping")
                return True
        
        # Create symlink
        wrapper.symlink_to('agentsdotmd-init.py')
        wrapper.chmod(0o755)  # Make sure it's executable
        print_success("✓ Created agentsdotmd-init wrapper")
        return True
    
    except Exception as e:
        print_warning(f"⚠️  Could not create wrapper: {e}")
        print_info("You can still use: agentsdotmd-init.py")
        return True


def add_to_path(install_dir: Path) -> bool:
    """Add bin directory to PATH.
    
    Returns:
        True if successful
    """
    print_info(f"[4/4] Adding {install_dir / 'bin'} to PATH...")
    
    bin_dir = install_dir / 'bin'
    
    if is_windows():
        return add_to_path_windows(bin_dir)
    else:
        return add_to_path_unix(bin_dir)


def add_to_path_unix(bin_dir: Path) -> bool:
    """Add to PATH on Unix (macOS/Linux) by modifying shell config.
    
    Returns:
        True if successful
    """
    home = Path.home()
    
    # Detect shell config file
    shell_config = None
    if (home / '.zshrc').exists():
        shell_config = home / '.zshrc'
    elif (home / '.bashrc').exists():
        shell_config = home / '.bashrc'
    elif (home / '.bash_profile').exists():
        shell_config = home / '.bash_profile'
    
    if not shell_config:
        print_warning("⚠️  Could not detect shell config file")
        print_warning("Manually add to your shell config:")
        print_info(f'export PATH="{bin_dir}:$PATH"')
        return True
    
    # Check if already in PATH
    config_content = shell_config.read_text()
    if '.agentsmd/bin' in config_content:
        print_success(f"✓ Already in PATH ({shell_config})")
        return True
    
    # Add to config
    try:
        with shell_config.open('a') as f:
            f.write('\n# AgentsMD Toolkit\n')
            f.write(f'export PATH="{bin_dir}:$PATH"\n')
        
        print_success(f"✓ Added to {shell_config}")
        print_warning(f"Run: source {shell_config}")
        return True
    
    except Exception as e:
        print_error(f"Failed to update {shell_config}: {e}")
        return False


def add_to_path_windows(bin_dir: Path) -> bool:
    """Add to PATH on Windows using PowerShell.
    
    Returns:
        True if successful
    """
    try:
        # Check if already in PATH
        user_path = os.environ.get('PATH', '')
        if str(bin_dir) in user_path:
            print_success("✓ Already in PATH")
            return True
        
        # Add to user PATH via PowerShell
        ps_command = f'''
$path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($path -notlike "*{bin_dir}*") {{
    [Environment]::SetEnvironmentVariable("Path", "$path;{bin_dir}", "User")
    Write-Output "Added to PATH"
}} else {{
    Write-Output "Already in PATH"
}}
'''
        
        result = subprocess.run(
            ['powershell', '-Command', ps_command],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print_success("✓ Added to PATH (restart terminal to take effect)")
            return True
        else:
            print_warning("⚠️  Could not add to PATH automatically")
            print_warning("Manually add to your PATH:")
            print_info(f"PATH: {bin_dir}")
            return True
    
    except Exception as e:
        print_warning(f"⚠️  Could not add to PATH: {e}")
        print_warning("Manually add to your PATH:")
        print_info(f"PATH: {bin_dir}")
        return True


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
            print_info("Agent configuration will be skipped")
            return None


def configure_agents(install_dir: Path) -> bool:
    """Interactive agent configuration with checkbox menu."""
    print()
    print("─" * 72)
    print()
    response = input("Configure AI agents now? [Y/n]: ").strip().lower()
    
    if response == 'n':
        print_warning("⊘ Skipped agent configuration")
        print_info("You can configure later by re-running install.py")
        return True
    
    inquirer = ensure_inquirer()
    if not inquirer:
        return True  # Skip if inquirer couldn't be installed
    
    questions = [
        inquirer.Checkbox(
            'agents',
            message='Select agents to configure (Space=select, Enter=confirm)',
            choices=[
                'Cursor (custom commands + User Rule)',
                'Claude Code (instructions)',
                'Gemini CLI (config symlink)',
                'GitHub Copilot (instructions)',
                'OpenAI Codex (instructions)',
            ],
        ),
    ]
    
    answers = inquirer.prompt(questions)
    selected = answers['agents'] if answers else []
    
    if not selected:
        print_warning("⊘ No agents selected")
        return True
    
    print()
    print_info("Configuring selected agents...")
    print()
    
    for agent in selected:
        if 'Cursor' in agent:
            configure_cursor(install_dir)
        elif 'Claude Code' in agent:
            configure_claude_code()
        elif 'Gemini CLI' in agent:
            configure_gemini_cli(install_dir)
        elif 'GitHub Copilot' in agent:
            configure_github_copilot()
        elif 'OpenAI Codex' in agent:
            configure_openai_codex()
    
    print()
    print_success("✓ Agent configuration complete")
    return True


def configure_cursor(install_dir: Path) -> bool:
    """Configure Cursor: symlink commands + run User Rule helper."""
    print_info("  [Cursor]")

    # Ensure ~/.cursor/commands points to build outputs
    cursor_commands_dir = Path.home() / '.cursor' / 'commands'
    cursor_commands_dir.parent.mkdir(parents=True, exist_ok=True)

    build_cursor_commands = install_dir / 'build' / 'cursor' / 'commands'
    if build_cursor_commands.exists():
        # Remove existing link/directory
        if cursor_commands_dir.exists() or cursor_commands_dir.is_symlink():
            if cursor_commands_dir.is_dir() and not cursor_commands_dir.is_symlink():
                shutil.rmtree(cursor_commands_dir)
            else:
                cursor_commands_dir.unlink()
        
        success, method, warning = create_link(cursor_commands_dir, build_cursor_commands, force=True)
        if not success:
            print_warning(f"    ⚠️  Could not link Cursor commands: {method}")
        if warning:
            print_warning(f"    {warning}")
        else:
            print_success("    ✓ Commands linked to ~/.cursor/commands/")
    else:
        print_warning("    ⚠️  Build outputs not found; run build_commands.py install")

    # Run cursor_setup.py for User Rule (clipboard + instructions)
    print()
    cursor_setup = install_dir / 'bin' / 'cursor_setup.py'
    if cursor_setup.exists():
        subprocess.run([sys.executable, str(cursor_setup)])
    else:
        print_warning("    ⚠️  cursor_setup.py not found")
        print_info("    Manually add User Rule: 'Always read and follow ~/.agentsmd/AGENTS.md'")
    
    return True


def configure_claude_code() -> bool:
    """Display Claude Code configuration instructions."""
    print_info("  [Claude Code]")
    print_info("    1. Create .claude/config.yml in your project root")
    print_info("    2. Add: rules: ['~/.agentsmd/AGENTS.md']")
    print_success("    ✓ Instructions displayed")
    return True


def configure_gemini_cli(install_dir: Path) -> bool:
    """Configure Gemini CLI and Antigravity."""
    print_info("  [Gemini CLI / Antigravity]")
    
    # 1. Configure Gemini CLI prompts (legacy/standard CLI)
    gemini_prompts_dir = Path.home() / '.config' / 'gemini' / 'prompts'
    gemini_prompts_dir.mkdir(parents=True, exist_ok=True)
    
    agents_md = install_dir / 'AGENTS.md'
    link_path = gemini_prompts_dir / 'agents.md'
    
    if link_path.exists() or link_path.is_symlink():
        link_path.unlink()
    
    success, method, warning = create_link(link_path, agents_md)
    if success:
        print_success("    ✓ Configured ~/.config/gemini/prompts/agents.md")
    else:
        print_warning(f"    ⚠️  Could not create symlink: {method}")

    # 2. Configure Antigravity (~/.gemini)
    gemini_home = Path.home() / '.gemini'
    gemini_home.mkdir(exist_ok=True)
    
    # Update settings.json to include AGENTS.md in context
    settings_path = gemini_home / 'settings.json'
    settings = {}
    if settings_path.exists():
        try:
            with open(settings_path, 'r') as f:
                settings = json.load(f)
        except Exception as e:
            print_warning(f"    ⚠️  Failed to read {settings_path}: {e}")
            # Continue with empty settings if read fails
    
    # Ensure 'context' structure exists
    if 'context' not in settings:
        settings['context'] = {}
    
    # Get current context.fileName or default
    context_files = settings['context'].get('fileName', ["GEMINI.md"])
    if isinstance(context_files, str):
        context_files = [context_files]
    
    # Update context files if needed
    changed = False
    if "AGENTS.md" not in context_files:
        context_files.insert(0, "AGENTS.md") # Prepend AGENTS.md
        if "GEMINI.md" not in context_files:
            context_files.append("GEMINI.md")
        
        settings['context']['fileName'] = context_files
        changed = True
    
    if changed or not settings_path.exists():
        try:
            with open(settings_path, 'w') as f:
                json.dump(settings, f, indent=2)
            print_success(f"    ✓ Updated {settings_path} context.fileName")
        except Exception as e:
            print_error(f"    Failed to write {settings_path}: {e}")

    # Update GEMINI.md to import AGENTS.md
    gemini_md_path = gemini_home / 'GEMINI.md'
    import_line = "@~/.agentsmd/AGENTS.md"
    
    if not gemini_md_path.exists():
        try:
            with open(gemini_md_path, 'w') as f:
                f.write(f"{import_line}\n")
            print_success(f"    ✓ Created {gemini_md_path} with import")
        except Exception as e:
            print_error(f"    Failed to create {gemini_md_path}: {e}")
    else:
        try:
            content = gemini_md_path.read_text()
            if import_line not in content:
                with open(gemini_md_path, 'a') as f:
                    if content and not content.endswith('\n'):
                        f.write('\n')
                    f.write(f"{import_line}\n")
                print_success(f"    ✓ Appended import to {gemini_md_path}")
            else:
                print_success(f"    ✓ Import already present in {gemini_md_path}")
        except Exception as e:
            print_error(f"    Failed to update {gemini_md_path}: {e}")
    
    return True


def configure_github_copilot() -> bool:
    """Display GitHub Copilot configuration instructions."""
    print_info("  [GitHub Copilot]")
    print_info("    1. Create .github/copilot-instructions.md in your project")
    print_info("    2. Reference: 'See AGENTS.md for workflow standards'")
    print_success("    ✓ Instructions displayed")
    return True


def configure_openai_codex() -> bool:
    """Display OpenAI Codex configuration instructions."""
    print_info("  [OpenAI Codex]")
    print_info("    Add to ~/.openai-codex-prompt:")
    print_info("    'Always read and follow ~/.agentsmd/AGENTS.md'")
    print_success("    ✓ Instructions displayed")
    return True


def print_summary(install_dir: Path, shell_config: str = ""):
    """Print installation summary."""
    print()
    print(f"{colors.GREEN}================================================{colors.NC}")
    print(f"{colors.GREEN}   Global Installation Complete!{colors.NC}")
    print(f"{colors.GREEN}================================================{colors.NC}")
    print()
    print(f"{colors.BLUE}Installed:{colors.NC}")
    print(f"  ✓ Toolkit at: ~/.agentsmd/")
    print(f"  ✓ Scripts: ~/.agentsmd/scripts/")
    print(f"  ✓ Base AGENTS.md: ~/.agentsmd/AGENTS.md")
    print()
    print(f"{colors.BLUE}Next steps:{colors.NC}")
    if is_windows():
        print("  1. Restart your terminal (or open a new PowerShell window)")
    else:
        if shell_config:
            print(f"  1. Restart your terminal (or run: source ~/{shell_config})")
        else:
            print("  1. Restart your terminal")
    print("  2. cd to any git repository")
    print("  3. Start using commands! No per-repo setup needed.")
    print()
    print(f"{colors.BLUE}What's configured globally:{colors.NC}")
    print("  • AGENTS.md symlinked (global constitution)")
    print("  • CLAUDE.md symlinked (Claude Code enforcement)")
    print("  • Commands built from ~/.agentsmd/commands/src via build_commands.py")
    print("  • Multi-agent commands symlinked: ~/.cursor/commands, ~/.claude/commands")
    print("  • Codex/Gemini outputs: ~/.codex/prompts, ~/.gemini/commands")
    print("  • Cursor rules available (if Cursor was configured)")
    print()
    print(f"{colors.YELLOW}Note:{colors.NC} v2 has zero per-project setup!")
    print("  Commands work in all repositories automatically.")
    print()


def main():
    """Main installation flow."""
    print(f"{colors.BLUE}================================================{colors.NC}")
    print(f"{colors.BLUE}   Agents Toolkit - Global Installer{colors.NC}")
    print(f"{colors.BLUE}================================================{colors.NC}")
    print()
    
    script_dir = get_script_dir()
    install_dir = get_install_dir()
    
    # Check if already installed
    if not check_already_installed(install_dir, script_dir):
        sys.exit(0)
    
    # Copy toolkit files
    if not copy_toolkit(script_dir, install_dir):
        sys.exit(1)
    
    # Make scripts executable (Unix only)
    if not make_scripts_executable(install_dir):
        sys.exit(1)
    
    # Build and install agent commands
    if not build_commands(install_dir):
        sys.exit(1)

    # Note: agentsdotmd-init is obsolete in v2 (zero per-project setup)
    
    # Add to PATH
    shell_config = ""
    if not is_windows():
        for config in ['.zshrc', '.bashrc', '.bash_profile']:
            if (Path.home() / config).exists():
                shell_config = config
                break
    
    if not add_to_path(install_dir):
        sys.exit(1)
    
    # Configure agents interactively
    if not configure_agents(install_dir):
        sys.exit(1)
    
    # Print summary
    print_summary(install_dir, shell_config)
    
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        print_warning("Installation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Installation failed: {e}")
        sys.exit(1)

