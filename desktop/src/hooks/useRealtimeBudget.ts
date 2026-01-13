import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { packApi } from '@/lib/api';
import type { BudgetInfo } from '@core/pack-composer-types';

export function useRealtimeBudget(
  enabledPackIds: string[],
  agentId: string | null
) {
  const [debouncedIds, setDebouncedIds] = useState(enabledPackIds);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedIds(enabledPackIds), 300);
    return () => clearTimeout(timeout);
  }, [enabledPackIds]);

  const queryKey = ['budget', debouncedIds, agentId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      packApi.calculateBudget(debouncedIds, agentId ?? undefined),
    staleTime: 1000 * 60 * 5,
    enabled: debouncedIds.length > 0,
  });

  const budget: BudgetInfo | null = useMemo(() => data ?? null, [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  return {
    budget,
    isCalculating: isLoading,
    invalidate,
  };
}
