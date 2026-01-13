import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { packApi } from '@/lib/api';
import { usePackStore } from '@/stores/packStore';
import { PackPreview } from './PackPreview';

type PackDetailModalProps = {
  packId: string;
  onClose: () => void;
};

export function PackDetailModal({ packId, onClose }: PackDetailModalProps) {
  const { enabledPackIds, enablePacks, disablePacks } = usePackStore();
  const [showFullContent, setShowFullContent] = useState(false);

  const { data: pack, isLoading } = useQuery({
    queryKey: ['pack', 'detail', packId],
    queryFn: () => packApi.loadPackFull(packId),
  });

  const { data: dependencies } = useQuery({
    queryKey: ['pack', 'deps', packId],
    queryFn: () => packApi.resolveDependencies(packId),
  });

  const isEnabled = enabledPackIds.includes(packId);
  const dependencyList = useMemo(() => dependencies?.order ?? [], [dependencies]);
  const dependencyError = dependencies?.success === false ? (dependencies.error ?? 'Dependency resolution failed') : null;
  const dependencyPath = dependencies?.success === false ? dependencies.circularPath : null;

  const handleToggle = async () => {
    if (isEnabled) {
      disablePacks([packId]);
      return;
    }

    if (!dependencies) return;

    if (!dependencies.success) {
      const pathDetails = dependencyPath?.length ? ` Path: ${dependencyPath.join(' → ')}` : '';
      alert(`Cannot enable pack: ${dependencies.error ?? 'Dependency resolution failed'}.${pathDetails}`);
      return;
    }

    const order = dependencyList.length > 0 ? dependencyList : [packId];
    await enablePacks(order);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="text-xs uppercase text-slate-500">Rule Pack</p>
            <h2 className="text-xl font-semibold">{pack?.name || packId}</h2>
            <p className="text-sm text-slate-600">{pack?.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
            aria-label="Close pack details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 py-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-3 lg:col-span-1">
            {isLoading || !pack ? (
              <div className="h-32 rounded-lg bg-slate-100 animate-pulse" />
            ) : (
              <>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-1">Version</p>
                  <p className="font-semibold">{pack.version}</p>
                  <div className="mt-2 text-sm text-slate-600">
                    <p>Category: {pack.metadata.category}</p>
                    <p>Word count: {pack.metadata.wordCount.toLocaleString()}</p>
                    <p>Character count: {pack.metadata.characterCount.toLocaleString()}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pack.metadata.tags.map(tag => (
                      <span key={tag} className="text-xs bg-slate-100 px-2 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <p className="text-sm font-semibold mb-2">Dependencies</p>
                  {dependencyError && (
                    <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                      <p>{dependencyError}</p>
                      {dependencyPath?.length ? (
                        <p className="mt-1">
                          Circular path: {dependencyPath.join(' → ')}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <div className="space-y-1">
                    {dependencyList.length === 0 && (
                      <p className="text-sm text-slate-500">None</p>
                    )}
                    {dependencyList.map(dep => (
                      <div
                        key={dep}
                        className="flex items-center justify-between text-sm text-slate-700"
                      >
                        <span>{dep}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            enabledPackIds.includes(dep)
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {enabledPackIds.includes(dep) ? 'Enabled' : 'Not enabled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <p className="text-sm font-semibold mb-2">Target Agents</p>
                  <p className="text-sm text-slate-700">
                    {pack.targetAgents.includes('*') ? 'All agents' : pack.targetAgents.join(', ')}
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <p className="text-sm font-semibold mb-2">Files</p>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {pack.files.map(file => (
                      <li key={file} className="flex items-center justify-between">
                        <span>{file}</span>
                        <span className="text-xs text-slate-500">md</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="lg:col-span-2 space-y-3">
            {pack && (
              <PackPreview packId={pack.id} forceExpanded={showFullContent} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{pack?.actualWordCount.toLocaleString()} words</span>
            <span>{pack?.actualCharacterCount.toLocaleString()} characters</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFullContent(s => !s)}
              className="px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
            >
              {showFullContent ? 'Hide Preview' : 'View Full Content'}
            </button>
            <button
              onClick={handleToggle}
              className={`px-4 py-2 text-sm rounded ${
                isEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isEnabled ? 'Disable Pack' : 'Enable Pack'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
