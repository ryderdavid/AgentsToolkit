/**
 * Pack Composer Type Definitions
 * 
 * Types for composing multiple rule packs together.
 */

/**
 * Budget information for agent character limits
 */
export interface BudgetInfo {
  /** Total characters in composed content */
  totalChars: number;
  /** Maximum characters allowed by agent (null if unlimited) */
  maxChars: number | null;
  /** Percentage of limit used (null if unlimited) */
  percentage: number | null;
  /** Whether composition fits within agent limit */
  withinLimit: boolean;
  /** Breakdown by pack */
  packBreakdown: PackBudgetItem[];
}

/**
 * Budget breakdown for a single pack
 */
export interface PackBudgetItem {
  /** Pack ID */
  packId: string;
  /** Character count for this pack */
  chars: number;
  /** Word count for this pack */
  words: number;
  /** Percentage of total */
  percentageOfTotal: number;
}

/**
 * Result of composition validation
 */
export interface ValidationResult {
  /** Whether composition is valid */
  valid: boolean;
  /** List of error messages */
  errors: string[];
  /** List of warning messages */
  warnings: string[];
}

/**
 * Options for generating AGENTS.md
 */
export interface GenerateOptions {
  /** Pack IDs to include */
  packIds: string[];
  /** Output file path */
  outputPath: string;
  /** Whether to include pack metadata comments */
  includeMetadata?: boolean;
  /** Whether to use inline content vs imports */
  inlineContent?: boolean;
  /** Header template override */
  headerTemplate?: string;
}

/**
 * Result of AGENTS.md generation
 */
export interface GenerateResult {
  /** Whether generation succeeded */
  success: boolean;
  /** Generated content */
  content: string;
  /** Output file path */
  outputPath: string;
  /** Budget info for the generated content */
  budget: BudgetInfo;
  /** Error message if failed */
  error?: string;
}

/**
 * Composition configuration
 */
export interface CompositionConfig {
  /** Active pack IDs */
  packs: string[];
  /** Target agent ID for budget calculation */
  targetAgent?: string;
  /** Custom header content */
  header?: string;
  /** Custom footer content */
  footer?: string;
}
