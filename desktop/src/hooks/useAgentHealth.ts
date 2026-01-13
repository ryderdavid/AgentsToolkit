import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fsApi } from '@/lib/api';
import { getAgentById } from '@/lib/agents';

/** Health status levels */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

/** Individual health issue */
export interface HealthIssue {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  suggestion?: string;
  autoFixable?: boolean;
}

/** Health check result */
export interface HealthCheckResult {
  status: HealthStatus;
  issues: HealthIssue[];
  lastChecked: Date;
  configFileExists: boolean;
  symlinkValid: boolean;
  formatValid: boolean;
}

interface UseAgentHealthOptions {
  /** Check interval in milliseconds (default: 300000 = 5 minutes) */
  checkInterval?: number;
  /** Whether automatic checking is enabled */
  enableAutoCheck?: boolean;
}

interface UseAgentHealthReturn {
  /** Overall health status */
  healthStatus: HealthStatus;
  /** List of health issues */
  issues: HealthIssue[];
  /** Whether health check is running */
  isChecking: boolean;
  /** Error from health check */
  error: Error | null;
  /** Last check timestamp */
  lastChecked: Date | null;
  /** Force a health check refresh */
  runHealthCheck: () => Promise<void>;
  /** Full health check result */
  result: HealthCheckResult | null;
}

async function performHealthCheck(agentId: string): Promise<HealthCheckResult> {
  const issues: HealthIssue[] = [];
  const agent = getAgentById(agentId);
  
  // Check if agent is installed
  const isInstalled = await fsApi.checkAgentInstalled(agentId);
  
  let configFileExists = false;
  let symlinkValid = false;
  let formatValid = true;
  
  if (!isInstalled) {
    issues.push({
      id: `${agentId}-not-installed`,
      severity: 'warning',
      message: 'Agent is not installed on this system',
      suggestion: 'Install the agent or verify the installation path',
    });
  } else {
    configFileExists = true;
    symlinkValid = true; // Assume valid if installed
  }

  // Check agent-specific requirements
  if (agent) {
    // Check frontmatter requirement
    if (agent.requiresFrontmatter) {
      issues.push({
        id: `${agentId}-frontmatter-info`,
        severity: 'warning',
        message: 'Agent requires YAML frontmatter in command files',
        suggestion: 'Ensure all deployed commands include proper frontmatter',
      });
    }

    // Check for placeholder config paths
    const placeholderAgents = ['kilocode', 'opencode', 'roocode'];
    if (placeholderAgents.includes(agentId)) {
      issues.push({
        id: `${agentId}-placeholder-paths`,
        severity: 'warning',
        message: 'Configuration paths are placeholders',
        suggestion: 'Verify and update configuration paths manually',
      });
    }

    // Check character limits
    if (agent.characterLimits.maxChars && agent.characterLimits.maxChars < 10000) {
      issues.push({
        id: `${agentId}-low-char-limit`,
        severity: 'warning',
        message: `Agent has a low character limit (${agent.characterLimits.maxChars.toLocaleString()})`,
        suggestion: 'Use minimal pack configurations to stay within budget',
      });
    }
  }

  // Determine overall status
  let status: HealthStatus = 'healthy';
  if (issues.some(i => i.severity === 'error')) {
    status = 'error';
  } else if (issues.some(i => i.severity === 'warning')) {
    status = 'warning';
  }

  if (!isInstalled) {
    status = 'unknown';
  }

  return {
    status,
    issues,
    lastChecked: new Date(),
    configFileExists,
    symlinkValid,
    formatValid,
  };
}

export function useAgentHealth(
  agentId: string,
  options: UseAgentHealthOptions = {}
): UseAgentHealthReturn {
  const {
    checkInterval = 5 * 60 * 1000, // 5 minutes
    enableAutoCheck = true,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['agent-health', agentId];

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => performHealthCheck(agentId),
    staleTime: checkInterval,
    refetchInterval: enableAutoCheck ? checkInterval : false,
    refetchIntervalInBackground: false,
  });

  const runHealthCheck = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  return {
    healthStatus: data?.status ?? 'unknown',
    issues: data?.issues ?? [],
    isChecking: isLoading,
    error: error as Error | null,
    lastChecked: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    runHealthCheck,
    result: data ?? null,
  };
}
