import { useQuery } from '@tanstack/react-query';
import { Terminal, X, AlertTriangle, Loader2, Rocket } from 'lucide-react';
import { commandApi, type CommandMetadata, formatCharCount } from '@/lib/commands';
import { agentApi } from '@/lib/api';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';

interface ActiveCommandsPanelProps {
  onDeployClick?: () => void;
}

export function ActiveCommandsPanel({ onDeployClick }: ActiveCommandsPanelProps) {
  const { enabledCommandIds, disableCommand } = useDeploymentConfigStore();

  const { data: allCommands } = useQuery({
    queryKey: ['commands', 'all'],
    queryFn: () => commandApi.listAvailableCommands(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAllAgents(),
  });

  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['command-budget', enabledCommandIds],
    queryFn: () => commandApi.calculateCommandBudget(enabledCommandIds),
    enabled: enabledCommandIds.length > 0,
  });

  const enabledCommands = allCommands?.filter(cmd => enabledCommandIds.includes(cmd.id)) ?? [];
  const totalChars = budget?.totalChars ?? 0;

  // Check agent compatibility
  const agentWarnings: { agentId: string; agentName: string; reason: string }[] = [];
  if (agents && enabledCommands.length > 0) {
    for (const agent of agents) {
      const maxChars = agent.characterLimits.maxChars;
      if (maxChars && totalChars > maxChars) {
        agentWarnings.push({
          agentId: agent.id,
          agentName: agent.name,
          reason: `Exceeds ${agent.name} limit (${formatCharCount(totalChars)} > ${formatCharCount(maxChars)})`,
        });
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active Commands</h2>
          <span className="text-sm text-slate-500">
            {enabledCommandIds.length} enabled
          </span>
        </div>
      </div>

      {/* Budget Summary */}
      <div className="p-4 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Total Character Count</span>
          {budgetLoading ? (
            <Loader2 className="animate-spin text-slate-400" size={16} />
          ) : (
            <span className="font-bold text-lg">{totalChars.toLocaleString()}</span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {agentWarnings.length > 0 && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Character limit warnings:</p>
              <ul className="mt-1 space-y-1">
                {agentWarnings.map(warning => (
                  <li key={warning.agentId} className="text-yellow-700">
                    {warning.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Command List */}
      <div className="p-4 max-h-72 overflow-y-auto">
        {enabledCommands.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Terminal size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No commands enabled</p>
            <p className="text-xs">Select commands from the browser to enable them</p>
          </div>
        ) : (
          <div className="space-y-2">
            {enabledCommands.map(command => (
              <div
                key={command.id}
                className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Terminal size={14} className="text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{command.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatCharCount(command.characterCount)} chars
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disableCommand(command.id)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors shrink-0"
                  title="Disable command"
                >
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Breakdown */}
      {enabledCommands.length > 0 && agents && (
        <div className="p-4 border-t">
          <p className="text-xs text-slate-500 mb-2">Per-Agent Compatibility</p>
          <div className="grid grid-cols-2 gap-2">
            {agents.slice(0, 6).map(agent => {
              const maxChars = agent.characterLimits.maxChars;
              const isWithinLimit = !maxChars || totalChars <= maxChars;
              const percentage = maxChars ? Math.round((totalChars / maxChars) * 100) : 0;

              return (
                <div
                  key={agent.id}
                  className={`p-2 rounded text-xs ${
                    isWithinLimit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{agent.name}</span>
                    {maxChars && <span>{percentage}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deploy Button */}
      {enabledCommands.length > 0 && (
        <div className="p-4 border-t">
          <button
            onClick={onDeployClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Rocket size={18} />
            Deploy Commands
          </button>
        </div>
      )}
    </div>
  );
}
