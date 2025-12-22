#!/usr/bin/env python3
"""AgentsToolkit Global Installer - Cross-platform.

Installs toolkit to ~/.agents_toolkit and adds bin/ to PATH.
Works on Windows, macOS, and Linux.

Note: Workflow scripts expect GitHub CLI (gh) to be installed and authenticated.
"""

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
    return Path.home() / '.agents_toolkit'


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
    print_info("[2/3] Making scripts executable...")
    
    if is_windows():
        print_success("✓ Scripts executable by Python (Windows)")
        return True
    
    try:
        # Make all .sh and .py files in scripts/ and bin/ executable
        for pattern in ['scripts/*.sh', 'scripts/*.py', 'bin/*']:
            for script in install_dir.glob(pattern):
                if script.is_file():
                    script.chmod(0o755)
        
        # Root-level scripts
        for script in ['install.sh', 'uninstall.sh', 'install.py', 'uninstall.py']:
            script_path = install_dir / script
            if script_path.exists():
                script_path.chmod(0o755)
        
        print_success("✓ Scripts are executable")
        return True
    
    except Exception as e:
        print_error(f"Failed to make scripts executable: {e}")
        return False


def add_to_path(install_dir: Path) -> bool:
    """Add bin directory to PATH.
    
    Returns:
        True if successful
    """
    print_info(f"[3/3] Adding {install_dir / 'bin'} to PATH...")
    
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
        print_info(f'export PATH="$HOME/.agents_toolkit/bin:$PATH"')
        return True
    
    # Check if already in PATH
    config_content = shell_config.read_text()
    if '.agents_toolkit/bin' in config_content:
        print_success(f"✓ Already in PATH ({shell_config})")
        return True
    
    # Add to config
    try:
        with shell_config.open('a') as f:
            f.write('\n# Agents Toolkit\n')
            f.write('export PATH="$HOME/.agents_toolkit/bin:$PATH"\n')
        
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


def print_summary(install_dir: Path, shell_config: str = ""):
    """Print installation summary."""
    print()
    print(f"{colors.GREEN}================================================{colors.NC}")
    print(f"{colors.GREEN}   Global Installation Complete!{colors.NC}")
    print(f"{colors.GREEN}================================================{colors.NC}")
    print()
    print(f"{colors.BLUE}Installed:{colors.NC}")
    print(f"  ✓ Toolkit at: ~/.agents_toolkit/")
    print(f"  ✓ Command: agentsdotmd-init{'(.py)' if is_windows() else ''} (added to PATH)")
    print(f"  ✓ Scripts: ~/.agents_toolkit/scripts/")
    print(f"  ✓ Base AGENTS.md: ~/.agents_toolkit/AGENTS.md")
    print()
    print(f"{colors.BLUE}Next steps:{colors.NC}")
    if is_windows():
        print("  1. Restart your terminal (or open a new PowerShell window)")
    else:
        print(f"  1. Restart your terminal (or run: source {shell_config})")
    print("  2. cd to any git repository")
    if is_windows():
        print("  3. Run: python agentsdotmd-init.py")
    else:
        print("  3. Run: agentsdotmd-init")
    print()
    print(f"{colors.BLUE}Usage:{colors.NC}")
    print("  cd ~/my-project")
    if is_windows():
        print("  python agentsdotmd-init.py          # Initialize repo with toolkit")
        print("  python agentsdotmd-init.py --subdir backend  # For monorepo subdirectories")
    else:
        print("  agentsdotmd-init                    # Initialize repo with toolkit")
        print("  agentsdotmd-init --subdir backend   # For monorepo subdirectories")
    print()
    print(f"{colors.YELLOW}What agentsdotmd-init does:{colors.NC}")
    print("  • Symlinks AGENTS.md (global constitution)")
    print("  • Creates AGENTS.local.md (repo-specific overrides)")
    print("  • Symlinks .agents/commands/ (workflow scripts; agent-agnostic)")
    print("  • Adds Cursor command wrappers in .cursor/commands/ (markdown prompts)")
    print("  • Installs .cursor/rules/ (Cursor enforcement)")
    print("  • Creates .issue_screenshots/ directory")
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
    
    # Add to PATH
    shell_config = ""
    if not is_windows():
        for config in ['.zshrc', '.bashrc', '.bash_profile']:
            if (Path.home() / config).exists():
                shell_config = config
                break
    
    if not add_to_path(install_dir):
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

