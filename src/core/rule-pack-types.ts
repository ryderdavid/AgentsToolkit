/**
 * Rule Pack Type Definitions
 * 
 * Types for the modular rule pack system.
 */

/**
 * Category of rule pack
 */
export type PackCategory = "workflow" | "vcs" | "universal";

/**
 * Metadata about a rule pack
 */
export interface PackMetadata {
  /** Approximate word count */
  wordCount: number;
  /** Approximate character count */
  characterCount: number;
  /** Pack category */
  category: PackCategory;
  /** Searchable tags */
  tags: string[];
}

/**
 * Rule pack definition as stored in pack.json
 */
export interface RulePack {
  /** Unique identifier in kebab-case */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Purpose and scope of the pack */
  description: string;
  /** Array of pack IDs this pack requires */
  dependencies: string[];
  /** Array of agent IDs or ['*'] for all agents */
  targetAgents: string[];
  /** Array of markdown files in load order */
  files: string[];
  /** Optional out-reference links associated with this pack */
  outReferences?: string[];
  /** Pack metadata */
  metadata: PackMetadata;
}

/**
 * Loaded pack with resolved content
 */
export interface LoadedPack extends RulePack {
  /** Full path to pack directory */
  path: string;
  /** Concatenated markdown content */
  content: string;
  /** Actual calculated word count */
  actualWordCount: number;
  /** Actual calculated character count */
  actualCharacterCount: number;
}

/**
 * Validation error for a pack
 */
export interface PackValidationError {
  /** Pack ID that has the error */
  packId: string;
  /** Error message */
  message: string;
  /** Severity level */
  severity: "error" | "warning";
  /** File path if error is file-specific */
  file?: string;
}

/**
 * Result of pack validation
 */
export interface PackValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of errors found */
  errors: PackValidationError[];
  /** List of warnings found */
  warnings: PackValidationError[];
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  /** Ordered list of pack IDs to load */
  order: string[];
  /** Whether resolution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Circular dependency path if detected */
  circularPath?: string[];
}
