import { useMemo } from 'react';
import type { OutReference, OutReferenceCategory } from '@/lib/types';

export interface OutReferenceFilterOptions {
  searchQuery: string;
  category: OutReferenceCategory | 'all';
  tags: string[];
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

export function useOutReferenceFilter(
  references: OutReference[] | undefined,
  options: OutReferenceFilterOptions
) {
  const { searchQuery, category, tags, sortBy, sortOrder } = options;

  return useMemo(() => {
    if (!references) return [];

    let filtered = references.filter(ref => {
      // Category filter
      if (category !== 'all' && ref.category !== category) {
        return false;
      }

      // Tag filter (OR logic - match any selected tag)
      if (tags.length > 0 && !tags.some(tag => ref.tags.includes(tag))) {
        return false;
      }

      // Search filter (fuzzy match on name, description, tags)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = ref.name.toLowerCase().includes(query);
        const matchesDescription = ref.description.toLowerCase().includes(query);
        const matchesTags = ref.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesPath = ref.filePath.toLowerCase().includes(query);

        if (!matchesName && !matchesDescription && !matchesTags && !matchesPath) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'size':
          comparison = a.characterCount - b.characterCount;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [references, searchQuery, category, tags, sortBy, sortOrder]);
}

/** Get all unique tags from references */
export function useOutReferenceTags(references: OutReference[] | undefined): string[] {
  return useMemo(() => {
    if (!references) return [];
    const tagSet = new Set<string>();
    references.forEach(ref => ref.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [references]);
}

/** Get category counts from references */
export function useOutReferenceCategoryCounts(
  references: OutReference[] | undefined
): Record<OutReferenceCategory | 'all', number> {
  return useMemo(() => {
    const counts: Record<OutReferenceCategory | 'all', number> = {
      all: 0,
      templates: 0,
      examples: 0,
      schemas: 0,
    };

    if (!references) return counts;

    counts.all = references.length;
    references.forEach(ref => {
      counts[ref.category]++;
    });

    return counts;
  }, [references]);
}
