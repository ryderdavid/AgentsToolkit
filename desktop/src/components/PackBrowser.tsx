import { useMemo, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { packApi } from '@/lib/api';
import type { RulePack } from '@/lib/types';
import type { PackCategory } from '@core/rule-pack-types';
import { RulePackCard } from './RulePackCard';
import { EmptyState } from './EmptyState';
import { usePackStore } from '@/stores/packStore';
import { usePackFilter } from '@/hooks/usePackFilter';
import { DependencyResolver } from './DependencyResolver';

const categories: { label: string; value: PackCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Universal', value: 'universal' },
  { label: 'VCS', value: 'vcs' },
  { label: 'Workflow', value: 'workflow' },
];

type PackBrowserProps = {
  onSelectPack?: (packId: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
};

export function PackBrowser({ onSelectPack, searchInputRef }: PackBrowserProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PackCategory | 'all'>('all');
  const [selectedPackForDeps, setSelectedPackForDeps] = useState<RulePack | null>(null);

  const { enabledPackIds, enablePacks, disablePacks } = usePackStore();

  const { data, isLoading } = useQuery({
    queryKey: ['packs', 'available'],
    queryFn: () => packApi.listAvailablePacks(),
    staleTime: 1000 * 60 * 5,
  });

  const packs = data ?? [];
  const { filteredPacks } = usePackFilter(packs, search, category, []);

  const handleToggle = async (pack: RulePack) => {
    const isEnabled = enabledPackIds.includes(pack.id);
    if (isEnabled) {
      disablePacks([pack.id]);
      return;
    }

    const resolution = await packApi.resolveDependencies(pack.id);
    if (!resolution.success) {
      setSelectedPackForDeps(pack);
      return;
    }

    // If dependencies beyond the pack itself exist, confirm via resolver
    const deps = resolution.order.filter(id => id !== pack.id);
    if (deps.length > 0) {
      setSelectedPackForDeps(pack);
      return;
    }

    await enablePacks(resolution.order);
  };

  const onResolveDeps = async (packIds: string[]) => {
    await enablePacks(packIds);
    setSelectedPackForDeps(null);
  };

  const categoryTabs = useMemo(
    () =>
      categories.map(cat => (
        <button
          key={cat.value}
          onClick={() => setCategory(cat.value)}
          className={`px-3 py-1.5 text-sm rounded-full border ${
            category === cat.value
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {cat.label}
        </button>
      )),
    [category]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Available Packs</h2>
        <div className="flex gap-2">{categoryTabs}</div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input
          ref={searchInputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name, description, or tags"
          aria-label="Search rule packs"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-32 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredPacks.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No packs found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredPacks.map(pack => (
            <RulePackCard
              key={pack.id}
              pack={pack}
              isEnabled={enabledPackIds.includes(pack.id)}
              onToggle={() => handleToggle(pack)}
              onSelect={() => onSelectPack?.(pack.id)}
            />
          ))}
        </div>
      )}

      {selectedPackForDeps && (
        <DependencyResolver
          pack={selectedPackForDeps}
          onResolve={onResolveDeps}
          onCancel={() => setSelectedPackForDeps(null)}
        />
      )}
    </div>
  );
}
