import { useQuery } from '@tanstack/react-query';
import { packApi } from '@/lib/api';
import type { BudgetInfo, ValidationResult } from '@core/pack-composer-types';
import type { LoadedPack } from '@/lib/types';

type CompositionResult = {
  packs: LoadedPack[];
  budget: BudgetInfo | null;
  validation: ValidationResult | null;
  isLoading: boolean;
  error: Error | null;
};

export function usePackComposition(
  enabledPackIds: string[],
  selectedAgentId: string | null
): CompositionResult {
  const queryKey = ['pack-composition', enabledPackIds];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const resolvedOrder: string[] = [];
      const seen = new Set<string>();

      for (const packId of enabledPackIds) {
        const resolution = await packApi.resolveDependencies(packId);
        if (!resolution.success) {
          throw new Error(resolution.error || 'Dependency resolution failed');
        }
        for (const id of resolution.order) {
          if (!seen.has(id)) {
            seen.add(id);
            resolvedOrder.push(id);
          }
        }
      }

      const packs = await Promise.all(
        resolvedOrder.map(id => packApi.loadPackFull(id))
      );

      const [budget, validation] = await Promise.all([
        packApi.calculateBudget(resolvedOrder, selectedAgentId ?? undefined),
        packApi.validateComposition(resolvedOrder, selectedAgentId ?? undefined),
      ]);

      return { packs, budget, validation };
    },
    staleTime: 1000 * 60 * 5,
    enabled: enabledPackIds.length > 0,
  });

  return {
    packs: data?.packs ?? [],
    budget: (data?.budget as BudgetInfo | undefined) ?? null,
    validation: (data?.validation as ValidationResult | undefined) ?? null,
    isLoading,
    error: error as Error | null,
  };
}
