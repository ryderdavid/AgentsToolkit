import { getAllAgents, getAgentById } from '@core/agent-registry';
import type { AgentDefinition } from '@core/agent-registry';

// Re-export for use in components
export { getAllAgents, getAgentById };
export type { AgentDefinition };

// Add UI-specific helpers
export function getAgentIcon(agentId: string): string {
  const icons: Record<string, string> = {
    cursor: '⚡',
    claude: '🤖',
    copilot: '🚁',
    warp: '🌀',
    kilocode: '🔧',
    opencode: '📝',
    roocode: '🎯',
    cline: '📋',
    antigravity: '🚀',
    codex: '💻',
    gemini: '✨',
    aider: '🛠️',
  };
  return icons[agentId] || '🔧';
}
