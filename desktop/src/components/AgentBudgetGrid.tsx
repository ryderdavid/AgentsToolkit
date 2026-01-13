import { useQuery } from '@tanstack/react-query';
import { agentApi } from '@/lib/api';
import { packApi } from '@/lib/api';
import { usePackStore } from '@/stores/packStore';
import { CharacterBudget } from './CharacterBudget';
import { getAgentIcon } from '@/lib/agents';

type AgentCardProps = {
  id: string;
  name: string;
  characterLimits: { maxChars: number | null };
};

function AgentCard({
  agent,
  budgetChars,
  selected,
  onSelect,
}: {
  agent: AgentCardProps;
  budgetChars: { used: number; max: number | null; percentage: number | null; within: boolean };
  selected: boolean;
  onSelect: () => void;
}) {
  const status = budgetChars.max === null
    ? 'Within Limit'
    : budgetChars.within
    ? budgetChars.percentage !== null && budgetChars.percentage > 80
      ? 'Near Limit'
      : 'Within Limit'
    : 'Exceeds Limit';

  const statusColor =
    status === 'Exceeds Limit'
      ? 'bg-red-100 text-red-700'
      : status === 'Near Limit'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-green-100 text-green-700';

  return (
    <button
      onClick={onSelect}
      className={`text-left border rounded-lg p-3 hover:shadow transition ${
        selected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
      aria-label={`Select agent ${agent.name}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getAgentIcon(agent.id)}</span>
          <div>
            <p className="font-semibold">{agent.name}</p>
            <p className="text-xs text-slate-500">{agent.id}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>{status}</span>
      </div>
      <p className="text-xs text-slate-600 mb-1">
        {budgetChars.max === null ? 'Unlimited' : `${budgetChars.max.toLocaleString()} chars`}
      </p>
      <CharacterBudget
        current={budgetChars.used}
        max={budgetChars.max ?? Math.max(budgetChars.used, 1)}
        label={`Usage (${budgetChars.percentage ?? 0}%)`}
      />
    </button>
  );
}

export function AgentBudgetGrid({ enabledPackIds }: { enabledPackIds: string[] }) {
  const { selectedAgentId, setSelectedAgent } = usePackStore();

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAllAgents(),
    staleTime: 1000 * 60 * 10,
  });

  const { data: agentBudgets } = useQuery({
    queryKey: ['agent-budgets', enabledPackIds, agents?.map(a => a.id).join(',')],
    enabled: !!agents && enabledPackIds.length > 0,
    queryFn: async () => {
      if (!agents) return [];
      const budgets = await Promise.all(
        agents.map(async agent => {
          const budget = await packApi.calculateBudget(enabledPackIds, agent.id);
          return {
            agent,
            used: budget.totalChars,
            max: budget.maxChars,
            percentage: budget.percentage,
            within: budget.withinLimit,
          };
        })
      );
      return budgets;
    },
    staleTime: 1000 * 60 * 2,
  });

  const sorted = (agentBudgets ?? []).sort((a, b) => {
    if (a.within !== b.within) return a.within ? 1 : -1;
    return (b.percentage ?? 0) - (a.percentage ?? 0);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Per-Agent Budget</h3>
        <select
          value={selectedAgentId ?? ''}
          onChange={e => setSelectedAgent(e.target.value || null)}
          className="text-sm border border-slate-200 rounded px-2 py-1"
        >
          <option value="">All agents</option>
          {agents?.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[70vh] overflow-auto pr-1">
        {sorted.map(({ agent, ...budget }) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            budgetChars={budget}
            selected={selectedAgentId === agent.id}
            onSelect={() => setSelectedAgent(agent.id)}
          />
        ))}
      </div>
    </div>
  );
}
