//! Out-Reference Management System
//!
//! Provides CRUD operations for managing out-references - external files
//! that can be referenced by commands and rule packs.

use crate::command_registry;
use crate::fs_manager;
use crate::types::{
    BrokenLink, OutReference, OutReferenceCategory, OutReferenceValidationReport, ReferenceLink,
    FileFormat, RulePack,
};
use once_cell::sync::Lazy;
use regex::Regex;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde_json;
use uuid::Uuid;

/// Metadata index file structure
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OutReferenceMetadata {
    pub version: String,
    pub references: Vec<OutReference>,
}

/// Get the out-references directory path
pub fn get_out_references_dir() -> PathBuf {
    fs_manager::get_agentsmd_home().join("out-references")
}

/// Ensure the out-references directory structure exists
pub fn ensure_out_references_dir() -> Result<PathBuf, String> {
    let base_dir = get_out_references_dir();

    // Create category subdirectories
    let categories = ["templates", "examples", "schemas"];
    for category in &categories {
        let category_dir = base_dir.join(category);
        if !category_dir.exists() {
            fs::create_dir_all(&category_dir)
                .map_err(|e| format!("Failed to create directory {}: {}", category, e))?;
        }
    }

    // Create metadata.json if it doesn't exist
    let metadata_path = base_dir.join("metadata.json");
    if !metadata_path.exists() {
        let metadata = OutReferenceMetadata {
            version: "1.0.0".to_string(),
            references: Vec::new(),
        };
        let json = serde_json::to_string_pretty(&metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(&metadata_path, json)
            .map_err(|e| format!("Failed to write metadata.json: {}", e))?;
    }

    Ok(base_dir)
}

/// Load metadata from disk
fn load_metadata() -> Result<OutReferenceMetadata, String> {
    let metadata_path = get_out_references_dir().join("metadata.json");

    if !metadata_path.exists() {
        let mut metadata = OutReferenceMetadata {
            version: "1.0.0".to_string(),
            references: Vec::new(),
        };
        populate_linked_from(&mut metadata)?;
        return Ok(metadata);
    }

    let content = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata.json: {}", e))?;

    let mut metadata: OutReferenceMetadata =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse metadata.json: {}", e))?;
    populate_linked_from(&mut metadata)?;
    Ok(metadata)
}

/// Normalize a reference path for comparison
fn normalize_reference_path(path: &str) -> String {
    path.trim_start_matches("../")
        .trim_start_matches("./")
        .trim_start_matches("~/.agentsmd/")
        .trim_start_matches(".agentsmd/")
        .trim_start_matches("out-references/")
        .trim()
        .to_string()
}

/// Check if two reference paths refer to the same target
fn reference_matches(meta_path: &str, ref_path: &str) -> bool {
    let meta_norm = normalize_reference_path(meta_path);
    let ref_norm = normalize_reference_path(ref_path);

    ref_norm.contains(&meta_norm) || meta_norm.contains(&ref_norm)
}

/// Parse out-reference style links from markdown content
fn parse_out_reference_links(content: &str) -> Vec<String> {
    static LINK_PATTERN: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap());

    let mut references = Vec::new();

    for caps in LINK_PATTERN.captures_iter(content) {
        if let Some(link_path) = caps.get(2) {
            let path = link_path.as_str();
            if path.contains("rule-packs/")
                || path.contains("docs/")
                || path.contains("templates/")
                || path.contains("out-references/")
            {
                let normalized = normalize_reference_path(path);
                if !references.contains(&normalized) {
                    references.push(normalized);
                }
            }
        }
    }

    references
}

/// Load pack metadata with out-reference overrides applied
fn load_packs_with_overrides() -> Result<Vec<RulePack>, String> {
    let pack_ids = fs_manager::list_rule_packs()
        .map_err(|e| format!("Failed to list packs: {}", e))?;
    let overrides = fs_manager::read_pack_out_ref_overrides().unwrap_or_default();
    let mut packs = Vec::new();

    for id in pack_ids {
        match fs_manager::read_pack_json(id.clone()) {
            Ok(json) => match serde_json::from_str::<RulePack>(&json) {
                Ok(mut pack) => {
                    if let Some(refs) = overrides.get(&pack.id) {
                        pack.out_references = refs.clone();
                    }
                    packs.push(pack);
                }
                Err(e) => log::warn!("Failed to parse pack {}: {}", id, e),
            },
            Err(e) => log::warn!("Failed to read pack {}: {}", id, e),
        }
    }

    Ok(packs)
}

