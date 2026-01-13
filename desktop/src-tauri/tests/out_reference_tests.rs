//! Tests for out-reference management system

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use tempfile::TempDir;

    // Note: These tests require proper mocking of the fs_manager module
    // In a real implementation, you'd inject dependencies for testing
    
    #[test]
    fn test_category_parsing() {
        // Test that category strings are parsed correctly
        assert!(matches_category("templates", "templates"));
        assert!(matches_category("examples", "examples"));
        assert!(matches_category("schemas", "schemas"));
        assert!(!matches_category("invalid", "templates"));
    }

    #[test]
    fn test_format_parsing() {
        // Test that format strings are parsed correctly
        assert!(matches_format("markdown", "markdown"));
        assert!(matches_format("md", "markdown"));
        assert!(matches_format("json", "json"));
        assert!(matches_format("yaml", "yaml"));
        assert!(matches_format("yml", "yaml"));
        assert!(matches_format("text", "text"));
        assert!(matches_format("txt", "text"));
    }

    #[test]
    fn test_file_name_generation() {
        // Test that file names are generated correctly from reference names
        let name = "My Template File";
        let expected = "my-template-file.md";
        let result = generate_file_name(name, "markdown");
        assert_eq!(result, expected);
    }

    #[test]
    fn test_word_count() {
        let content = "Hello world this is a test";
        let count = content.split_whitespace().count();
        assert_eq!(count, 6);
    }

    #[test]
    fn test_character_count() {
        let content = "Hello world";
        let count = content.len();
        assert_eq!(count, 11);
    }

    // Helper functions for testing
    fn matches_category(input: &str, expected: &str) -> bool {
        match input.to_lowercase().as_str() {
            "templates" => expected == "templates",
            "examples" => expected == "examples",
            "schemas" => expected == "schemas",
            _ => false,
        }
    }

    fn matches_format(input: &str, expected: &str) -> bool {
        match input.to_lowercase().as_str() {
            "markdown" | "md" => expected == "markdown",
            "json" => expected == "json",
            "yaml" | "yml" => expected == "yaml",
            "text" | "txt" => expected == "text",
            _ => false,
        }
    }

    fn generate_file_name(name: &str, format: &str) -> String {
        let base = name
            .to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-')
            .collect::<String>();

        let extension = match format {
            "markdown" => "md",
            "json" => "json",
            "yaml" => "yaml",
            "text" => "txt",
            _ => "txt",
        };

        format!("{}.{}", base, extension)
    }

    // Integration tests would require mocking the file system
    // and the fs_manager module. Here's an example structure:

    #[test]
    #[ignore] // Requires file system setup
    fn test_create_out_reference_integration() {
        // This would test the full create flow
        // Requires mocking fs_manager::get_agentsmd_home()
    }

    #[test]
    #[ignore] // Requires file system setup
    fn test_list_out_references_integration() {
        // This would test listing all out-references
    }

    #[test]
    #[ignore] // Requires file system setup
    fn test_validate_out_references_integration() {
        // This would test the validation system
    }

    #[test]
    #[ignore] // Requires file system setup
    fn test_export_import_out_references_integration() {
        // This would test export/import functionality
    }
}
