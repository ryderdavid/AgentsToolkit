import type { AgentDefinition } from '@/lib/types';
import { getAgentIcon } from '@/lib/agents';
import { StatusBadge } from './StatusBadge';

interface AgentCardProps {
  agent: AgentDefinition;
  isInstalled?: boolean;
  onConfigure?: () => void;
  onDeploy?: () => void;
}

export function AgentCard({ agent, isInstalled = false, onConfigure, onDeploy }: AgentCardProps) {
  const icon = getAgentIcon(agent.id);
  const maxChars = agent.characterLimits.maxChars;

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold">{agent.name}</h3>
            <p className="text-sm text-slate-600">{agent.id}</p>
          </div>
        </div>
        <StatusBadge 
          status={isInstalled ? 'success' : 'info'} 
          text={isInstalled ? 'Installed' : 'Not Installed'} 
        />
      </div>
      
      <div className="mb-3">
        <p className="text-sm text-slate-600 mb-2">{agent.notes || 'No description'}</p>
        {maxChars && (
          <div className="text-xs text-slate-500">
            Max chars: {maxChars.toLocaleString()}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onConfigure && (
          <button
            onClick={onConfigure}
            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded"
          >
            Configure
          </button>
        )}
        {onDeploy && (
          <button
            onClick={onDeploy}
            className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
          >
            Deploy
          </button>
        )}
      </div>
    </div>
  );
}
