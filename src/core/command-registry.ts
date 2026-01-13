/**
 * Command Registry
 *
 * Utilities for loading, validating, and managing custom commands.
 * Commands are markdown files in commands/src/ that define agent instructions.
 */

import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ErrorObject } from 'ajv';
import commandSchema from '../../schemas/command-definition.schema.json';
import { getAllAgents, getAgentById, type AgentDefinition } from './agent-registry';

/** Default commands source directory relative to project root */
const DEFAULT_COMMANDS_DIR = 'commands/src';

/** AJV instance for schema validation */
const ajv = new Ajv({ allErrors: true });
const validateCommandSchemaFn = ajv.compile<CommandDefinition>(commandSchema as Record<string, unknown>);

/**
 * Command definition interface matching the JSON schema
 */
export interface CommandDefinition {
  id: string;
  name: string;
  description: string;
  scriptPath: string;
  agentCompatibility: string[];
  requiresGitHub: boolean;
  outReferences: string[];
  category: 'workflow' | 'git' | 'documentation' | 'utility';
  template?: string;
  characterCount: number;
  wordCount: number;
  sourcePath: string;
}

/**
 * Validation result for command operations
 */
export interface CommandValidationResult {
  valid: boolean;
  errors: CommandValidationError[];
  warnings: CommandValidationError[];
}

/**
 * Individual validation error
 */
export interface CommandValidationError {
  commandId: string;
  message: string;
  severity: 'error' | 'warning';
  file?: string;
}

/**
 * Format AJV validation error for display
 */
function formatSchemaError(err: ErrorObject): string {
  const location = err.instancePath || '/';
  const message = err.message ?? 'validation error';
  return `${location} ${message}`.trim();
}

/**
 * Get the commands directory path
 */
