import { useCallback, useMemo } from 'react';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';
import { usePackStore } from '@/stores/packStore';
import type { DeploymentConfig, TargetLevel } from '@/lib/types';

interface UseDeploymentConfigReturn {
  /** Current configuration */
  config: {
    packIds: string[];
    customCommandIds: string[];
    targetLevel: TargetLevel;
    forceOverwrite: boolean;
    projectPath?: string;
  };
  /** Full deployment config for API calls */
  deploymentConfig: DeploymentConfig;
  /** Update pack IDs */
  setPackIds: (packIds: string[]) => void;
  /** Update custom command IDs */
  setCustomCommandIds: (commandIds: string[]) => void;
  /** Update target level */
  setTargetLevel: (level: TargetLevel) => void;
  /** Update force overwrite */
  setForceOverwrite: (force: boolean) => void;
  /** Update project path */
  setProjectPath: (path: string) => void;
  /** Update entire config */
  updateConfig: (partial: Partial<{
    packIds: string[];
    customCommandIds: string[];
    targetLevel: TargetLevel;
    forceOverwrite: boolean;
    projectPath?: string;
  }>) => void;
  /** Reset to defaults */
  resetConfig: () => void;
  /** Sync with global pack store */
  syncFromPackStore: () => void;
  /** Whether config is valid for deployment */
  isValid: boolean;
  /** Validation errors */
  validationErrors: string[];
}

export function useDeploymentConfig(agentId: string): UseDeploymentConfigReturn {
  const store = useDeploymentConfigStore();
  const packStore = usePackStore();

  const config = store.getAgentConfig(agentId);
  
  const deploymentConfig = useMemo((): DeploymentConfig => ({
    agentId,
    packIds: config.packIds,
    customCommandIds: config.customCommandIds,
    targetLevel: config.targetLevel,
    forceOverwrite: config.forceOverwrite,
    projectPath: config.projectPath,
  }), [agentId, config]);

  const setPackIds = useCallback((packIds: string[]) => {
    store.setPackIds(agentId, packIds);
  }, [agentId, store]);

  const setCustomCommandIds = useCallback((commandIds: string[]) => {
    store.setCustomCommandIds(agentId, commandIds);
  }, [agentId, store]);

  const setTargetLevel = useCallback((level: TargetLevel) => {
    store.setTargetLevel(agentId, level);
  }, [agentId, store]);

  const setForceOverwrite = useCallback((force: boolean) => {
    store.setForceOverwrite(agentId, force);
  }, [agentId, store]);

  const setProjectPath = useCallback((path: string) => {
    store.setProjectPath(agentId, path);
  }, [agentId, store]);

  const updateConfig = useCallback((partial: Partial<typeof config>) => {
    store.setAgentConfig(agentId, partial);
  }, [agentId, store]);

  const resetConfig = useCallback(() => {
    store.resetAgentConfig(agentId);
  }, [agentId, store]);

  const syncFromPackStore = useCallback(() => {
    store.syncWithPackStore(agentId, packStore.enabledPackIds);
  }, [agentId, store, packStore.enabledPackIds]);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (config.packIds.length === 0) {
      errors.push('At least one rule pack must be selected');
    }

    if (config.targetLevel === 'project' && !config.projectPath?.trim()) {
      errors.push('Project path is required for project-level deployment');
    }

    return errors;
  }, [config]);

  const isValid = validationErrors.length === 0;

  return {
    config,
    deploymentConfig,
    setPackIds,
    setCustomCommandIds,
    setTargetLevel,
    setForceOverwrite,
    setProjectPath,
    updateConfig,
    resetConfig,
    syncFromPackStore,
    isValid,
    validationErrors,
  };
}
