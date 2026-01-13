import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { usePackComposition } from '@/hooks/usePackComposition';
import { usePackStore } from '@/stores/packStore';
import { ValidationAlerts } from './ValidationAlerts';
import { PresetSelector } from './PresetSelector';
import { PackExportImport } from './PackExportImport';
import { packApi } from '@/lib/api';
import { getRecommendedConfigs } from '@/lib/recommendedConfigs';

type ActiveCompositionPanelProps = {
  enabledPackIds: string[];
};

export function ActiveCompositionPanel({ enabledPackIds }: ActiveCompositionPanelProps) {
  const { selectedAgentId, disablePacks, enablePacks, reset } = usePackStore();
  const { packs, budget, validation, isLoading } = usePackComposition(
    enabledPackIds,
    selectedAgentId
  );

  const totalStats = useMemo(() => {
    if (!budget) return { words: 0, chars: 0 };
    const words = packs.reduce((sum, p) => sum + p.actualWordCount, 0);
    return { words, chars: budget.totalChars };
  }, [budget, packs]);

  const handleClear = () => disablePacks(enabledPackIds);

  const handleGenerateAgents = async () => {
    const generated = await packApi.generateAgentsMd({ packIds: enabledPackIds });
    if (generated.success) {
      await navigator.clipboard.writeText(generated.content);
    }
  };

  const handlePreset = async (packsToEnable: string[]) => {
    await enablePacks(packsToEnable);
  };

  const breakdown = budget?.packBreakdown ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Active Composition</h2>
          <p className="text-sm text-slate-600">Manage enabled packs and budgets.</p>
        </div>
        <div className="flex gap-2">
          <PresetSelector
            presets={getRecommendedConfigs()}
            onSelect={handlePreset}
            onReset={reset}
          />
          <button
            onClick={handleClear}
            className="px-3 py-2 text-sm rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Clear All
          </button>
        </div>
      </div>

      {validation && <ValidationAlerts validation={validation} />}

      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-700">
              {enabledPackIds.length} pack(s) enabled
            </p>
            <p className="text-xs text-slate-500">
              {totalStats.words.toLocaleString()} words · {totalStats.chars.toLocaleString()} chars
            </p>
          </div>
          <PackExportImport />
        </div>

        <div className="mt-3 grid gap-2">
          {packs.map(pack => (
            <div
              key={pack.id}
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
            >
              <div>
                <p className="font-medium text-sm">{pack.name}</p>
                <p className="text-xs text-slate-500">
                  {pack.actualWordCount.toLocaleString()} words · {pack.actualCharacterCount.toLocaleString()} chars
                </p>
              </div>
              <button
                onClick={() => disablePacks([pack.id])}
                className="text-slate-500 hover:text-red-600"
                aria-label={`Remove ${pack.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {packs.length === 0 && (
            <p className="text-sm text-slate-500">No packs enabled yet.</p>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-3">
        <h3 className="text-sm font-semibold mb-2">Pack Breakdown</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-2">Pack</th>
                <th>Chars</th>
                <th>Words</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map(item => (
                <tr key={item.packId} className="border-b last:border-0">
                  <td className="py-2">{item.packId}</td>
                  <td>{item.chars.toLocaleString()}</td>
                  <td>{item.words.toLocaleString()}</td>
                  <td>{item.percentageOfTotal}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Dependency Tree</h3>
        </div>
        <div className="space-y-1">
          {packs.map(pack => (
            <div key={pack.id} className="text-sm text-slate-700">
              <span className="font-semibold">{pack.id}</span>
              {pack.dependencies.length > 0 && (
                <span className="text-slate-500"> → {pack.dependencies.join(' → ')}</span>
              )}
            </div>
          ))}
          {packs.length === 0 && (
            <p className="text-sm text-slate-500">No dependencies to display.</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleGenerateAgents}
          className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Generate AGENTS.md
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(JSON.stringify(enabledPackIds))}
          className="px-3 py-2 text-sm rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Copy Pack List
        </button>
      </div>

      {isLoading && <p className="text-xs text-slate-500">Recalculating budget…</p>}
    </div>
  );
}
