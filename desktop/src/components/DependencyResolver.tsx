import { useEffect, useState } from 'react';
import { packApi } from '@/lib/api';
import type { RulePack } from '@/lib/types';

type DependencyResolverProps = {
  pack: RulePack;
  onResolve: (packIds: string[]) => void;
  onCancel: () => void;
};

export function DependencyResolver({ pack, onResolve, onCancel }: DependencyResolverProps) {
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [circularPath, setCircularPath] = useState<string[] | undefined>();

  useEffect(() => {
    const load = async () => {
      const resolution = await packApi.resolveDependencies(pack.id);
      if (!resolution.success) {
        setError(resolution.error || 'Failed to resolve dependencies');
        setCircularPath(resolution.circularPath);
        return;
      }
      setDependencies(resolution.order.filter(id => id !== pack.id));
      const nextChecked: Record<string, boolean> = {};
      resolution.order.forEach(id => {
        if (id !== pack.id) nextChecked[id] = true;
      });
      setChecked(nextChecked);
    };
    void load();
  }, [pack.id]);

  const handleToggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEnable = () => {
    const selectedDeps = Object.entries(checked)
      .filter(([, value]) => value)
      .map(([id]) => id);
    onResolve([pack.id, ...selectedDeps]);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Resolve dependencies</h3>
            <p className="text-sm text-slate-600">
              This pack requires additional dependencies to be enabled.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700"
            aria-label="Close dependency resolver"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            <p className="font-semibold mb-1">Unable to resolve dependencies</p>
            <p>{error}</p>
            {circularPath && (
              <p className="mt-2 text-xs text-red-600">
                Circular path: {circularPath.join(' → ')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              This pack requires the following dependencies:
            </p>
            <div className="space-y-2 max-h-60 overflow-auto">
              {dependencies.map(dep => (
                <label key={dep} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked[dep] ?? false}
                    onChange={() => handleToggle(dep)}
                    className="accent-blue-600"
                  />
                  <span>{dep}</span>
                </label>
              ))}
              {dependencies.length === 0 && (
                <p className="text-sm text-slate-500">No additional dependencies required.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleEnable}
            className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={!!error}
          >
            Enable All
          </button>
        </div>
      </div>
    </div>
  );
}
