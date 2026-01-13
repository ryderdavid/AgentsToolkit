import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, Terminal } from 'lucide-react';
import { CommandBrowser } from '@/components/CommandBrowser';
import { ActiveCommandsPanel } from '@/components/ActiveCommandsPanel';
import { CommandDetailModal } from '@/components/CommandDetailModal';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';
import { commandApi } from '@/lib/commands';

export function CommandsView() {
  const { enabledCommandIds, enableCommands } = useDeploymentConfigStore();
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: allCommands } = useQuery({
    queryKey: ['commands', 'all'],
    queryFn: () => commandApi.listAvailableCommands(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (isCmdOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (isCmdOrCtrl && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        if (allCommands) {
          void enableCommands(allCommands.map(c => c.id));
        }
      }
      if (event.key === 'Escape') {
        if (selectedCommandId) {
          setSelectedCommandId(null);
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
  }, [allCommands, enableCommands, selectedCommandId, showShortcuts]);

  const handleDeployClick = () => {
    // Navigate to Agents view or open deployment modal
    // For now, just log the action
    console.log('Deploy commands:', enabledCommandIds);
  };

  return (
    <main className="p-8 space-y-4" role="main">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Terminal className="text-slate-600" />
            Custom Commands
          </h1>
          <p className="text-slate-600 mt-1">
            Manage and deploy custom slash commands to your AI coding agents.
          </p>
        </div>
        <a
          href="/docs/commands-guide.md"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
        >
          <HelpCircle size={16} />
          Help
        </a>
      </header>

      {/* Stats bar */}
      <div className="flex items-center gap-6 py-3 px-4 bg-slate-50 rounded-lg">
        <div>
          <span className="text-sm text-slate-500">Total Commands:</span>
          <span className="ml-2 font-semibold">{allCommands?.length ?? 0}</span>
        </div>
        <div>
          <span className="text-sm text-slate-500">Enabled:</span>
          <span className="ml-2 font-semibold text-green-600">{enabledCommandIds.length}</span>
        </div>
        <div>
          <span className="text-sm text-slate-500">Categories:</span>
          <span className="ml-2 font-semibold">
            {new Set(allCommands?.map(c => c.category) ?? []).size}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Command Browser - takes most of the space */}
        <section className="xl:col-span-8">
          <CommandBrowser
            onSelectCommand={id => setSelectedCommandId(id)}
            searchInputRef={searchInputRef}
          />
        </section>

        {/* Active Commands Panel */}
        <section className="xl:col-span-4">
          <ActiveCommandsPanel onDeployClick={handleDeployClick} />
        </section>
      </div>

      {/* Detail Modal */}
      {selectedCommandId && (
        <CommandDetailModal
          commandId={selectedCommandId}
          onClose={() => setSelectedCommandId(null)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">Keyboard shortcuts</p>
                <h3 className="text-lg font-semibold">Custom Commands</h3>
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
              <li><strong>Cmd/Ctrl + A</strong> — Enable all commands</li>
              <li><strong>Esc</strong> — Close detail modal</li>
              <li><strong>?</strong> — Open this help</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
