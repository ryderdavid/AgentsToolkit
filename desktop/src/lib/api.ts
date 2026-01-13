import { invoke } from '@tauri-apps/api/core';
import type {
  AgentDefinition,
  RulePack,
  LoadedPack,
  PackValidationResult,
  DependencyResolution,
  BudgetInfo,
  ValidationResult,
  GenerateResult,
  DeploymentConfig,
  DeploymentOutput,
  PreparedDeployment,
  ValidationReport,
  AgentStatus,
  DeploymentState,
} from './types';

// Agent registry API
export const agentApi = {
  getAllAgents: () => invoke<AgentDefinition[]>('get_all_agents'),
  getAgentById: (id: string) => invoke<AgentDefinition | null>('get_agent_by_id', { id }),
  validateAgent: (agent: AgentDefinition) => invoke<void>('validate_agent', { agent }),
};

// Rule pack API
export const packApi = {
  listAvailablePacks: () => invoke<RulePack[]>('list_available_packs'),
  loadPack: (packId: string) => invoke<RulePack>('load_pack', { packId }),
  loadPackFull: (packId: string) => invoke<LoadedPack>('load_pack_full', { packId }),
  validatePack: (packId: string) => invoke<PackValidationResult>('validate_pack', { packId }),
  resolveDependencies: (packId: string) => invoke<DependencyResolution>('resolve_dependencies', { packId }),
  loadPackFile: (packId: string, file: string) =>
    invoke<string>('load_pack_file', { packId, file }),
  calculateBudget: (packIds: string[], agentId?: string | null) =>
    invoke<BudgetInfo>('calculate_budget', { packIds, agentId }),
  validateComposition: (packIds: string[], agentId?: string | null) =>
    invoke<ValidationResult>('validate_composition', { packIds, agentId }),
  generateAgentsMd: (options: {
    packIds: string[];
    includeMetadata?: boolean;
    inlineContent?: boolean;
  }) =>
    invoke<GenerateResult>('generate_agents_md', {
      packIds: options.packIds,
      includeMetadata: options.includeMetadata,
      inlineContent: options.inlineContent,
    }),
};

// File system API
export const fsApi = {
  readAgentsMd: () => invoke<string>('read_agents_md'),
  writeAgentsMd: (content: string) => invoke<void>('write_agents_md', { content }),
  getAgentsMdHome: () => invoke<string>('get_agentsmd_home'),
  checkAgentInstalled: (agentId: string) => invoke<boolean>('check_agent_installed', { agentId }),
};

// Legacy symlink API
export const symlinkApi = {
  createAgentLink: (agentId: string, force: boolean) => 
    invoke<[string, string | null]>('create_agent_link', { agentId, force }),
  removeAgentLink: (agentId: string) => invoke<void>('remove_agent_link', { agentId }),
  checkSymlinkSupport: () => invoke<[boolean, string]>('check_symlink_support'),
};

// Deployment API
export const deploymentApi = {
  /** Deploy to a specific agent */
  deployToAgent: (agentId: string, config: DeploymentConfig) =>
    invoke<DeploymentOutput>('deploy_to_agent', { agentId, config }),
  
  /** Validate a deployment without executing it */
  validateDeployment: (agentId: string, config: DeploymentConfig) =>
    invoke<ValidationReport>('validate_deployment', { agentId, config }),
  
  /** Rollback a deployment */
  rollbackDeployment: (agentId: string, timestamp?: string) =>
    invoke<void>('rollback_deployment', { agentId, timestamp }),
  
  /** Get deployment status for an agent */
  getDeploymentStatus: (agentId: string) =>
    invoke<AgentStatus>('get_deployment_status', { agentId }),
  
  /** Get deployment history for an agent */
  getDeploymentHistory: (agentId: string) =>
    invoke<DeploymentState[]>('get_deployment_history', { agentId }),
  
  /** Preview a deployment without executing it */
  previewDeployment: (agentId: string, config: DeploymentConfig) =>
    invoke<PreparedDeployment>('preview_deployment', { agentId, config }),
  
  /** Get all available agents for deployment */
  getDeployableAgents: () =>
    invoke<string[]>('get_deployable_agents'),
};

// Keep old export for backwards compatibility
export const deployApi = symlinkApi;
