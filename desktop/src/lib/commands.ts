import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Command Types
// ============================================================================

/** Command definition metadata */
export interface CommandMetadata {
  /** Unique command identifier (kebab-case) */
  id: string;
  /** Human-readable command name */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** Path to the Python script that executes this command */
  scriptPath: string;
  /** Array of agent IDs this command is compatible with (empty = all agents) */
  agentCompatibility: string[];
  /** Whether this command requires GitHub CLI authentication */
  requiresGitHub: boolean;
  /** Array of file paths referenced by this command */
  outReferences: string[];
  /** Command category */
  category: 'workflow' | 'git' | 'documentation' | 'utility';
  /** Optional template content for commands that generate files */
  template?: string;
  /** Character count of the command markdown content */
  characterCount: number;
  /** Word count of the command markdown content */
  wordCount: number;
  /** Path to the source markdown file */
  sourcePath: string;
}

/** Result of command compatibility validation */
export interface CommandCompatibilityResult {
  compatible: boolean;
  reason?: string;
}

/** Budget info for commands */
export interface CommandBudgetItem {
  commandId: string;
  chars: number;
  words: number;
}

export interface CommandBudgetInfo {
  totalChars: number;
  commandBreakdown: CommandBudgetItem[];
}

/** Command validation error */
export interface CommandValidationError {
  commandId: string;
  message: string;
  severity: 'error' | 'warning';
  file?: string;
}

/** Command validation result */
export interface CommandValidationResult {
  valid: boolean;
  errors: CommandValidationError[];
  warnings: CommandValidationError[];
}

// ============================================================================
// Command API
// ============================================================================

export const commandApi = {
  /** List all available commands */
  listAvailableCommands: () => 
    invoke<CommandMetadata[]>('list_available_commands'),
  
  /** Get a command by its ID */
  getCommandById: (commandId: string) => 
    invoke<CommandMetadata>('get_command_by_id', { commandId }),
  
  /** Get commands compatible with a specific agent */
  getCommandsForAgent: (agentId: string) => 
    invoke<CommandMetadata[]>('get_commands_for_agent', { agentId }),
  
  /** Get commands by category */
  getCommandsByCategory: (category: string) => 
    invoke<CommandMetadata[]>('get_commands_by_category', { category }),
  
  /** Load raw command content (markdown) */
  loadCommandContent: (commandId: string) => 
    invoke<string>('load_command_content', { commandId }),

  /** Update out-references linked to a command */
  updateOutReferences: (commandId: string, references: string[]) =>
    invoke<CommandMetadata>('update_command_out_references', { commandId, references }),
  
  /** Validate command compatibility with a specific agent */
  validateCommandForAgent: (commandId: string, agentId: string) => 
    invoke<CommandCompatibilityResult>('validate_command_for_agent', { commandId, agentId }),
  
  /** Calculate budget for a set of commands */
  calculateCommandBudget: (commandIds: string[]) => 
    invoke<CommandBudgetInfo>('calculate_command_budget', { commandIds }),
  
  /** Refresh commands cache (after file changes) */
  refreshCommands: () => 
    invoke<void>('refresh_commands'),
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get category display label */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    workflow: 'Workflow',
    git: 'Git',
    documentation: 'Documentation',
    utility: 'Utility',
  };
  return labels[category] ?? category;
}

/** Get category color classes */
export function getCategoryColorClass(category: string): string {
  const colors: Record<string, string> = {
    workflow: 'bg-blue-100 text-blue-700',
    git: 'bg-green-100 text-green-700',
    documentation: 'bg-purple-100 text-purple-700',
    utility: 'bg-orange-100 text-orange-700',
  };
  return colors[category] ?? 'bg-slate-100 text-slate-700';
}

/** Format character count for display */
export function formatCharCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