/// Collect out-reference links from rule packs (overrides + parsed content)
fn collect_pack_references() -> Result<Vec<(RulePack, Vec<String>)>, String> {
    let packs = load_packs_with_overrides()?;
    let mut results = Vec::new();

    for mut pack in packs {
        let mut refs = pack.out_references.clone();

        match fs_manager::read_pack_content(pack.id.clone()) {
            Ok(content) => {
                refs.extend(parse_out_reference_links(&content));
            }
            Err(e) => {
                log::warn!("Failed to read pack content for {}: {}", pack.id, e);
            }
        }

        refs.sort();
        refs.dedup();

        pack.out_references = refs.clone();
        results.push((pack, refs));
    }

    Ok(results)
}

/// Populate linked_from for each out-reference using commands and packs
fn populate_linked_from(metadata: &mut OutReferenceMetadata) -> Result<(), String> {
    let commands = command_registry::load_commands().unwrap_or_default();
    let pack_refs = collect_pack_references().unwrap_or_default();

    for out_ref in metadata.references.iter_mut() {
        out_ref.linked_from.clear();

        for cmd in &commands {
            if cmd
                .out_references
                .iter()
                .any(|p| reference_matches(&out_ref.file_path, p))
            {
                out_ref.linked_from.push(format!("command:{}", cmd.id));
            }
        }

        for (pack, refs) in &pack_refs {
            if refs
                .iter()
                .any(|p| reference_matches(&out_ref.file_path, p))
            {
                out_ref.linked_from.push(format!("pack:{}", pack.id));
            }
        }
    }

    Ok(())
}

/// Save metadata to disk
fn save_metadata(metadata: &OutReferenceMetadata) -> Result<(), String> {
    ensure_out_references_dir()?;
    let metadata_path = get_out_references_dir().join("metadata.json");

    let json = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    fs::write(&metadata_path, json).map_err(|e| format!("Failed to write metadata.json: {}", e))
}

/// List all out-references
pub fn list_out_references() -> Result<Vec<OutReference>, String> {
    ensure_out_references_dir()?;
    let metadata = load_metadata()?;
    Ok(metadata.references)
}

/// Get a single out-reference by ID
pub fn get_out_reference(id: String) -> Result<OutReference, String> {
    let metadata = load_metadata()?;
    metadata
        .references
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| format!("Out-reference not found: {}", id))
}

/// Create a new out-reference
pub fn create_out_reference(
    name: String,
    description: String,
    category: String,
    content: String,
    format: String,
    tags: Vec<String>,
) -> Result<OutReference, String> {
    ensure_out_references_dir()?;

    let category_enum = parse_category(&category)?;
    let format_enum = parse_format(&format)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Generate file path based on category and name
    let file_name = generate_file_name(&name, &format_enum);
    let file_path = format!("{}/{}", category, file_name);

    // Calculate counts
    let character_count = content.len() as u64;
    let word_count = content.split_whitespace().count() as u64;

    let out_ref = OutReference {
        id: id.clone(),
        name,
        description,
        category: category_enum,
        file_path: file_path.clone(),
        format: format_enum,
        tags,
        linked_from: Vec::new(),
        character_count,
        word_count,
        created_at: now.clone(),
        updated_at: now,
    };

    // Write the file content
    let full_path = get_out_references_dir().join(&file_path);
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Update metadata
    let mut metadata = load_metadata()?;
    metadata.references.push(out_ref.clone());
    save_metadata(&metadata)?;

    Ok(out_ref)
}

