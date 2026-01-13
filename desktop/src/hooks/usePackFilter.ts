import { useEffect, useMemo, useState } from 'react';
import type { RulePack } from '@/lib/types';
import type { PackCategory } from '@core/rule-pack-types';

type CategoryFilter = PackCategory | 'all';

export function usePackFilter(
  packs: RulePack[],
  searchQuery: string,
  category: CategoryFilter,
  tags: string[] = [],
  agentId?: string
) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filteredPacks = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    return packs.filter(pack => {
      const matchesCategory = category === 'all' || pack.metadata.category === category;
      const matchesTags = tags.length === 0 || tags.every(tag => pack.metadata.tags.includes(tag));
      const matchesAgent =
        !agentId ||
        pack.targetAgents.includes('*') ||
        pack.targetAgents.map(a => a.toLowerCase()).includes(agentId.toLowerCase());

      const matchesQuery =
        query.length === 0 ||
        pack.name.toLowerCase().includes(query) ||
        pack.description.toLowerCase().includes(query) ||
        pack.metadata.tags.some(tag => tag.toLowerCase().includes(query));

      return matchesCategory && matchesTags && matchesAgent && matchesQuery;
    });
  }, [debouncedQuery, category, tags, agentId, packs]);

  const highlightMatch = (text: string) => text;

  return { filteredPacks, highlightMatch, debouncedQuery };
}
