import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deploymentApi } from '@/lib/api';
import type { AgentStatus } from '@/lib/types';

interface UseAgentStatusOptions {
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Whether polling is enabled (default: true) */
  enablePolling?: boolean;
  /** Stale time in milliseconds (default: 300000 = 5 minutes) */
  staleTime?: number;
}

interface UseAgentStatusReturn {
  /** Current agent status */
  status: AgentStatus | undefined;
  /** Whether status is being fetched */
  isLoading: boolean;
  /** Whether status is being refetched in background */
  isFetching: boolean;
  /** Error if fetch failed */
  error: Error | null;
  /** Last time status was successfully fetched */
  lastUpdated: Date | null;
  /** Manually refetch status */
  refetchStatus: () => Promise<void>;
  /** Get human-readable status label */
  statusLabel: string;
  /** Get status color for UI */
  statusColor: 'gray' | 'blue' | 'green' | 'yellow';
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  notInstalled: 'Not Installed',
  installed: 'Installed',
  configured: 'Configured',
  outdated: 'Outdated',
};

const STATUS_COLORS: Record<AgentStatus, 'gray' | 'blue' | 'green' | 'yellow'> = {
  notInstalled: 'gray',
  installed: 'blue',
  configured: 'green',
  outdated: 'yellow',
};

export function useAgentStatus(
  agentId: string,
  options: UseAgentStatusOptions = {}
): UseAgentStatusReturn {
  const {
    pollingInterval = 30000,
    enablePolling = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['agent-status', agentId];

  const { data, isLoading, isFetching, error, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => deploymentApi.getDeploymentStatus(agentId),
    staleTime,
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchIntervalInBackground: false,
  });

  const refetchStatus = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const status = data;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const statusLabel = status ? STATUS_LABELS[status] : 'Unknown';
  const statusColor = status ? STATUS_COLORS[status] : 'gray';

  return {
    status,
    isLoading,
    isFetching,
    error: error as Error | null,
    lastUpdated,
    refetchStatus,
    statusLabel,
    statusColor,
  };
}

/**
 * Hook for fetching status of multiple agents at once
 */
export function useAllAgentStatuses(
  agentIds: string[],
  options: UseAgentStatusOptions = {}
) {
  const {
    pollingInterval = 30000,
    enablePolling = true,
    staleTime = 5 * 60 * 1000,
  } = options;

  const queryClient = useQueryClient();

  const queries = agentIds.map(agentId => ({
    queryKey: ['agent-status', agentId],
    queryFn: () => deploymentApi.getDeploymentStatus(agentId),
    staleTime,
    refetchInterval: enablePolling ? pollingInterval : false,
  }));

  // Return individual status per agent for flexibility
  const results = agentIds.map((agentId, index) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data, isLoading, error } = useQuery(queries[index]);
    return {
      agentId,
      status: data,
      isLoading,
      error: error as Error | null,
    };
  });

  const refetchAll = async () => {
    await Promise.all(
      agentIds.map(agentId => 
        queryClient.invalidateQueries({ queryKey: ['agent-status', agentId] })
      )
    );
  };

  const isAnyLoading = results.some(r => r.isLoading);
  const hasAnyError = results.some(r => r.error !== null);

  return {
    results,
    refetchAll,
    isAnyLoading,
    hasAnyError,
  };
}
