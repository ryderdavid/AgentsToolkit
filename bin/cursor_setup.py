#!/usr/bin/env python3
"""AgentsToolkit - Cursor Setup Helper

Copies the User Rule to clipboard and optionally opens Cursor settings.
Cross-platform Python implementation.
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

# Add scripts/lib to path for common utilities
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from lib.common import colors, print_success, print_warning, print_info

RULE_TEXT = "Always read and follow ~/.agentsmd/AGENTS.md"


def copy_to_clipboard(text: str) -> bool:
    """Copy text to clipboard (cross-platform).
    
    Args:
        text: Text to copy
        
    Returns:
        True if successful, False otherwise
    """
    system = platform.system()
    
    try:
        if system == "Darwin":  # macOS
            subprocess.run(["pbcopy"], input=text, text=True, check=True)
            return True
        elif system == "Linux":
            # Try xclip first
            if shutil.which("xclip"):
                subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True, check=True)
                return True
            # Try xsel
            elif shutil.which("xsel"):
                subprocess.run(["xsel", "--clipboard", "--input"], input=text, text=True, check=True)
                return True
            # Try wl-copy (Wayland)
            elif shutil.which("wl-copy"):
                subprocess.run(["wl-copy"], input=text, text=True, check=True)
                return True
        elif system == "Windows" or system.startswith("MINGW") or system.startswith("CYGWIN") or system.startswith("MSYS"):
            # Windows clipboard
            subprocess.run(["clip"], input=text, text=True, check=True)
            return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    
    return False


def open_cursor_settings() -> bool:
    """Try to open Cursor application.
    
    Returns:
        True if Cursor was opened, False otherwise
    """
    system = platform.system()
    
    try:
        if system == "Darwin":  # macOS
            # Check if Cursor.app exists before trying to open
            if Path("/Applications/Cursor.app").exists():
                subprocess.Popen(["open", "-a", "Cursor"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print_success("  ✓ Cursor opened")
                print()
                print("  Navigate to: Cursor → Settings → Cursor Settings → Rules")
                return True
        elif system == "Linux":
            if shutil.which("cursor"):
                subprocess.Popen(["cursor"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print_success("  ✓ Cursor opened")
                print()
                print("  Navigate to: File → Preferences → Cursor Settings → Rules")
                return True
        elif system == "Windows" or system.startswith("MINGW") or system.startswith("CYGWIN") or system.startswith("MSYS"):
            if shutil.which("cursor"):
                subprocess.Popen(["cursor"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print_success("  ✓ Cursor opened")
                print()
                print("  Navigate to: File → Preferences → Cursor Settings → Rules")
                return True
    except Exception:
        pass
    
    print_warning("  ⚠  Could not auto-open Cursor. Please open it manually.")
    return False


def main() -> None:
    """Main setup flow."""
    print()
    print("╔══════════════════════════════════════════════════════════════════════╗")
    print("║                     CURSOR SETUP                                     ║")
    print("╚══════════════════════════════════════════════════════════════════════╝")
    print()
    
    # Copy to clipboard
    if copy_to_clipboard(RULE_TEXT):
        print_success("  ✓ Rule copied to clipboard:")
        print()
        print(f'    "{RULE_TEXT}"')
        print()
    else:
        print_warning("  ⚠  Could not copy to clipboard. Please copy manually:")
        print()
        print(f"    {RULE_TEXT}")
        print()
    
    print("───────────────────────────────────────────────────────────────────────")
    print()
    
    # Ask to open Cursor
    try:
        response = input("  Open Cursor now? [Y/n] ").strip().lower()
        if response in ('', 'y', 'yes'):
            print()
            open_cursor_settings()
    except (EOFError, KeyboardInterrupt):
        print()
    
    print()
    print("───────────────────────────────────────────────────────────────────────")
    print("  INSTRUCTIONS:")
    print("───────────────────────────────────────────────────────────────────────")
    print()
    print("  1. In Cursor, go to: Settings → Cursor Settings → Rules")
    print("  2. Under 'User Rules', click '+ Add Rule'")
    print("  3. Paste (Cmd+V / Ctrl+V)")
    print("  4. Done! ✓")
    print()
    print("══════════════════════════════════════════════════════════════════════")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        sys.exit(0)

