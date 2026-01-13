import { useQuery, useQueryClient } from '@tanstack/react-query';
import { exists, lstat, readTextFile } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
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

  const resolvePath = async (rawPath: string): Promise<string> => {
    const trimmed = rawPath.trim();
    if (trimmed.startsWith('~/')) {
      const home = await homeDir();
      return join(home, trimmed.slice(2));
    }
    if (trimmed === '~') {
      return homeDir();
    }
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    const home = await homeDir();
    return join(home, trimmed);
  };

  const getConfigPaths = (): { user?: string; project?: string } => {
    const paths: any = agent?.configPaths;
    if (!paths) return {};
    if (Array.isArray(paths)) {
      return { user: paths[0], project: paths[1] };
    }
    if (typeof paths === 'object') {
      return {
        user: paths.user ?? paths.default ?? Object.values(paths)[0],
        project: paths.project,
      };
    }
    return {};
  };

  const fileLooksLikeFile = (pathStr: string) => {
    const lastSegment = pathStr.split('/').pop() ?? pathStr;
    return lastSegment.includes('.');
  };

  const agentPaths = getConfigPaths();
  const expectedPaths = [agentPaths.user, agentPaths.project].filter(Boolean) as string[];

  const isInstalled = await fsApi.checkAgentInstalled(agentId);
  let configFileExists = true;
  let symlinkValid = true;
  let formatValid = true;

  if (!expectedPaths.length) {
    issues.push({
      id: `${agentId}-missing-config-paths`,
      severity: 'error',
      message: 'No configuration paths are defined for this agent',
      suggestion: 'Update the agent definition to include configPaths',
    });
    configFileExists = false;
    symlinkValid = false;
    formatValid = false;
  }

  const deploymentStrategy =
    (agent as any)?.deployment?.strategy ??
    (agent as any)?.deploymentStrategy ??
    (agent as any)?.deployment_strategy;
  const expectsSymlink = deploymentStrategy === 'symlink';

  for (const rawPath of expectedPaths) {
    const resolvedPath = await resolvePath(rawPath);
    const existsOnDisk = await exists(resolvedPath).catch(() => false);

    if (!existsOnDisk) {
      configFileExists = false;
      issues.push({
        id: `${agentId}-missing-config-${resolvedPath}`,
        severity: 'error',
        message: `Configuration path is missing: ${resolvedPath}`,
        suggestion: 'Deploy the agent or create the configuration file/directory',
      });
      continue;
    }

    const stat = await lstat(resolvedPath).catch(() => null);
    const expectsFile = fileLooksLikeFile(rawPath);

    if (!stat) {
      symlinkValid = false;
      issues.push({
        id: `${agentId}-stat-failed-${resolvedPath}`,
        severity: 'error',
        message: `Unable to read configuration path metadata: ${resolvedPath}`,
        suggestion: 'Check permissions and path correctness',
      });
      continue;
    }

    const isFile = stat.isFile || (stat.isSymlink && expectsFile);
    const isDirectory = stat.isDirectory || (!expectsFile && stat.isSymlink);

    if (expectsFile && isDirectory) {
      symlinkValid = false;
      issues.push({
        id: `${agentId}-dir-instead-of-file-${resolvedPath}`,
        severity: 'error',
        message: `Expected a file but found a directory at ${resolvedPath}`,
        suggestion: 'Remove the directory or point deployment to a file path',
      });
    }

    if (!expectsFile && isFile) {
      symlinkValid = false;
      issues.push({
        id: `${agentId}-file-instead-of-dir-${resolvedPath}`,
        severity: 'warning',
        message: `Expected a directory but found a file at ${resolvedPath}`,
        suggestion: 'Adjust the path or recreate the directory',
      });
    }

    if (expectsSymlink && !stat.isSymlink) {
      symlinkValid = false;
      issues.push({
        id: `${agentId}-missing-symlink-${resolvedPath}`,
        severity: 'warning',
        message: `Path is not a symlink as expected for symlink deployments: ${resolvedPath}`,
        suggestion: 'Redeploy with force overwrite or remove the existing file',
      });
    }

    if (expectsFile && isFile) {
      // Validate format for file targets when applicable
      const fileFormat = (agent as any)?.fileFormat ?? (agent as any)?.file_format;
      if (fileFormat === 'json') {
        try {
          const content = await readTextFile(resolvedPath);
          JSON.parse(content);
        } catch (err) {
          formatValid = false;
          issues.push({
            id: `${agentId}-invalid-json-${resolvedPath}`,
            severity: 'error',
            message: `Invalid JSON configuration at ${resolvedPath}`,
            suggestion: err instanceof Error ? err.message : 'Fix JSON syntax errors',
          });
        }
      } else if (fileFormat === 'yaml' || fileFormat === 'toml' || fileFormat === 'markdown') {
        try {
          const content = await readTextFile(resolvedPath);
          if (!content.trim()) {
            formatValid = false;
            issues.push({
              id: `${agentId}-empty-config-${resolvedPath}`,
              severity: 'warning',
              message: `Configuration file is empty at ${resolvedPath}`,
              suggestion: 'Populate the configuration file with valid content',
            });
          }
        } catch (err) {
          formatValid = false;
          issues.push({
            id: `${agentId}-read-failed-${resolvedPath}`,
            severity: 'error',
            message: `Unable to read configuration file at ${resolvedPath}`,
            suggestion: err instanceof Error ? err.message : 'Check file permissions',
          });
        }
      }
    }
  }

  if (!isInstalled) {
    issues.push({
      id: `${agentId}-not-installed`,
      severity: 'warning',
      message: 'Agent is not installed on this system',
      suggestion: 'Install the agent or verify the installation path',
    });
  }

  if (agent?.requiresFrontmatter) {
    issues.push({
      id: `${agentId}-frontmatter-info`,
      severity: 'warning',
      message: 'Agent requires YAML frontmatter in command files',
      suggestion: 'Ensure all deployed commands include proper frontmatter',
    });
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
