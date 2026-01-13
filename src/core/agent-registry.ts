import Ajv, {ErrorObject} from "ajv";
import schema from "../../schemas/agent-definition.schema.json";

export type AgentDefinition = {
  id: string;
  name: string;
  configPaths: string[];
  agentsMdSupport: "native" | "config" | "manual" | "none";
  commandFormat: "slash" | "prompts-prefix" | "cli" | "workflow" | "inline";
  characterLimits: {
    maxChars: number | null;
    supportsOutReferences: boolean;
  };
  deploymentStrategy: "symlink" | "copy" | "inline" | "api";
  buildOutput: string;
  fileFormat: "markdown" | "toml" | "yaml" | "json";
  requiresFrontmatter?: boolean;
  sandboxScriptPath?: string | null;
  notes?: string | null;
};

const ajv = new Ajv({allErrors: true});
const validate = ajv.compile<AgentDefinition>(schema as Record<string, unknown>);

const AGENTS: AgentDefinition[] = [
  {
    id: "cursor",
    name: "Cursor",
    configPaths: ["~/.cursor/commands"],
    agentsMdSupport: "native",
    commandFormat: "slash",
    characterLimits: {maxChars: 1_000_000, supportsOutReferences: true},
    deploymentStrategy: "symlink",
    buildOutput: "cursor/commands",
    fileFormat: "markdown",
    requiresFrontmatter: false,
    notes: "Commands are Markdown files; AGENTS.md via User Rule."
  },
  {
    id: "claude",
    name: "Claude Code",
    configPaths: ["~/.claude/commands"],
    agentsMdSupport: "config",
    commandFormat: "slash",
    characterLimits: {maxChars: 200_000, supportsOutReferences: true},
    deploymentStrategy: "symlink",
    buildOutput: "claude/commands",
    fileFormat: "markdown",
    requiresFrontmatter: true,
    notes: "Requires YAML frontmatter in command files."
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    configPaths: [".github/copilot-instructions.md"],
    agentsMdSupport: "native",
    commandFormat: "inline",
    characterLimits: {maxChars: 8_000, supportsOutReferences: false},
    deploymentStrategy: "inline",
    buildOutput: "copilot/instructions",
    fileFormat: "markdown",
    requiresFrontmatter: false,
    notes: "Instructions live in-repo; no global command execution."
  },
  {
    id: "warp",
    name: "Warp",
    configPaths: ["~/.warp/workflows"],
    agentsMdSupport: "manual",
    commandFormat: "workflow",
    characterLimits: {maxChars: null, supportsOutReferences: false},
    deploymentStrategy: "symlink",
    buildOutput: "warp/workflows",
    fileFormat: "yaml",
    requiresFrontmatter: false,
    notes: "Workflow files; manual AGENTS.md inclusion."
  },
  {
    id: "kilocode",
    name: "Kilocode",
    configPaths: ["~/.kilocode/commands"],
    agentsMdSupport: "manual",
    commandFormat: "slash",
    characterLimits: {maxChars: null, supportsOutReferences: false},
    deploymentStrategy: "copy",
    buildOutput: "kilocode/commands",
    fileFormat: "markdown",
    requiresFrontmatter: false,
    notes: "Placeholder paths; update when official locations are published."
  },
  {
    id: "opencode",
    name: "Opencode",
    configPaths: ["~/.opencode/commands"],
    agentsMdSupport: "manual",
    commandFormat: "slash",
    characterLimits: {maxChars: null, supportsOutReferences: false},
    deploymentStrategy: "copy",
    buildOutput: "opencode/commands",
    fileFormat: "markdown",
    requiresFrontmatter: false,
    notes: "Placeholder paths; update when official locations are published."
  },
  {
    id: "roocode",
    name: "Roocode",
    configPaths: ["~/.roocode/commands"],
    agentsMdSupport: "manual",
    commandFormat: "slash",
    characterLimits: {maxChars: null, supportsOutReferences: false},
    deploymentStrategy: "copy",
    buildOutput: "roocode/commands",
    fileFormat: "markdown",
    requiresFrontmatter: false,
    notes: "Placeholder paths; update when official locations are published."
  },
  {
    id: "cline",
    name: "Cline",
    configPaths: [".cline/config.json"],
    agentsMdSupport: "config",
    commandFormat: "slash",
    characterLimits: {maxChars: null, supportsOutReferences: true},
    deploymentStrategy: "copy",
    buildOutput: "cline/commands",
    fileFormat: "json",
    requiresFrontmatter: false,
    notes: "Per-project config; supports command definitions in JSON."
  },
  {
    id: "antigravity",
    name: "Antigravity",
    configPaths: ["~/.gemini/antigravity/global_workflows"],
    agentsMdSupport: "config",
    commandFormat: "workflow",
    characterLimits: {maxChars: 1_000_000, supportsOutReferences: true},
    deploymentStrategy: "symlink",
    buildOutput: "antigravity/global_workflows",
    fileFormat: "markdown",
    requiresFrontmatter: true,
    sandboxScriptPath: "~/.gemini/scripts",
    notes: "Shares outputs with Gemini sandbox; frontmatter required."
  },
  {
    id: "codex",
    name: "Codex CLI",
    configPaths: ["~/.codex/prompts"],
    agentsMdSupport: "manual",
    commandFormat: "prompts-prefix",
    characterLimits: {maxChars: null, supportsOutReferences: false},
    deploymentStrategy: "symlink",
    buildOutput: "codex/prompts",
    fileFormat: "markdown",
    requiresFrontmatter: true,
    notes: "Commands invoked as /prompts:<name>."
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    configPaths: ["~/.gemini/commands"],
    agentsMdSupport: "config",
    commandFormat: "slash",
    characterLimits: {maxChars: 1_000_000, supportsOutReferences: true},
    deploymentStrategy: "symlink",
    buildOutput: "gemini/commands",
    fileFormat: "toml",
    requiresFrontmatter: false,
    sandboxScriptPath: "~/.gemini/scripts",
    notes: "Uses TOML format for commands; sandbox-safe script path."
  },
  {
    id: "aider",
    name: "Aider",
    configPaths: ["~/.aider.conf.yml"],
    agentsMdSupport: "manual",
    commandFormat: "cli",
    characterLimits: {maxChars: null, supportsOutReferences: true},
    deploymentStrategy: "inline",
    buildOutput: "aider/config",
    fileFormat: "yaml",
    requiresFrontmatter: false,
    notes: "CLI-driven; AGENTS.md should be referenced in prompts/config."
  }
];

