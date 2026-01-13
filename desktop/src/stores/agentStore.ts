import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAllAgents } from '@/lib/agents';

interface AgentStoreState {
  /** IDs of enabled agents */
  enabledAgentIds: string[];
  /** Currently selected agent for detailed view */
  selectedAgentId: string | null;
  /** Whether bulk deployment is in progress */
  bulkDeploymentInProgress: boolean;
}

interface AgentStoreActions {
  /** Toggle an agent's enabled state */
  toggleAgent: (agentId: string) => void;
  /** Enable a specific agent */
  enableAgent: (agentId: string) => void;
  /** Disable a specific agent */
  disableAgent: (agentId: string) => void;
  /** Enable multiple agents */
  enableAgents: (agentIds: string[]) => void;
  /** Disable multiple agents */
  disableAgents: (agentIds: string[]) => void;
  /** Get list of enabled agent IDs */
  getEnabledAgents: () => string[];
  /** Check if an agent is enabled */
  isAgentEnabled: (agentId: string) => boolean;
  /** Set the selected agent for detailed view */
  setSelectedAgent: (agentId: string | null) => void;
  /** Set bulk deployment status */
  setBulkDeploymentInProgress: (inProgress: boolean) => void;
  /** Reset to default state (all agents enabled) */
  reset: () => void;
}

// Default: all agents enabled
function getDefaultEnabledAgents(): string[] {
  return getAllAgents().map(a => a.id);
}

export const useAgentStore = create<AgentStoreState & AgentStoreActions>()(
  persist(
    (set, get) => ({
      enabledAgentIds: getDefaultEnabledAgents(),
      selectedAgentId: null,
      bulkDeploymentInProgress: false,

      toggleAgent: (agentId: string) => {
        const { enabledAgentIds } = get();
        const isEnabled = enabledAgentIds.includes(agentId);
        
        if (isEnabled) {
          set({ enabledAgentIds: enabledAgentIds.filter(id => id !== agentId) });
        } else {
          set({ enabledAgentIds: [...enabledAgentIds, agentId] });
        }
      },

      enableAgent: (agentId: string) => {
        const { enabledAgentIds } = get();
        if (!enabledAgentIds.includes(agentId)) {
          set({ enabledAgentIds: [...enabledAgentIds, agentId] });
        }
      },

      disableAgent: (agentId: string) => {
        const { enabledAgentIds } = get();
        set({ enabledAgentIds: enabledAgentIds.filter(id => id !== agentId) });
      },

      enableAgents: (agentIds: string[]) => {
        const { enabledAgentIds } = get();
        const newIds = agentIds.filter(id => !enabledAgentIds.includes(id));
        set({ enabledAgentIds: [...enabledAgentIds, ...newIds] });
      },

      disableAgents: (agentIds: string[]) => {
        const { enabledAgentIds } = get();
        const idsToDisable = new Set(agentIds);
        set({ enabledAgentIds: enabledAgentIds.filter(id => !idsToDisable.has(id)) });
      },

      getEnabledAgents: () => get().enabledAgentIds,

      isAgentEnabled: (agentId: string) => get().enabledAgentIds.includes(agentId),

      setSelectedAgent: (agentId: string | null) => set({ selectedAgentId: agentId }),

      setBulkDeploymentInProgress: (inProgress: boolean) => 
        set({ bulkDeploymentInProgress: inProgress }),

      reset: () => set({ 
        enabledAgentIds: getDefaultEnabledAgents(),
        selectedAgentId: null,
        bulkDeploymentInProgress: false,
      }),
    }),
    {
      name: 'agent-store',
    }
  )
);
