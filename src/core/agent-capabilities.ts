import {getAgentById} from "./agent-registry";

export type CommandFormat = "slash" | "prompts-prefix" | "cli" | "workflow" | "inline";

const PER_PROJECT_AGENTS = new Set<string>(["copilot", "cline", "aider"]);

function requireAgent(agentId: string) {
  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  return agent;
}

export function supportsOutReferences(agentId: string): boolean {
  const agent = requireAgent(agentId);
  return agent.characterLimits.supportsOutReferences;
}

export function getMaxCharacters(agentId: string): number | null {
  const agent = requireAgent(agentId);
  return agent.characterLimits.maxChars;
}

export function getCommandFormat(agentId: string): CommandFormat {
  const agent = requireAgent(agentId);
  return agent.commandFormat;
}

export function requiresPerProjectSetup(agentId: string): boolean {
  return PER_PROJECT_AGENTS.has(agentId);
}

export function getSandboxRestrictions(agentId: string): string | null {
  const agent = requireAgent(agentId);
  return agent.sandboxScriptPath || null;
}
