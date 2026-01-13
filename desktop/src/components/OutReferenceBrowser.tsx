import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Link2, Tag } from 'lucide-react';
import { outReferenceApi, getCategoryColorClass, getFormatColorClass, formatCharCount } from '@/lib/outReferences';
import type { OutReference, OutReferenceCategory } from '@/lib/types';

interface OutReferenceBrowserProps {
  onSelectRef: (id: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
  selectable?: boolean;
  onLink?: (id: string) => void;
  selectedIds?: string[];
  onUnlink?: (id: string) => void;
}

const CATEGORY_TABS: Array<{ value: OutReferenceCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'templates', label: 'Templates' },
  { value: 'examples', label: 'Examples' },
  { value: 'schemas', label: 'Schemas' },
];

export function OutReferenceBrowser({
  onSelectRef,
  searchInputRef,
  selectable = false,
  onLink,
  onUnlink,
  selectedIds = [],
}: OutReferenceBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<OutReferenceCategory | 'all'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: refs, isLoading } = useQuery({
    queryKey: ['out-references', 'all'],
    queryFn: () => outReferenceApi.listAll(),
    staleTime: 1000 * 60 * 5,
  });

  // Get all unique tags
  const allTags = useMemo(() => {
    if (!refs) return [];
    const tagSet = new Set<string>();
    refs.forEach(ref => ref.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [refs]);

  // Filter references
  const filteredRefs = useMemo(() => {
    if (!refs) return [];

    return refs.filter(ref => {
      // Category filter
      if (selectedCategory !== 'all' && ref.category !== selectedCategory) {
        return false;
      }

      // Tag filter
      if (selectedTags.length > 0 && !selectedTags.some(tag => ref.tags.includes(tag))) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          ref.name.toLowerCase().includes(query) ||
          ref.description.toLowerCase().includes(query) ||
          ref.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [refs, selectedCategory, selectedTags, searchQuery]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="border rounded-lg bg-white">
      {/* Header with search */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search references... (Cmd+K)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setSelectedCategory(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedCategory === tab.value
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Tag size={10} />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reference list */}
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading references...</div>
        ) : filteredRefs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="mx-auto mb-2 text-slate-400" size={32} />
            <p className="text-slate-500">No out-references found</p>
            <p className="text-sm text-slate-400 mt-1">
              Create your first reference to get started
            </p>
          </div>
        ) : (
          filteredRefs.map(ref => (
            <OutReferenceCard
              key={ref.id}
              reference={ref}
              onClick={() => onSelectRef(ref.id)}
              selectable={selectable}
              onLink={onLink}
              onUnlink={onUnlink}
              isLinked={selectedIds.includes(ref.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface OutReferenceCardProps {
  reference: OutReference;
  onClick: () => void;
  selectable?: boolean;
  onLink?: (id: string) => void;
  onUnlink?: (id: string) => void;
  isLinked?: boolean;
}

function OutReferenceCard({ reference, onClick, selectable, onLink, onUnlink, isLinked }: OutReferenceCardProps) {
  return (
    <div
      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-slate-900 truncate">{reference.name}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColorClass(reference.category)}`}>
              {reference.category}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getFormatColorClass(reference.format)}`}>
              {reference.format.toUpperCase()}
            </span>
          </div>
          {reference.description && (
            <p className="text-sm text-slate-600 line-clamp-2">{reference.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>{formatCharCount(reference.characterCount)} chars</span>
            <span>{reference.wordCount} words</span>
            {reference.linkedFrom.length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 size={12} />
                {reference.linkedFrom.length} links
              </span>
            )}
          </div>
          {reference.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {reference.tags.slice(0, 5).map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {selectable && onLink && (
          <button
            onClick={e => {
              e.stopPropagation();
              if (isLinked && onUnlink) {
                onUnlink(reference.id);
              } else {
                onLink(reference.id);
              }
            }}
            className={`px-3 py-1.5 text-sm font-medium border rounded ${
              isLinked
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-blue-600 border-blue-200 hover:bg-blue-50'
            }`}
          >
            {isLinked ? 'Unlink' : 'Link'}
          </button>
        )}
      </div>
    </div>
  );
}
