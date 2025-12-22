#!/usr/bin/env python3
"""Cross-platform symlink handling for AgentsToolkit.

Implements a fallback chain for Windows compatibility:
1. Try os.symlink (requires Developer Mode or admin on Windows)
2. Try junction (Windows directories only, no special permissions)
3. Try hard link (files only, same volume)
4. Copy files as last resort with warning

On Unix-like systems (macOS, Linux), symlinks work without special permissions.
"""

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Tuple, Optional


def is_windows() -> bool:
    """Check if running on Windows."""
    return platform.system() == 'Windows'


def create_symlink(
    link_path: Path,
    target_path: Path,
    target_is_dir: bool = False
) -> Tuple[bool, str]:
    """Create a symbolic link (Unix/Windows with permissions).
    
    Args:
        link_path: Path where the symlink will be created
        target_path: Path that the symlink points to
        target_is_dir: Whether target is a directory
        
    Returns:
        Tuple of (success, method_description)
    """
    try:
        link_path.symlink_to(target_path, target_is_directory=target_is_dir)
        return True, "symlink"
    except OSError as e:
        # Common on Windows without Developer Mode or admin
        return False, f"symlink failed: {e}"
    except Exception as e:
        return False, f"symlink error: {e}"


def create_junction(link_path: Path, target_path: Path) -> Tuple[bool, str]:
    """Create a junction (Windows directory symlink without special permissions).
    
    Junctions only work for directories on Windows.
    
    Args:
        link_path: Path where the junction will be created
        target_path: Directory that the junction points to
        
    Returns:
        Tuple of (success, method_description)
    """
    if not is_windows():
        return False, "junctions only available on Windows"
    
    if not target_path.is_dir():
        return False, "junctions only work for directories"
    
    try:
        # Use mklink /J for junction
        result = subprocess.run(
            ['cmd', '/c', 'mklink', '/J', str(link_path), str(target_path)],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            return True, "junction"
        else:
            return False, f"junction failed: {result.stderr}"
    except Exception as e:
        return False, f"junction error: {e}"


def create_hardlink(link_path: Path, target_path: Path) -> Tuple[bool, str]:
    """Create a hard link (files only, same volume).
    
    Hard links only work for files (not directories) and require
    source and destination to be on the same filesystem.
    
    Args:
        link_path: Path where the hard link will be created
        target_path: File that the hard link points to
        
    Returns:
        Tuple of (success, method_description)
    """
    if not target_path.is_file():
        return False, "hard links only work for files"
    
    try:
        if is_windows():
            # Use mklink /H for hard link
            result = subprocess.run(
                ['cmd', '/c', 'mklink', '/H', str(link_path), str(target_path)],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                return True, "hardlink"
            else:
                return False, f"hardlink failed: {result.stderr}"
        else:
            # Unix hard link
            os.link(target_path, link_path)
            return True, "hardlink"
    except Exception as e:
        return False, f"hardlink error: {e}"


def copy_as_fallback(
    link_path: Path,
    target_path: Path,
    target_is_dir: bool = False
) -> Tuple[bool, str]:
    """Copy files/directories as last resort fallback.
    
    Args:
        link_path: Destination path
        target_path: Source path
        target_is_dir: Whether target is a directory
        
    Returns:
        Tuple of (success, method_description)
    """
    try:
        if target_is_dir:
            shutil.copytree(target_path, link_path, symlinks=True)
        else:
            shutil.copy2(target_path, link_path)
        return True, "copy (fallback - manual updates required)"
    except Exception as e:
        return False, f"copy failed: {e}"


def create_link(
    link_path: Path,
    target_path: Path,
    force: bool = False
) -> Tuple[bool, str, Optional[str]]:
    """Create a link using the best available method with fallback chain.
    
    Fallback chain:
    1. Symlink (preferred, works everywhere if permissions allow)
    2. Junction (Windows directories only, no special permissions needed)
    3. Hard link (files only, same volume)
    4. Copy (last resort, requires manual updates)
    
    Args:
        link_path: Path where the link will be created
        target_path: Path that the link points to
        force: If True, remove existing link_path first
        
    Returns:
        Tuple of (success, method_used, warning_message or None)
    """
    # Ensure paths are absolute
    link_path = link_path.resolve()
    target_path = target_path.resolve()
    
    # Check if target exists
    if not target_path.exists():
        return False, "none", f"Target does not exist: {target_path}"
    
    # Determine if target is a directory
    target_is_dir = target_path.is_dir()
    
    # Remove existing link if force=True
    if force and link_path.exists():
        try:
            if link_path.is_dir() and not link_path.is_symlink():
                shutil.rmtree(link_path)
            else:
                link_path.unlink()
        except Exception as e:
            return False, "none", f"Could not remove existing link: {e}"
    
    # Check if link already exists
    if link_path.exists():
        # Check if existing path already points to target
        # (works for symlinks; junctions resolve correctly too)
        try:
            if link_path.resolve() == target_path:
                existing_type = "symlink" if link_path.is_symlink() else "junction/link"
                return True, f"existing {existing_type}", None
        except OSError:
            pass  # Broken link, will fall through to error
        return False, "none", f"Link path already exists: {link_path}"
    
    # Ensure parent directory exists
    link_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Try symlink first (works on all platforms if permissions allow)
    success, method = create_symlink(link_path, target_path, target_is_dir)
    if success:
        return True, method, None
    
    # On Windows, try junction for directories
    if is_windows() and target_is_dir:
        success, method = create_junction(link_path, target_path)
        if success:
            warning = (
                "⚠️  Used junction instead of symlink. "
                "Consider enabling Developer Mode for true symlinks."
            )
            return True, method, warning
    
    # Try hard link for files (same volume only)
    if not target_is_dir:
        success, method = create_hardlink(link_path, target_path)
        if success:
            warning = (
                "⚠️  Used hard link instead of symlink. "
                "Changes to source or link affect both."
            )
            return True, method, warning
    
    # Last resort: copy
    success, method = copy_as_fallback(link_path, target_path, target_is_dir)
    if success:
        warning = (
            "⚠️  Copied files instead of creating link. "
            "Run 'agentsdotmd-init --update' to sync future toolkit updates."
        )
        return True, method, warning
    
    # All methods failed
    return False, method, "All linking methods failed"


def check_symlink_support() -> Tuple[bool, str]:
    """Check if the system supports symlinks without special permissions.
    
    Returns:
        Tuple of (supports_symlinks, explanation)
    """
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        target = tmp_path / "target.txt"
        link = tmp_path / "link.txt"
        
        target.write_text("test")
        
        try:
            link.symlink_to(target)
            return True, "Symlinks supported"
        except OSError:
            if is_windows():
                return False, (
                    "Symlinks require Developer Mode or Administrator privileges. "
                    "Will use junctions/hard links/copies as fallback."
                )
            else:
                return False, "Symlinks not supported (unexpected on Unix)"
        except Exception as e:
            return False, f"Symlink test failed: {e}"


def remove_link(link_path: Path) -> bool:
    """Remove a link (symlink, junction, hard link, or copied file/dir).
    
    Args:
        link_path: Path to remove
        
    Returns:
        True if removed successfully, False otherwise
    """
    try:
        if not link_path.exists() and not link_path.is_symlink():
            return True  # Already gone
        
        if link_path.is_dir() and not link_path.is_symlink():
            # It's a real directory or junction
            if is_windows():
                # Try rmdir first (for junctions), fall back to rmtree
                result = subprocess.run(['cmd', '/c', 'rmdir', str(link_path)], 
                                        capture_output=True)
                if result.returncode != 0:
                    # Not a junction or is non-empty, use shutil
                    shutil.rmtree(link_path)
            else:
                shutil.rmtree(link_path)
        else:
            # Symlink, hard link, or file
            link_path.unlink()
        
        return True
    except Exception:
        return False

