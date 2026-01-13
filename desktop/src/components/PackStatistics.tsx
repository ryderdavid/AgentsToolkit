import { useEffect, useMemo, useRef, useState } from 'react';
import { usePackStore } from '@/stores/packStore';

type UsageEntry = { packs: string[]; timestamp: string };

export function PackStatistics() {
  const { enabledPackIds } = usePackStore();
  const [history, setHistory] = useState<UsageEntry[]>([]);
  const lastSnapshot = useRef<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('pack-usage-history');
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (enabledPackIds.length === 0) return;
    const snapshot = enabledPackIds.join(',');
    if (snapshot === lastSnapshot.current) return;
    lastSnapshot.current = snapshot;
    const entry: UsageEntry = { packs: enabledPackIds, timestamp: new Date().toISOString() };
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 50);
      localStorage.setItem('pack-usage-history', JSON.stringify(next));
      return next;
    });
  }, [enabledPackIds]);

  const mostUsed = useMemo(() => {
    const counts = new Map<string, number>();
    history.forEach(entry => {
      entry.packs.forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [history]);

  const handleExportCsv = () => {
    const rows = history.map(h => `${h.timestamp},${h.packs.join('|')}`);
    const blob = new Blob([['timestamp,packs', ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pack-statistics.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Pack Statistics</h3>
          <p className="text-xs text-slate-500">Usage insights from local history</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-600 mb-1">Most used packs</p>
        <ul className="text-sm text-slate-700 space-y-1">
          {mostUsed.length === 0 && <li className="text-slate-500">No usage recorded yet.</li>}
          {mostUsed.map(([id, count]) => (
            <li key={id}>{id} — {count} times</li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500">
        Last updated: {history[0]?.timestamp ?? 'n/a'}
      </p>
    </div>
  );
}
