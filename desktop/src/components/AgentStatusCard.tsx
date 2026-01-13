import { useState } from 'react';
import { 
  Settings, 
  Rocket, 
  History, 
  ChevronDown, 
  ChevronUp,
  Clock,
  Link,
  Copy,
  FileCode,
  Zap
} from 'lucide-react';
import { getAgentIcon } from '@/lib/agents';
import { useAgentStatus } from '@/hooks/useAgentStatus';
import { useDeploymentConfig } from '@/hooks/useDeploymentConfig';
import { useRealtimeBudget } from '@/hooks/useRealtimeBudget';
import { useAgentStore } from '@/stores/agentStore';
import { getAgentWarnings } from '@/lib/agentWarnings';
import { StatusBadge } from './StatusBadge';
import { CharacterBudget } from './CharacterBudget';
import { AgentWarningBanner, WarningCountBadge } from './AgentWarningBanner';
import { AgentHealthIndicator } from './AgentHealthIndicator';
import { AgentConfigPanel } from './AgentConfigPanel';
import type { AgentDefinition, AgentStatus } from '@/lib/types';

interface AgentStatusCardProps {
  agent: AgentDefinition;
  onConfigure?: () => void;
  onDeploy?: () => void;
  onViewHistory?: () => void;
}

const statusConfig: Record<AgentStatus, { 
  status: 'success' | 'warning' | 'error' | 'info'; 
  text: string;
}> = {
  notInstalled: { status: 'info', text: 'Not Installed' },
  installed: { status: 'info', text: 'Installed' },
  configured: { status: 'success', text: 'Configured' },
  outdated: { status: 'warning', text: 'Outdated' },
};

const deploymentMethodIcons: Record<string, typeof Link> = {
  symlink: Link,
  copy: Copy,
  inline: FileCode,
  api: Zap,
};

export function AgentStatusCard({
  agent,
  onConfigure,
  onDeploy,
  onViewHistory,
}: AgentStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const icon = getAgentIcon(agent.id);
  
  const { status, statusLabel, isLoading: statusLoading } = useAgentStatus(agent.id);
  const { config } = useDeploymentConfig(agent.id);
  const { budget } = useRealtimeBudget(config.packIds, agent.id);
  const { isAgentEnabled, toggleAgent } = useAgentStore();
  
  const isEnabled = isAgentEnabled(agent.id);
  const maxChars = agent.characterLimits.maxChars;
  const currentChars = budget?.totalChars ?? 0;
  const budgetPercentage = maxChars ? (currentChars / maxChars) * 100 : undefined;

  // Get warnings
  const warnings = getAgentWarnings(agent, status ?? 'notInstalled', budgetPercentage);

  // Get status badge config
  const statusInfo = status ? statusConfig[status] : statusConfig.notInstalled;
  
  // Deployment method
  const deploymentMethod = agent.deployment.strategy;
  const DeploymentIcon = deploymentMethodIcons[deploymentMethod] || Link;

  return (
    <div 
      className={`border rounded-xl overflow-hidden transition-all duration-200 ${
        isEnabled 
          ? 'bg-white hover:shadow-lg' 
          : 'bg-slate-50 opacity-60 grayscale'
      } ${isExpanded ? 'shadow-lg' : ''}`}
    >
      {/* Main card content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{agent.name}</h3>
                <AgentHealthIndicator agentId={agent.id} size="sm" />
              </div>
              <p className="text-sm text-slate-500 font-mono">{agent.configPaths.user}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {warnings.length > 0 && (
              <WarningCountBadge warnings={warnings} />
            )}
            {statusLoading ? (
              <div className="w-20 h-6 bg-slate-200 rounded animate-pulse" />
            ) : (
              <StatusBadge status={statusInfo.status} text={statusInfo.text} />
            )}
            {/* Enable/Disable toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleAgent(agent.id)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
        </div>

        {/* Deployment info */}
        {status === 'configured' && (
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>Last deployed: 2 hours ago</span>
            </div>
            <div className="flex items-center gap-1">
              <DeploymentIcon size={12} />
              <span className="capitalize">{deploymentMethod}</span>
            </div>
          </div>
        )}

        {/* Character budget */}
        {maxChars && (
          <div className="mb-3">
            <CharacterBudget
              current={currentChars}
              max={maxChars}
              label="Character Budget"
            />
          </div>
        )}

        {/* Enabled packs */}
        {config.packIds.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-slate-500 mb-1">Enabled Packs:</div>
            <div className="flex flex-wrap gap-1">
              {config.packIds.map(packId => (
                <span 
                  key={packId}
                  className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                >
                  {packId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && !isExpanded && (
          <AgentWarningBanner 
            warnings={warnings} 
            agentId={agent.id}
            maxVisible={1}
          />
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Settings size={14} />
            Configure
            {isExpanded ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          
          <button
            onClick={onDeploy}
            disabled={!isEnabled}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Rocket size={14} />
            Deploy
          </button>
          
          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <History size={14} />
              History
            </button>
          )}
        </div>

        {/* Disabled badge */}
        {!isEnabled && (
          <div className="mt-3 text-xs text-slate-500 italic">
            Disabled - won't be included in bulk operations
          </div>
        )}
      </div>

      {/* Expanded configuration panel */}
      {isExpanded && (
        <AgentConfigPanel
          agent={agent}
          isExpanded={true}
          onToggle={() => setIsExpanded(false)}
          onValidate={() => {}}
          onDeploy={onDeploy || (() => {})}
        />
      )}
    </div>
  );
}

/** Skeleton loading state */
export function AgentStatusCardSkeleton() {
  return (
    <div className="border rounded-xl p-4 bg-white animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-lg" />
          <div>
            <div className="w-32 h-5 bg-slate-200 rounded mb-1" />
            <div className="w-48 h-4 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="w-20 h-6 bg-slate-200 rounded" />
      </div>
      <div className="w-full h-4 bg-slate-100 rounded mb-3" />
      <div className="flex gap-2">
        <div className="w-24 h-8 bg-slate-200 rounded" />
        <div className="w-20 h-8 bg-slate-200 rounded" />
      </div>
    </div>
  );
}
