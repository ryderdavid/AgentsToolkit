import type { AgentDefinition, AgentStatus } from '@/lib/types';

// Warning severity levels
export type WarningSeverity = 'info' | 'warning' | 'critical';

// Warning structure
export interface AgentWarning {
  id: string;
  severity: WarningSeverity;
  message: string;
  detail?: string;
  learnMoreUrl?: string;
  autoDismissable?: boolean;
}

/**
 * Generate warnings based on agent definition and status
 */
export function getAgentWarnings(
  agent: AgentDefinition,
  status: AgentStatus,
  budgetPercentage?: number
): AgentWarning[] {
  const warnings: AgentWarning[] = [];

  // AGENTS.md support method warnings
  const agentsMdSupport = agent.agentsMdSupport;
  
  if (agentsMdSupport === 'config') {
    warnings.push({
      id: `${agent.id}-config-support`,
      severity: 'info',
      message: 'Uses config file for AGENTS.md',
      detail: 'This agent reads AGENTS.md content from its config file. Ensure the config file is properly formatted.',
      autoDismissable: true,
    });
  } else if (agentsMdSupport === 'manual') {
    warnings.push({
      id: `${agent.id}-manual-support`,
      severity: 'warning',
      message: 'Requires manual AGENTS.md inclusion',
      detail: 'This agent requires manual inclusion of AGENTS.md content. Follow the deployment instructions carefully.',
      learnMoreUrl: '/docs/manual-agents-md',
    });
  } else if (agentsMdSupport === 'none') {
    warnings.push({
      id: `${agent.id}-no-support`,
      severity: 'critical',
      message: 'Does not support AGENTS.md',
      detail: 'This agent does not support AGENTS.md files natively. Rules must be included directly in prompts or through other configuration methods.',
    });
  }

  // Character budget warnings
  if (budgetPercentage !== undefined) {
    if (budgetPercentage >= 95) {
      warnings.push({
        id: `${agent.id}-budget-critical`,
        severity: 'critical',
        message: 'Character budget nearly exceeded',
        detail: `Current configuration uses ${budgetPercentage.toFixed(1)}% of the character limit. Consider removing some packs.`,
      });
    } else if (budgetPercentage >= 80) {
      warnings.push({
        id: `${agent.id}-budget-warning`,
        severity: 'warning',
        message: 'Character budget usage high',
        detail: `Current configuration uses ${budgetPercentage.toFixed(1)}% of the character limit.`,
        autoDismissable: true,
      });
    }
  }

  // Frontmatter requirement warning
  if (agent.requiresFrontmatter) {
    warnings.push({
      id: `${agent.id}-frontmatter`,
      severity: 'info',
      message: 'Requires YAML frontmatter',
      detail: 'This agent requires YAML frontmatter in command files for proper parsing.',
      autoDismissable: true,
    });
  }

  // Placeholder config path warnings (agents with incomplete config)
  const placeholderAgents = ['kilocode', 'opencode', 'roocode'];
  if (placeholderAgents.includes(agent.id)) {
    warnings.push({
      id: `${agent.id}-placeholder-config`,
      severity: 'warning',
      message: 'Configuration paths are placeholders',
      detail: 'This agent\'s configuration paths may need manual verification. The paths shown are best-effort placeholders.',
    });
  }

  // Status-based warnings
  if (status === 'outdated') {
    warnings.push({
      id: `${agent.id}-outdated`,
      severity: 'warning',
      message: 'Configuration is outdated',
      detail: 'The deployed configuration differs from the current settings. Redeploy to sync changes.',
    });
  }

  return warnings;
}

/**
 * Get warnings for project-level deployment without valid project path
 */
export function getProjectDeploymentWarnings(
  agentId: string,
  projectPath?: string
): AgentWarning[] {
  const warnings: AgentWarning[] = [];

  if (!projectPath || projectPath.trim() === '') {
    warnings.push({
      id: `${agentId}-missing-project-path`,
      severity: 'critical',
      message: 'Project path required',
      detail: 'Project-level deployment requires a valid project path. Please specify the target project directory.',
    });
  }

  return warnings;
}

/**
 * Filter warnings by severity
 */
export function filterWarningsBySeverity(
  warnings: AgentWarning[],
  minSeverity: WarningSeverity
): AgentWarning[] {
  const severityOrder: Record<WarningSeverity, number> = {
    info: 0,
    warning: 1,
    critical: 2,
  };

  const minLevel = severityOrder[minSeverity];
  return warnings.filter(w => severityOrder[w.severity] >= minLevel);
}

/**
 * Count warnings by severity
 */
export function countWarningsBySeverity(warnings: AgentWarning[]): Record<WarningSeverity, number> {
  return warnings.reduce(
    (acc, warning) => {
      acc[warning.severity]++;
      return acc;
    },
    { info: 0, warning: 0, critical: 0 }
  );
}

/**
 * Check if any critical warnings exist
 */
export function hasCriticalWarnings(warnings: AgentWarning[]): boolean {
  return warnings.some(w => w.severity === 'critical');
}
