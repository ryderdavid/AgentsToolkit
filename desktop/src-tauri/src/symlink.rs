use crate::types::LinkMethod;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[cfg(target_os = "windows")]
use std::os::windows::fs::{symlink_dir, symlink_file};

#[cfg(not(target_os = "windows"))]
use std::os::unix::fs::symlink;

#[derive(Error, Debug)]
pub enum SymlinkError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),
    #[error("Target does not exist: {0}")]
    TargetNotFound(PathBuf),
    #[error("Link path already exists: {0}")]
    LinkExists(PathBuf),
    #[error("Refusing to overwrite existing non-link path: {0}")]
    WouldOverwrite(PathBuf),
    #[error("All linking methods failed")]
    AllMethodsFailed,
}

pub type Result<T> = std::result::Result<T, SymlinkError>;

/// Create a symbolic link (Unix/Windows with permissions)
#[cfg(target_os = "windows")]
pub fn create_symlink(link_path: &Path, target_path: &Path) -> Result<LinkMethod> {
    let target_is_dir = target_path.is_dir();
    
    if target_is_dir {
        symlink_dir(target_path, link_path)?;
    } else {
        symlink_file(target_path, link_path)?;
    }
    
    Ok(LinkMethod::Symlink)
}

#[cfg(not(target_os = "windows"))]
pub fn create_symlink(link_path: &Path, target_path: &Path) -> Result<LinkMethod> {
    let target_is_dir = target_path.is_dir();
    symlink(target_path, link_path)?;
    Ok(LinkMethod::Symlink)
}

/// Create a junction (Windows directories only)
#[cfg(target_os = "windows")]
pub fn create_junction(link_path: &Path, target_path: &Path) -> Result<LinkMethod> {
    if !target_path.is_dir() {
        return Err(SymlinkError::Io(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Junctions only work for directories",
        )));
    }
    
    junction::create(target_path, link_path)
        .map_err(|e| SymlinkError::Io(io::Error::new(io::ErrorKind::Other, e)))?;
    
    Ok(LinkMethod::Junction)
}

#[cfg(not(target_os = "windows"))]
pub fn create_junction(_link_path: &Path, _target_path: &Path) -> Result<LinkMethod> {
    Err(SymlinkError::Io(io::Error::new(
        io::ErrorKind::Unsupported,
        "Junctions only available on Windows",
    )))
}

/// Create a hard link (files only, same volume)
pub fn create_hardlink(link_path: &Path, target_path: &Path) -> Result<LinkMethod> {
    if !target_path.is_file() {
        return Err(SymlinkError::Io(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Hard links only work for files",
        )));
    }
    
    fs::hard_link(target_path, link_path)?;
    Ok(LinkMethod::Hardlink)
}

/// Copy files/directories as last resort fallback
pub fn copy_as_fallback(link_path: &Path, target_path: &Path) -> Result<LinkMethod> {
    if target_path.is_dir() {
        // Copy directory recursively
        copy_dir_all(target_path, link_path)?;
    } else {
        fs::copy(target_path, link_path)?;
    }
    
    Ok(LinkMethod::Copy)
}

/// Recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Create a link using the best available method with fallback chain
pub fn create_link(
    link_path: PathBuf,
    target_path: PathBuf,
    force: bool,
) -> Result<(LinkMethod, Option<String>)> {
    // Ensure paths are absolute
    let link_path = if link_path.is_absolute() {
        link_path
    } else {
        std::env::current_dir()
            .map_err(|e| SymlinkError::Io(e))?
            .join(link_path)
    };
    
    let target_path = if target_path.is_absolute() {
        target_path
    } else {
        std::env::current_dir()
            .map_err(|e| SymlinkError::Io(e))?
            .join(target_path)
    };
    
    // Canonicalize target if it exists
    let target_path = target_path.canonicalize().unwrap_or(target_path);
    
    // Check if target exists
    if !target_path.exists() {
        return Err(SymlinkError::TargetNotFound(target_path));
    }
    
    // Determine if target is a directory
    let target_is_dir = target_path.is_dir();
    
    // Check existing path behavior
    if link_path.exists() {
        if paths_point_to_same(&link_path, &target_path) {
            return Ok((LinkMethod::Existing, None));
        }

        if !force {
            return Err(SymlinkError::LinkExists(link_path));
        }

        // Only remove if it's a link-like path; avoid deleting real data
        if link_path.is_symlink() {
            fs::remove_file(&link_path)?;
        } else if link_path.is_file() {
            // A real file unrelated to target; do not delete
            return Err(SymlinkError::WouldOverwrite(link_path));
        } else {
            // Directory/junction or other non-link path
            return Err(SymlinkError::WouldOverwrite(link_path));
        }
    }
    
    // Ensure parent directory exists
    if let Some(parent) = link_path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    // Try symlink first
    match create_symlink(&link_path, &target_path) {
        Ok(method) => return Ok((method, None)),
        Err(_) => {} // Fall through to next method
    }
    
    // On Windows, try junction for directories
    #[cfg(target_os = "windows")]
    if target_is_dir {
        match create_junction(&link_path, &target_path) {
            Ok(method) => {
                let warning = "⚠️  Used junction instead of symlink. Consider enabling Developer Mode for true symlinks.".to_string();
                return Ok((method, Some(warning)));
            }
            Err(_) => {} // Fall through to next method
        }
    }
    
    // Try hard link for files
    if !target_is_dir {
        match create_hardlink(&link_path, &target_path) {
            Ok(method) => {
                let warning = "⚠️  Used hard link instead of symlink. Changes to source or link affect both.".to_string();
                return Ok((method, Some(warning)));
            }
            Err(_) => {} // Fall through to next method
        }
    }
    
    // Last resort: copy
    match copy_as_fallback(&link_path, &target_path) {
        Ok(method) => {
            let warning = "⚠️  Copied files instead of creating link. Run 'agentsdotmd-init --update' to sync future toolkit updates.".to_string();
            Ok((method, Some(warning)))
        }
        Err(e) => Err(e),
    }
}