export function getCommandsDirectory(baseDir?: string): string {
  const base = baseDir || process.env.AGENTSMD_HOME || process.cwd();
  return path.join(base, DEFAULT_COMMANDS_DIR);
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Convert filename to command ID (kebab-case)
 */
function filenameToId(filename: string): string {
  return path.basename(filename, '.md');
}

/**
 * Convert command ID to display name (Title Case)
 */
function idToName(id: string): string {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract script path from command markdown content
 * Looks for patterns like: python3 ~/.agentsmd/scripts/script_name.py
 */
function extractScriptPath(content: string): string {
  const patterns = [
    /python3?\s+~\/\.agentsmd\/scripts\/(\w+\.py)/,
    /Run:\s*`python3?\s+~\/\.agentsmd\/scripts\/(\w+\.py)`/,
    /`python3?\s+~\/\.agentsmd\/scripts\/(\w+\.py)`/
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return `~/.agentsmd/scripts/${match[1]}`;
    }
  }

  return '';
}

/**
 * Extract out-references from command markdown content
 * Finds markdown links to rule-packs/, docs/, templates/, etc.
 */
function extractOutReferences(content: string): string[] {
  const references: string[] = [];
  
  // Match markdown links: [text](path)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const linkPath = match[2];
    // Filter for relevant paths (rule-packs, docs, templates)
    if (
      linkPath.includes('rule-packs/') ||
      linkPath.includes('docs/') ||
      linkPath.includes('templates/')
    ) {
      // Normalize path (remove relative prefixes)
      const normalized = linkPath.replace(/^\.\.\/+/, '').replace(/^\.\//, '');
      if (!references.includes(normalized)) {
        references.push(normalized);
      }
    }
  }

  return references;
}

/**
 * Determine command category based on content and purpose
 */
function determineCategory(id: string, content: string): 'workflow' | 'git' | 'documentation' | 'utility' {
  const lowerContent = content.toLowerCase();
  const lowerId = id.toLowerCase();

  // Workflow commands (issue, pr, branch creation)
  if (
    lowerId.includes('issue') ||
    lowerId.includes('pr') ||
    lowerId.includes('branch') ||
    lowerContent.includes('github issue') ||
    lowerContent.includes('pull request')
  ) {
    return 'workflow';
  }

  // Git commands (status, push, check operations)
  if (
    lowerId.includes('status') ||
    lowerId.includes('push') ||
    lowerId.includes('check') ||
    lowerId.includes('protect') ||
    lowerContent.includes('git status') ||
    lowerContent.includes('workflow status')
  ) {
    return 'git';
  }

  // Documentation commands (walkthrough, docs)
  if (
    lowerId.includes('walkthrough') ||
    lowerId.includes('doc') ||
    lowerContent.includes('documentation') ||
    lowerContent.includes('walkthrough document')
  ) {
    return 'documentation';
  }

  // Default to utility
  return 'utility';
}

/**
 * Check if command requires GitHub authentication
 */
function requiresGitHub(content: string): boolean {
  const indicators = [
    'gh issue',
    'gh pr',
    'GitHub issue',
    'GitHub CLI',
    'github.com',
    'check_auth.py',
    'Creates GitHub issue'
  ];

  return indicators.some(indicator => content.includes(indicator));
}

/**
 * Determine agent compatibility based on command characteristics
 * Returns array of agent IDs, empty array means all agents
 */
function determineAgentCompatibility(content: string, category: string): string[] {
  // All agents support workflow commands by default
  // CLI-specific commands might only work with certain agents
  
  const agents = getAllAgents();
  const compatible: string[] = [];

  // Check for CLI-only patterns
  const isCLIOnly = content.includes('--cli') || content.includes('command line only');
  
  if (isCLIOnly) {
    // Only agents with CLI command format
    for (const agent of agents) {
      if (agent.commandFormat === 'cli') {
        compatible.push(agent.id);
      }
    }
    return compatible;
  }

  // All agents are compatible by default
  return [];
}

/**
 * Extract template section from command content (if present)
 * Templates are typically in fenced code blocks or after "Template:" headings
 */
function extractTemplate(content: string): string | undefined {
  // Look for template section
  const templateMatch = content.match(/\*\*(?:Walkthrough\s+)?Template:\*\*\s*([\s\S]*?)(?=\n\*\*|\n##|$)/i);
  if (templateMatch) {
    return templateMatch[1].trim();
  }

  // Look for template in code block
  const codeBlockMatch = content.match(/```(?:markdown)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1].includes('##')) {
    return codeBlockMatch[1].trim();
  }

  return undefined;
}

/**
 * Load a command definition from a markdown file
 */
export function loadCommandFromMarkdown(filePath: string): CommandDefinition {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Command file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const id = filenameToId(filePath);
  const name = idToName(id);
  
  // First line is the description
  const lines = content.split('\n');
  const description = lines[0].trim();

  const scriptPath = extractScriptPath(content);
  const outReferences = extractOutReferences(content);
  const category = determineCategory(id, content);
  const template = extractTemplate(content);
  const agentCompatibility = determineAgentCompatibility(content, category);

  const command: CommandDefinition = {
    id,
    name,
    description,
    scriptPath,
    agentCompatibility,
    requiresGitHub: requiresGitHub(content),
    outReferences,
    category,
    characterCount: content.length,
    wordCount: countWords(content),
    sourcePath: filePath
  };

  if (template) {
    command.template = template;
  }

  return command;
}

/**
 * Get all commands from the commands directory
 */
export function getAllCommands(baseDir?: string): CommandDefinition[] {
  const commandsDir = getCommandsDirectory(baseDir);

  if (!fs.existsSync(commandsDir)) {
    return [];
  }

  const commands: CommandDefinition[] = [];
  const entries = fs.readdirSync(commandsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const filePath = path.join(commandsDir, entry.name);
      try {
        const command = loadCommandFromMarkdown(filePath);
        commands.push(command);
      } catch (error) {
        // Skip invalid command files
        console.warn(`Skipping invalid command file: ${entry.name}`, error);
      }
    }
  }

  return commands;
}

/**
 * Get a command by its ID
 */
export function getCommandById(id: string, baseDir?: string): CommandDefinition | undefined {
  const commandsDir = getCommandsDirectory(baseDir);
  const filePath = path.join(commandsDir, `${id}.md`);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    return loadCommandFromMarkdown(filePath);
  } catch {
    return undefined;
  }
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(
  category: 'workflow' | 'git' | 'documentation' | 'utility',
  baseDir?: string
): CommandDefinition[] {
  return getAllCommands(baseDir).filter(cmd => cmd.category === category);
}

/**
 * Get commands compatible with a specific agent
 * If command.agentCompatibility is empty, it's compatible with all agents
 */
export function getCommandsForAgent(agentId: string, baseDir?: string): CommandDefinition[] {
  const agent = getAgentById(agentId);
  if (!agent) {
    return [];
  }

  return getAllCommands(baseDir).filter(cmd => {
    // Empty agentCompatibility means all agents
    if (cmd.agentCompatibility.length === 0) {
      return true;
    }
    return cmd.agentCompatibility.includes(agentId);
  });
}

/**
 * Read raw command content
 */
export function getCommandContent(id: string, baseDir?: string): string | undefined {
  const commandsDir = getCommandsDirectory(baseDir);
  const filePath = path.join(commandsDir, `${id}.md`);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Validate a command definition against the schema
 */
export function validateCommand(command: CommandDefinition): CommandValidationResult {
  const errors: CommandValidationError[] = [];
  const warnings: CommandValidationError[] = [];

  // Schema validation
  const isValid = validateCommandSchemaFn(command);
  if (!isValid && validateCommandSchemaFn.errors) {
    for (const err of validateCommandSchemaFn.errors) {
      errors.push({
        commandId: command.id,
        message: `Schema violation: ${formatSchemaError(err)}`,
        severity: 'error'
      });
    }
  }

  // Check if script path is set
  if (!command.scriptPath) {
    warnings.push({
      commandId: command.id,
      message: 'No script path detected in command content',
      severity: 'warning'
    });
  }

  // Check out-references exist
  for (const ref of command.outReferences) {
    const baseDir = path.dirname(command.sourcePath);
    // Try to resolve relative path from command source
    let refPath = ref;
    if (ref.startsWith('rule-packs/') || ref.startsWith('docs/')) {
      // These are relative to project root
      refPath = path.join(process.cwd(), ref);
    }
    
    if (!fs.existsSync(refPath) && !fs.existsSync(path.join(baseDir, '..', '..', ref))) {
      warnings.push({
        commandId: command.id,
        message: `Out-reference not found: ${ref}`,
        severity: 'warning',
        file: ref
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate command compatibility with a specific agent
 */
export function validateCommandForAgent(
  commandId: string,
  agentId: string,
  baseDir?: string
): { compatible: boolean; reason?: string } {
  const command = getCommandById(commandId, baseDir);
  if (!command) {
    return { compatible: false, reason: `Command not found: ${commandId}` };
  }

  const agent = getAgentById(agentId);
  if (!agent) {
    return { compatible: false, reason: `Agent not found: ${agentId}` };
  }

  // Check explicit compatibility list
  if (command.agentCompatibility.length > 0 && !command.agentCompatibility.includes(agentId)) {
    return {
      compatible: false,
      reason: `Command ${commandId} is not compatible with agent ${agentId}`
    };
  }

  // Check if agent supports out-references when command has them
  if (command.outReferences.length > 0 && !agent.characterLimits.supportsOutReferences) {
    return {
      compatible: false,
      reason: `Agent ${agentId} does not support out-references required by ${commandId}`
    };
  }

  // Check character limits
  if (agent.characterLimits.maxChars !== null && command.characterCount > agent.characterLimits.maxChars) {
    return {
      compatible: false,
      reason: `Command ${commandId} exceeds character limit for ${agentId} (${command.characterCount} > ${agent.characterLimits.maxChars})`
    };
  }

  return { compatible: true };
}

/**
 * Export commands as JSON (for Rust/Python consumption)
 */
export function exportForPython(): string {
  const commands = getAllCommands();
  return JSON.stringify(commands, null, 2);
}

/**
 * Check if a command exists
 */
export function commandExists(id: string, baseDir?: string): boolean {
  const commandsDir = getCommandsDirectory(baseDir);
  const filePath = path.join(commandsDir, `${id}.md`);
  return fs.existsSync(filePath);
}

// CLI entry point
if (require.main === module) {
  try {
    const shouldExport = process.argv.includes('--export-json');
    const listOnly = process.argv.includes('--list');
    
    if (shouldExport) {
      process.stdout.write(exportForPython());
    } else if (listOnly) {
      const commands = getAllCommands();
      for (const cmd of commands) {
        console.log(`${cmd.id}: ${cmd.description} [${cmd.category}]`);
      }
    } else {
      console.log(JSON.stringify(getAllCommands(), null, 2));
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
