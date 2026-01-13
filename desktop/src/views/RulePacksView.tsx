import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle } from 'lucide-react';
import { PackBrowser } from '@/components/PackBrowser';
import { ActiveCompositionPanel } from '@/components/ActiveCompositionPanel';
import { AgentBudgetGrid } from '@/components/AgentBudgetGrid';
import { usePackStore } from '@/stores/packStore';
import { packApi } from '@/lib/api';
import { PackDetailModal } from '@/components/PackDetailModal';
import { usePackComposition } from '@/hooks/usePackComposition';
import { ValidationAlerts } from '@/components/ValidationAlerts';
import { PackStatistics } from '@/components/PackStatistics';

export function RulePacksView() {
  const { enabledPackIds, enablePacks } = usePackStore();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: allPacks } = useQuery({
    queryKey: ['packs', 'all'],
    queryFn: () => packApi.listAvailablePacks(),
    staleTime: 1000 * 60 * 5,
  });

  const composition = usePackComposition(enabledPackIds, null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (isCmdOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (isCmdOrCtrl && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (allPacks) {
          void enablePacks(allPacks.map(p => p.id));
        }
      }
      if (event.key === 'Escape') {
        if (selectedPackId) {
          setSelectedPackId(null);
        }
        if (showShortcuts) {
          setShowShortcuts(false);
        }
      }
      if (event.key === '?') {
        setShowShortcuts(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allPacks, enablePacks, selectedPackId, showShortcuts]);

  return (
    <main className="p-8 space-y-4" role="main">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rule Pack Management</h1>
          <p className="text-slate-600">Configure modular rule packs for your agents.</p>
        </div>
        <a
          href="/docs/rule-packs-guide.md"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
        >
          <HelpCircle size={16} />
          Help
        </a>
      </header>

      {composition.validation && (
        <ValidationAlerts validation={composition.validation} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-5">
          <PackBrowser
            onSelectPack={id => setSelectedPackId(id)}
            searchInputRef={searchInputRef}
          />
        </section>

        <section className="xl:col-span-4">
          <ActiveCompositionPanel enabledPackIds={enabledPackIds} />
        </section>

        <section className="xl:col-span-3 space-y-4">
          <AgentBudgetGrid enabledPackIds={enabledPackIds} />
          <PackStatistics />
        </section>
      </div>

      {selectedPackId && (
        <PackDetailModal packId={selectedPackId} onClose={() => setSelectedPackId(null)} />
      )}

      {showShortcuts && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">Keyboard shortcuts</p>
                <h3 className="text-lg font-semibold">Rule Pack Management</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><strong>Cmd/Ctrl + K</strong> — Focus search</li>
              <li><strong>Cmd/Ctrl + A</strong> — Enable all packs</li>
              <li><strong>Esc</strong> — Close detail modal</li>
              <li><strong>?</strong> — Open this help</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