/// Update an existing out-reference's content
pub fn update_out_reference(id: String, content: String) -> Result<(), String> {
    let mut metadata = load_metadata()?;

    let ref_idx = metadata
        .references
        .iter()
        .position(|r| r.id == id)
        .ok_or_else(|| format!("Out-reference not found: {}", id))?;

    // Update file content
    let file_path = &metadata.references[ref_idx].file_path;
    let full_path = get_out_references_dir().join(file_path);
    fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Update metadata
    metadata.references[ref_idx].character_count = content.len() as u64;
    metadata.references[ref_idx].word_count = content.split_whitespace().count() as u64;
    metadata.references[ref_idx].updated_at = Utc::now().to_rfc3339();

    save_metadata(&metadata)?;
    Ok(())
}

/// Update out-reference metadata (name, description, tags)
pub fn update_out_reference_metadata(
    id: String,
    name: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<OutReference, String> {
    let mut metadata = load_metadata()?;

    let ref_idx = metadata
        .references
        .iter()
        .position(|r| r.id == id)
        .ok_or_else(|| format!("Out-reference not found: {}", id))?;

    if let Some(n) = name {
        metadata.references[ref_idx].name = n;
    }
    if let Some(d) = description {
        metadata.references[ref_idx].description = d;
    }
    if let Some(t) = tags {
        metadata.references[ref_idx].tags = t;
    }
    metadata.references[ref_idx].updated_at = Utc::now().to_rfc3339();

    let updated = metadata.references[ref_idx].clone();
    save_metadata(&metadata)?;
    Ok(updated)
}

/// Delete an out-reference
pub fn delete_out_reference(id: String) -> Result<(), String> {
    let mut metadata = load_metadata()?;

    let ref_idx = metadata
        .references
        .iter()
        .position(|r| r.id == id)
        .ok_or_else(|| format!("Out-reference not found: {}", id))?;

    // Delete the file
    let file_path = &metadata.references[ref_idx].file_path;
    let full_path = get_out_references_dir().join(file_path);
    if full_path.exists() {
        fs::remove_file(&full_path)
            .map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    // Remove from metadata
    metadata.references.remove(ref_idx);
    save_metadata(&metadata)?;

    Ok(())
}

/// Read the content of an out-reference
pub fn read_out_reference_content(id: String) -> Result<String, String> {
    let out_ref = get_out_reference(id)?;
    let full_path = get_out_references_dir().join(&out_ref.file_path);

    fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to an out-reference file
pub fn write_out_reference_content(id: String, content: String) -> Result<(), String> {
    update_out_reference(id, content)
}

/// Validate all out-references
pub fn validate_out_references() -> Result<OutReferenceValidationReport, String> {
    let metadata = load_metadata()?;
    let base_dir = get_out_references_dir();
    let commands = command_registry::load_commands().unwrap_or_default();
    let pack_references = collect_pack_references().unwrap_or_default();

    let mut broken_links: Vec<BrokenLink> = Vec::new();
    let mut unused_references: Vec<String> = Vec::new();
    let mut orphaned_files: Vec<String> = Vec::new();

    // Check each reference exists on disk
    for out_ref in &metadata.references {
        let file_path = base_dir.join(&out_ref.file_path);
        if !file_path.exists() {
            broken_links.push(BrokenLink {
                source_type: "out-reference".to_string(),
                source_id: out_ref.id.clone(),
                target_path: out_ref.file_path.clone(),
                reason: "File does not exist".to_string(),
            });
        }
    }

    // Find references in commands that don't exist
    for cmd in &commands {
        for out_ref_path in &cmd.out_references {
            let is_tracked = metadata
                .references
                .iter()
                .any(|r| reference_matches(&r.file_path, out_ref_path));
            if !is_tracked {
                broken_links.push(BrokenLink {
                    source_type: "command".to_string(),
                    source_id: cmd.id.clone(),
                    target_path: out_ref_path.clone(),
                    reason: "Referenced file not found in out-references".to_string(),
                });
            }
        }
    }

    // Find references in packs that don't exist
    for (pack, refs) in &pack_references {
        for out_ref_path in refs {
            let is_tracked = metadata
                .references
                .iter()
                .any(|r| reference_matches(&r.file_path, out_ref_path));
            if !is_tracked {
                broken_links.push(BrokenLink {
                    source_type: "pack".to_string(),
                    source_id: pack.id.clone(),
                    target_path: out_ref_path.clone(),
                    reason: "Referenced file not found in out-references".to_string(),
                });
            }
        }
    }

    // Find unused references (not linked from any command or pack)
    for out_ref in &metadata.references {
        let used_in_commands = commands.iter().any(|cmd| {
            cmd.out_references
                .iter()
                .any(|p| reference_matches(&out_ref.file_path, p))
        });
        let used_in_packs = pack_references.iter().any(|(_, refs)| {
            refs.iter()
                .any(|p| reference_matches(&out_ref.file_path, p))
        });

        if !used_in_commands && !used_in_packs {
            unused_references.push(out_ref.id.clone());
        }
    }

    // Find orphaned files (exist on disk but not in metadata)
    let categories = ["templates", "examples", "schemas"];
    for category in &categories {
        let category_dir = base_dir.join(category);
        if category_dir.exists() {
            if let Ok(entries) = fs::read_dir(&category_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let relative_path = format!(
                            "{}/{}",
                            category,
                            path.file_name().unwrap_or_default().to_string_lossy()
                        );
                        let is_tracked = metadata
                            .references
                            .iter()
                            .any(|r| r.file_path == relative_path);
                        if !is_tracked {
                            orphaned_files.push(relative_path);
                        }
                    }
                }
            }
        }
    }

    let valid = broken_links.is_empty();

    Ok(OutReferenceValidationReport {
        valid,
        broken_links,
        unused_references,
        orphaned_files,
    })
}

/// Find what commands/packs reference a specific out-reference
pub fn find_references_to(id: String) -> Result<Vec<ReferenceLink>, String> {
    let out_ref = get_out_reference(id)?;
    let mut links: Vec<ReferenceLink> = Vec::new();

    // Check commands
    if let Ok(commands) = command_registry::load_commands() {
        for cmd in commands {
            let link_count = cmd
                .out_references
                .iter()
                .filter(|p| reference_matches(&out_ref.file_path, p))
                .count();

            if link_count > 0 {
                links.push(ReferenceLink {
                    link_type: "command".to_string(),
                    id: cmd.id,
                    name: cmd.name,
                    link_count: link_count as u64,
                });
            }
        }
    }

    // Check packs
    if let Ok(pack_refs) = collect_pack_references() {
        for (pack, refs) in pack_refs {
            let link_count = refs
                .iter()
                .filter(|p| reference_matches(&out_ref.file_path, p))
                .count();

            if link_count > 0 {
                links.push(ReferenceLink {
                    link_type: "pack".to_string(),
                    id: pack.id,
                    name: pack.name,
                    link_count: link_count as u64,
                });
            }
        }
    }

    Ok(links)
}

/// Rebuild metadata index from filesystem
pub fn update_metadata_index() -> Result<(), String> {
    let base_dir = get_out_references_dir();
    let mut references: Vec<OutReference> = Vec::new();

    let categories = ["templates", "examples", "schemas"];
    for category in &categories {
        let category_dir = base_dir.join(category);
        if !category_dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&category_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let file_name = path.file_name().unwrap_or_default().to_string_lossy();
                let relative_path = format!("{}/{}", category, file_name);

                // Try to detect format from extension
                let format = detect_format_from_extension(&path);

                // Read content for counts
                let content = fs::read_to_string(&path).unwrap_or_default();
                let character_count = content.len() as u64;
                let word_count = content.split_whitespace().count() as u64;

                let now = Utc::now().to_rfc3339();

                references.push(OutReference {
                    id: Uuid::new_v4().to_string(),
                    name: path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string(),
                    description: String::new(),
                    category: parse_category(category).unwrap_or(OutReferenceCategory::Templates),
                    file_path: relative_path,
                    format,
                    tags: Vec::new(),
                    linked_from: Vec::new(),
                    character_count,
                    word_count,
                    created_at: now.clone(),
                    updated_at: now,
                });
            }
        }
    }

    let metadata = OutReferenceMetadata {
        version: "1.0.0".to_string(),
        references,
    };

    save_metadata(&metadata)?;
    Ok(())
}

