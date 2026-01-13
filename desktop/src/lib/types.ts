// Re-export types from core modules
export type { AgentDefinition } from '@core/agent-registry';
export type {
  RulePack,
  LoadedPack,
  PackValidationResult,
  DependencyResolution,
} from '@core/rule-pack-types';
export type {
  BudgetInfo,
  ValidationResult,
  GenerateResult,
  GenerateOptions,
  CompositionConfig,
} from '@core/pack-composer-types';

// ============================================================================
// Deployment Types
// ============================================================================

/** Target level for deployment */
export type TargetLevel = 'user' | 'project';

/** Configuration for a deployment operation */
export interface DeploymentConfig {
  /** The target agent ID */
  agentId: string;
  /** IDs of rule packs to include */
  packIds: string[];
  /** IDs of custom commands to include */
  customCommandIds: string[];
  /** Whether to deploy at user level or project level */
  targetLevel: TargetLevel;
  /** Force overwrite existing files */
  forceOverwrite: boolean;
  /** Project path for project-level deployments */
  projectPath?: string;
}

/** Result of a successful deployment */
export interface DeploymentOutput {
  /** Whether the deployment succeeded */
  success: boolean;
  /** The method used for deployment (symlink, copy, etc.) */
  method: string;
  /** Any warnings generated during deployment */
  warnings: string[];
  /** Any errors that occurred */
  errors: string[];
  /** List of files that were deployed */
  deployedFiles: string[];
  /** Manual steps required (if any) */
  manualSteps: string[];
}

/** Prepared deployment artifacts */
export interface PreparedDeployment {
  /** The generated AGENTS.md content */
  agentsMdContent: string;
  /** Command files to deploy (path -> content) */
  commands: Record<string, string>;
  /** Config files to create/update (path -> content) */
  configFiles: Record<string, string>;
  /** Target paths for each file */
  targetPaths: string[];
  /** Character count of the deployment */
  characterCount: number;
  /** Format used for commands */
  commandFormat: string;
}

/** Budget usage information */
export interface BudgetUsage {
  /** Current character count */
  currentChars: number;
  /** Maximum allowed characters (if any) */
  maxChars?: number;
  /** Percentage of budget used */
  percentage?: number;
  /** Whether within the limit */
  withinLimit: boolean;
}

/** Validation report */
export interface ValidationReport {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Budget usage information */
  budgetUsage: BudgetUsage;
}

/** Status of an agent's deployment */
export type AgentStatus = 'notInstalled' | 'installed' | 'configured' | 'outdated';

/** State of a deployment for history/rollback */
export interface DeploymentState {
  /** The agent that was deployed to */
  agentId: string;
  /** When the deployment occurred (ISO timestamp) */
  timestamp: string;
  /** Rule packs that were deployed */
  deployedPacks: string[];
  /** Custom commands that were deployed */
  deployedCommands: string[];
  /** Files that were created during deployment */
  filesCreated: string[];
  /** Path to backup directory (if any) */
  backupPath?: string;
  /** The deployment method used */
  method: string;
  /** Whether this was a user-level or project-level deployment */
  targetLevel: string;
  /** Project path (for project-level deployments) */
  projectPath?: string;
}
