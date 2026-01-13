import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeploymentConfig, TargetLevel } from '@/lib/types';

/** Per-agent deployment configuration */
interface AgentDeploymentConfig {
  packIds: string[];
  customCommandIds: string[];
  targetLevel: TargetLevel;
  forceOverwrite: boolean;
  projectPath?: string;
}

interface DeploymentConfigStoreState {
  /** Per-agent configuration map */
  configs: Record<string, AgentDeploymentConfig>;
}

interface DeploymentConfigStoreActions {
  /** Get configuration for a specific agent */
  getAgentConfig: (agentId: string) => AgentDeploymentConfig;
  /** Set configuration for a specific agent */
  setAgentConfig: (agentId: string, config: Partial<AgentDeploymentConfig>) => void;
  /** Update pack IDs for an agent */
  setPackIds: (agentId: string, packIds: string[]) => void;
  /** Update custom command IDs for an agent */
  setCustomCommandIds: (agentId: string, commandIds: string[]) => void;
  /** Set target level for an agent */
  setTargetLevel: (agentId: string, level: TargetLevel) => void;
  /** Set force overwrite for an agent */
  setForceOverwrite: (agentId: string, force: boolean) => void;
  /** Set project path for an agent */
  setProjectPath: (agentId: string, path: string) => void;
  /** Reset configuration for a specific agent */
  resetAgentConfig: (agentId: string) => void;
  /** Get full DeploymentConfig for API calls */
  getDeploymentConfig: (agentId: string) => DeploymentConfig;
  /** Apply configuration from pack store */
  syncWithPackStore: (agentId: string, packIds: string[]) => void;
  /** Reset all configurations */
  resetAll: () => void;
}

const DEFAULT_CONFIG: AgentDeploymentConfig = {
  packIds: ['core', 'github-hygiene'],
  customCommandIds: [],
  targetLevel: 'user',
  forceOverwrite: false,
  projectPath: undefined,
};

export const useDeploymentConfigStore = create<DeploymentConfigStoreState & DeploymentConfigStoreActions>()(
  persist(
    (set, get) => ({
      configs: {},

      getAgentConfig: (agentId: string): AgentDeploymentConfig => {
        const { configs } = get();
        return configs[agentId] ?? { ...DEFAULT_CONFIG };
      },

      setAgentConfig: (agentId: string, config: Partial<AgentDeploymentConfig>) => {
        const { configs } = get();
        const existing = configs[agentId] ?? { ...DEFAULT_CONFIG };
        set({
          configs: {
            ...configs,
            [agentId]: { ...existing, ...config },
          },
        });
      },

      setPackIds: (agentId: string, packIds: string[]) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { packIds });
      },

      setCustomCommandIds: (agentId: string, commandIds: string[]) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { customCommandIds: commandIds });
      },

      setTargetLevel: (agentId: string, level: TargetLevel) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { targetLevel: level });
      },

      setForceOverwrite: (agentId: string, force: boolean) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { forceOverwrite: force });
      },

      setProjectPath: (agentId: string, path: string) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { projectPath: path });
      },

      resetAgentConfig: (agentId: string) => {
        const { configs } = get();
        const { [agentId]: _, ...remaining } = configs;
        set({ configs: remaining });
      },

      getDeploymentConfig: (agentId: string): DeploymentConfig => {
        const config = get().getAgentConfig(agentId);
        return {
          agentId,
          packIds: config.packIds,
          customCommandIds: config.customCommandIds,
          targetLevel: config.targetLevel,
          forceOverwrite: config.forceOverwrite,
          projectPath: config.projectPath,
        };
      },

      syncWithPackStore: (agentId: string, packIds: string[]) => {
        const { setAgentConfig } = get();
        setAgentConfig(agentId, { packIds });
      },

      resetAll: () => set({ configs: {} }),
    }),
    {
      name: 'deployment-config-store',
    }
  )
);