function formatError(err: ErrorObject): string {
  const location = err.instancePath || "/";
  const message = err.message ?? "validation error";
  return `${location} ${message}`.trim();
}

function ensureValidAgents(): void {
  const agentList: AgentDefinition[] = AGENTS;
  for (const agent of agentList) {
    const agentId = agent.id;
    if (!validate(agent)) {
      const errors = (validate.errors || []).map(formatError).join("; ");
      throw new Error(`Invalid agent definition for ${agentId}: ${errors}`);
    }
  }
}

export function getAllAgents(): AgentDefinition[] {
  ensureValidAgents();
  return [...AGENTS];
}

export function getAgentById(id: string): AgentDefinition | undefined {
  ensureValidAgents();
  return AGENTS.find((agent) => agent.id === id);
}

export function validateAgent(agent: AgentDefinition): void {
  const agentId = agent.id;
  if (!validate(agent)) {
    const errors = (validate.errors || []).map(formatError).join("; ");
    throw new Error(`Invalid agent definition: ${errors} (${agentId})`);
  }
}

export function exportForPython(): string {
  ensureValidAgents();
  return JSON.stringify(AGENTS, null, 2);
}

if (require.main === module) {
  try {
    const shouldExport = process.argv.includes("--export-json");
    if (shouldExport) {
      process.stdout.write(exportForPython());
    } else {
      console.log(getAllAgents());
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
