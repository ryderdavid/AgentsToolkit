import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  Rocket, 
  CheckCircle, 
  Download,
  Upload,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { getAllAgents } from '@/lib/agents';
import { deploymentApi } from '@/lib/api';
import { useAgentStore } from '@/stores/agentStore';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';
import { AgentStatusCard, AgentStatusCardSkeleton } from '@/components/AgentStatusCard';
import { DeploymentHistoryModal } from '@/components/DeploymentHistoryModal';
import { DeploymentPreviewModal } from '@/components/DeploymentPreviewModal';
import { DeploymentProgressDialog, type DeploymentStep } from '@/components/DeploymentProgressDialog';
import { BulkDeploymentDialog, type BulkDeploymentResult } from '@/components/BulkDeploymentDialog';
import { DeploymentStatusIndicator, type DeploymentActivity } from '@/components/DeploymentStatusIndicator';
import { useAgentDeployment } from '@/hooks/useAgentDeployment';
import type { AgentDefinition, AgentStatus, DeploymentOutput } from '@/lib/types';

type FilterMode = 'all' | 'installed' | 'configured' | 'notInstalled';

export function AgentsView() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [historyModalAgent, setHistoryModalAgent] = useState<AgentDefinition | null>(null);
  const [previewModalAgent, setPreviewModalAgent] = useState<AgentDefinition | null>(null);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [deployingAgent, setDeployingAgent] = useState<AgentDefinition | null>(null);
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>('preparing');
  const [deploymentOutput, setDeploymentOutput] = useState<DeploymentOutput | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [activities, setActivities] = useState<DeploymentActivity[]>([]);

  // Hooks
  const { enabledAgentIds, getEnabledAgents } = useAgentStore();
  const configStore = useDeploymentConfigStore();
  const { deployToAgent, rollbackDeployment } = useAgentDeployment();

  // Load agents from TypeScript core
  const agents = getAllAgents();

  // Fetch status for all agents
  const statusQueries = useQueries({
    queries: agents.map(agent => ({
      queryKey: ['agent-status', agent.id],
      queryFn: () => deploymentApi.getDeploymentStatus(agent.id),
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchInterval: 30000, // Poll every 30 seconds
    })),
  });

  // Build status map
  const statusMap = useMemo(() => {
    const map = new Map<string, AgentStatus>();
    agents.forEach((agent, index) => {
      const status = statusQueries[index]?.data;
      if (status) {
        map.set(agent.id, status);
      }
    });
    return map;
  }, [agents, statusQueries]);

  // Filter and search agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesId = agent.id.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }

      // Status filter
      if (filterMode !== 'all') {
        const status = statusMap.get(agent.id);
        if (filterMode === 'installed' && status !== 'installed' && status !== 'configured') return false;
        if (filterMode === 'configured' && status !== 'configured') return false;
        if (filterMode === 'notInstalled' && status !== 'notInstalled') return false;
      }

      return true;
    });
  }, [agents, searchQuery, filterMode, statusMap]);

  // Get enabled agents for bulk operations
  const enabledAgents = useMemo(() => {
    return agents.filter(a => enabledAgentIds.includes(a.id));
  }, [agents, enabledAgentIds]);

  // Counts
  const counts = useMemo(() => {
    const installed = agents.filter(a => {
      const status = statusMap.get(a.id);
      return status === 'installed' || status === 'configured';
    }).length;
    const configured = agents.filter(a => statusMap.get(a.id) === 'configured').length;
    const notInstalled = agents.filter(a => statusMap.get(a.id) === 'notInstalled').length;
    return { all: agents.length, installed, configured, notInstalled };
  }, [agents, statusMap]);

  const isAnyLoading = statusQueries.some(q => q.isLoading);

  // Handlers
  const handleDeploy = async (agent: AgentDefinition) => {
    setPreviewModalAgent(agent);
  };

  const handleDeployConfirm = async () => {
    if (!previewModalAgent) return;

    const agent = previewModalAgent;
    setPreviewModalAgent(null);
    setDeployingAgent(agent);
    setDeploymentStep('preparing');
    setDeploymentOutput(null);
    setDeploymentError(null);

    // Add to activities
    setActivities(prev => [...prev, {
      agentId: agent.id,
      agentName: agent.name,
      step: 'preparing',
    }]);

    try {
      setDeploymentStep('validating');
      updateActivity(agent.id, 'validating');

      setDeploymentStep('backing-up');
      updateActivity(agent.id, 'backing-up');

      setDeploymentStep('deploying');
      updateActivity(agent.id, 'deploying');

      const config = configStore.getDeploymentConfig(agent.id);
      const output = await deployToAgent(agent.id, config);

      if (output?.success) {
        setDeploymentStep('complete');
        setDeploymentOutput(output);
        updateActivity(agent.id, 'complete');
      } else {
        setDeploymentStep('error');
        setDeploymentError(output?.errors?.join(', ') || 'Deployment failed');
        setDeploymentOutput(output);
        updateActivity(agent.id, 'error', output?.errors?.join(', '));
      }
    } catch (err) {
      setDeploymentStep('error');
      setDeploymentError(err instanceof Error ? err.message : 'Unknown error');
      updateActivity(agent.id, 'error', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const updateActivity = (agentId: string, step: DeploymentActivity['step'], message?: string) => {
    setActivities(prev => prev.map(a => 
      a.agentId === agentId ? { ...a, step, message } : a
    ));
  };

  const handleRollback = async (agentId: string, timestamp: string) => {
    const success = await rollbackDeployment(agentId, timestamp);
    if (success) {
      setHistoryModalAgent(null);
    }
  };

  const handleBulkComplete = (results: BulkDeploymentResult[]) => {
    console.log('Bulk deployment complete:', results);
    setShowBulkDialog(false);
  };

  const handleExportConfig = () => {
    const config = {
      enabledAgents: enabledAgentIds,
      agentConfigs: Object.fromEntries(
        agents.map(a => [a.id, configStore.getAgentConfig(a.id)])
      ),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'agents-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        // TODO: Apply imported config
        console.log('Imported config:', config);
      } catch (err) {
        console.error('Failed to import config:', err);
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agent Management</h1>
              <p className="text-slate-500">
                Configure and deploy AGENTS.md to your AI assistants
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportConfig}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={handleImportConfig}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Upload size={16} />
                Import
              </button>
              <button
                onClick={() => setShowBulkDialog(true)}
                disabled={enabledAgents.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Rocket size={16} />
                Deploy All ({enabledAgents.length})
              </button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              {(['all', 'installed', 'configured', 'notInstalled'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    filterMode === mode
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'all' && `All (${counts.all})`}
                  {mode === 'installed' && `Installed (${counts.installed})`}
                  {mode === 'configured' && `Configured (${counts.configured})`}
                  {mode === 'notInstalled' && `Not Installed (${counts.notInstalled})`}
                </button>
              ))}
            </div>

            {isAnyLoading && (
              <RefreshCw size={16} className="animate-spin text-blue-500" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-slate-600">
              <CheckCircle size={14} className="text-green-500" />
              {enabledAgents.length} of {agents.length} agents enabled
            </span>
            {counts.configured > 0 && (
              <span className="text-green-600">
                {counts.configured} configured
              </span>
            )}
          </div>
        </div>

        {/* Agent grid */}
        {filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">
              No agents found
            </h3>
            <p className="text-slate-500">
              {searchQuery 
                ? 'Try adjusting your search or filters'
                : 'No agents match the current filter'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isAnyLoading && !statusQueries.some(q => q.data) ? (
              // Show skeletons while initial loading
              Array.from({ length: 6 }).map((_, i) => (
                <AgentStatusCardSkeleton key={i} />
              ))
            ) : (
              filteredAgents.map(agent => (
                <AgentStatusCard
                  key={agent.id}
                  agent={agent}
                  onDeploy={() => handleDeploy(agent)}
                  onViewHistory={() => setHistoryModalAgent(agent)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals and dialogs */}
      {historyModalAgent && (
        <DeploymentHistoryModal
          agentId={historyModalAgent.id}
          agentName={historyModalAgent.name}
          isOpen={true}
          onClose={() => setHistoryModalAgent(null)}
          onRollback={(timestamp) => handleRollback(historyModalAgent.id, timestamp)}
        />
      )}

      {previewModalAgent && (
        <DeploymentPreviewModal
          agent={previewModalAgent}
          config={configStore.getDeploymentConfig(previewModalAgent.id)}
          isOpen={true}
          onClose={() => setPreviewModalAgent(null)}
          onDeploy={handleDeployConfirm}
        />
      )}

      {deployingAgent && (
        <DeploymentProgressDialog
          isOpen={true}
          agentName={deployingAgent.name}
          currentStep={deploymentStep}
          output={deploymentOutput}
          error={deploymentError}
          onViewHistory={() => {
            setDeployingAgent(null);
            setHistoryModalAgent(deployingAgent);
          }}
          onRollback={() => rollbackDeployment(deployingAgent.id)}
          onClose={() => setDeployingAgent(null)}
        />
      )}

      {showBulkDialog && (
        <BulkDeploymentDialog
          isOpen={true}
          agents={enabledAgents}
          onClose={() => setShowBulkDialog(false)}
          onComplete={handleBulkComplete}
        />
      )}

      {/* Floating deployment status indicator */}
      {activities.length > 0 && (
        <DeploymentStatusIndicator
          activities={activities}
          onDismiss={(agentId) => {
            setActivities(prev => prev.filter(a => a.agentId !== agentId));
          }}
          onDismissAll={() => setActivities([])}
        />
      )}
    </div>
  );
}
