import { useState, useMemo, RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Terminal, GitBranch, FileText, Wrench, Loader2 } from 'lucide-react';
import { CommandCard } from './CommandCard';
import { commandApi, type CommandMetadata } from '@/lib/commands';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';

interface CommandBrowserProps {
  onSelectCommand: (commandId: string) => void;
  searchInputRef?: RefObject<HTMLInputElement>;
}

type CategoryFilter = 'all' | 'workflow' | 'git' | 'documentation' | 'utility';
type SortOption = 'name' | 'category' | 'chars';

const categoryTabs: { value: CategoryFilter; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { value: 'all', label: 'All', icon: Terminal },
  { value: 'workflow', label: 'Workflow', icon: Terminal },
  { value: 'git', label: 'Git', icon: GitBranch },
  { value: 'documentation', label: 'Docs', icon: FileText },
  { value: 'utility', label: 'Utility', icon: Wrench },
];

export function CommandBrowser({ onSelectCommand, searchInputRef }: CommandBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const { enabledCommandIds, enableCommand, disableCommand } = useDeploymentConfigStore();

  const { data: commands, isLoading, error } = useQuery({
    queryKey: ['commands', 'all'],
    queryFn: () => commandApi.listAvailableCommands(),
    staleTime: 1000 * 60 * 5,
  });

  const filteredAndSortedCommands = useMemo(() => {
    if (!commands) return [];

    let filtered = commands;

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(cmd => cmd.category === categoryFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cmd =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'chars':
          return b.characterCount - a.characterCount;
        default:
          return 0;
      }
    });
  }, [commands, categoryFilter, searchQuery, sortBy]);

  const handleToggle = (command: CommandMetadata) => {
    if (enabledCommandIds.includes(command.id)) {
      disableCommand(command.id);
    } else {
      enableCommand(command.id);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-6 flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <div className="text-red-600">
          Failed to load commands: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search commands... (⌘K)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categoryTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => setCategoryFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  categoryFilter === tab.value
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Sort and Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {filteredAndSortedCommands.length} command{filteredAndSortedCommands.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="text-sm border-none bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="name">Sort by Name</option>
              <option value="category">Sort by Category</option>
              <option value="chars">Sort by Size</option>
            </select>
          </div>
        </div>
      </div>

      {/* Command Grid */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filteredAndSortedCommands.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {searchQuery ? 'No commands match your search' : 'No commands available'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredAndSortedCommands.map(command => (
              <CommandCard
                key={command.id}
                command={command}
                isEnabled={enabledCommandIds.includes(command.id)}
                onToggle={() => handleToggle(command)}
                onSelect={() => onSelectCommand(command.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