/// Export out-references to a JSON bundle
pub fn export_out_references(ids: Vec<String>) -> Result<String, String> {
    let mut exports: Vec<(OutReference, String)> = Vec::new();

    for id in ids {
        let out_ref = get_out_reference(id.clone())?;
        let content = read_out_reference_content(id)?;
        exports.push((out_ref, content));
    }

    serde_json::to_string_pretty(&exports)
        .map_err(|e| format!("Failed to serialize export: {}", e))
}

/// Import out-references from a JSON bundle
pub fn import_out_references(bundle: String) -> Result<Vec<OutReference>, String> {
    let imports: Vec<(OutReference, String)> = serde_json::from_str(&bundle)
        .map_err(|e| format!("Failed to parse import bundle: {}", e))?;

    let mut created: Vec<OutReference> = Vec::new();

    for (mut out_ref, content) in imports {
        // Generate new ID to avoid conflicts
        out_ref.id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        out_ref.created_at = now.clone();
        out_ref.updated_at = now;

        // Write the file
        let full_path = get_out_references_dir().join(&out_ref.file_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
        fs::write(&full_path, &content)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // Update metadata
        let mut metadata = load_metadata()?;
        metadata.references.push(out_ref.clone());
        save_metadata(&metadata)?;

        created.push(out_ref);
    }

    Ok(created)
}

/// Get statistics about out-references
pub fn get_out_reference_stats() -> Result<OutReferenceStats, String> {
    let metadata = load_metadata()?;

    let total_count = metadata.references.len() as u64;
    let mut by_category: HashMap<String, u64> = HashMap::new();
    let mut total_chars: u64 = 0;

    for out_ref in &metadata.references {
        let category = match out_ref.category {
            OutReferenceCategory::Templates => "templates",
            OutReferenceCategory::Examples => "examples",
            OutReferenceCategory::Schemas => "schemas",
        };
        *by_category.entry(category.to_string()).or_default() += 1;
        total_chars += out_ref.character_count;
    }

    // Get validation status
    let validation = validate_out_references()?;
    let broken_link_count = validation.broken_links.len() as u64;
    let unused_count = validation.unused_references.len() as u64;

    Ok(OutReferenceStats {
        total_count,
        templates_count: *by_category.get("templates").unwrap_or(&0),
        examples_count: *by_category.get("examples").unwrap_or(&0),
        schemas_count: *by_category.get("schemas").unwrap_or(&0),
        total_character_count: total_chars,
        broken_link_count,
        unused_count,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutReferenceStats {
    pub total_count: u64,
    pub templates_count: u64,
    pub examples_count: u64,
    pub schemas_count: u64,
    pub total_character_count: u64,
    pub broken_link_count: u64,
    pub unused_count: u64,
}

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_category(category: &str) -> Result<OutReferenceCategory, String> {
    match category.to_lowercase().as_str() {
        "templates" => Ok(OutReferenceCategory::Templates),
        "examples" => Ok(OutReferenceCategory::Examples),
        "schemas" => Ok(OutReferenceCategory::Schemas),
        _ => Err(format!("Invalid category: {}", category)),
    }
}

fn parse_format(format: &str) -> Result<FileFormat, String> {
    match format.to_lowercase().as_str() {
        "markdown" | "md" => Ok(FileFormat::Markdown),
        "json" => Ok(FileFormat::Json),
        "yaml" | "yml" => Ok(FileFormat::Yaml),
        "text" | "txt" => Ok(FileFormat::Text),
        _ => Err(format!("Invalid format: {}", format)),
    }
}

fn generate_file_name(name: &str, format: &FileFormat) -> String {
    let base = name
        .to_lowercase()
        .replace(' ', "-")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect::<String>();

    let extension = match format {
        FileFormat::Markdown => "md",
        FileFormat::Json => "json",
        FileFormat::Yaml => "yaml",
        FileFormat::Text => "txt",
    };

    format!("{}.{}", base, extension)
}

fn detect_format_from_extension(path: &PathBuf) -> FileFormat {
    match path.extension().and_then(|e| e.to_str()) {
        Some("md") | Some("markdown") => FileFormat::Markdown,
        Some("json") => FileFormat::Json,
        Some("yaml") | Some("yml") => FileFormat::Yaml,
        _ => FileFormat::Text,
    }
}