/// Remove a link (symlink, junction, hard link, or copied file/dir)
pub fn remove_link(link_path: PathBuf) -> Result<()> {
    if !link_path.exists() && !link_path.is_symlink() {
        return Ok(()); // Already gone
    }
    
    if link_path.is_dir() && !link_path.is_symlink() {
        // It's a real directory or junction
        #[cfg(target_os = "windows")]
        {
            // Try rmdir first (for junctions), fall back to remove_dir_all
            let result = std::process::Command::new("cmd")
                .args(&["/c", "rmdir", link_path.to_str().unwrap()])
                .output();
            
            if result.is_err() || !result.unwrap().status.success() {
                fs::remove_dir_all(&link_path)?;
            }
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            fs::remove_dir_all(&link_path)?;
        }
    } else {
        // Symlink, hard link, or file
        fs::remove_file(&link_path)?;
    }
    
    Ok(())
}

/// Check if the system supports symlinks without special permissions
pub fn check_symlink_support() -> (bool, String) {
    use std::fs::File;
    
    let temp_dir = std::env::temp_dir();
    let target = temp_dir.join("symlink_test_target.txt");
    let link = temp_dir.join("symlink_test_link.txt");
    
    // Clean up any existing test files
    let _ = fs::remove_file(&target);
    let _ = fs::remove_file(&link);
    
    // Create test file
    if File::create(&target).is_err() {
        return (false, "Could not create test file".to_string());
    }
    
    // Try to create symlink
    match create_symlink(&link, &target) {
        Ok(_) => {
            let _ = fs::remove_file(&link);
            let _ = fs::remove_file(&target);
            (true, "Symlinks supported".to_string())
        }
        Err(_) => {
            let _ = fs::remove_file(&target);
            #[cfg(target_os = "windows")]
            {
                (
                    false,
                    "Symlinks require Developer Mode or Administrator privileges. Will use junctions/hard links/copies as fallback.".to_string(),
                )
            }
            #[cfg(not(target_os = "windows"))]
            {
                (false, "Symlinks not supported (unexpected on Unix)".to_string())
            }
        }
    }
}

fn paths_point_to_same(a: &Path, b: &Path) -> bool {
    // Check read_link first for symlinks/junctions
    if let Ok(resolved) = fs::read_link(a) {
        if resolved == b {
            return true;
        }
        if let Ok(resolved_canon) = resolved.canonicalize() {
            if let Ok(target_canon) = b.canonicalize() {
                if resolved_canon == target_canon {
                    return true;
                }
            }
        }
    }

    // Compare canonicalized paths
    if let (Ok(a_canon), Ok(b_canon)) = (a.canonicalize(), b.canonicalize()) {
        if a_canon == b_canon {
            return true;
        }
    }

    // Compare file identity when possible (handles hard links)
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if let (Ok(a_meta), Ok(b_meta)) = (fs::metadata(a), fs::metadata(b)) {
            if a_meta.dev() == b_meta.dev() && a_meta.ino() == b_meta.ino() {
                return true;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        if let (Ok(a_meta), Ok(b_meta)) = (fs::metadata(a), fs::metadata(b)) {
            if a_meta.file_index() == b_meta.file_index()
                && a_meta.file_index_high() == b_meta.file_index_high()
            {
                return true;
            }
        }
    }

    false
}
