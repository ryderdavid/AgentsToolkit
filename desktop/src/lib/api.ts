import { invoke } from '@tauri-apps/api/core';
import type { AgentDefinition, RulePack, LoadedPack, PackValidationResult, DependencyResolution } from './types';

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
};

// File system API
export const fsApi = {
  readAgentsMd: () => invoke<string>('read_agents_md'),
  writeAgentsMd: (content: string) => invoke<void>('write_agents_md', { content }),
  getAgentsMdHome: () => invoke<string>('get_agentsmd_home'),
  checkAgentInstalled: (agentId: string) => invoke<boolean>('check_agent_installed', { agentId }),
};

// Deployment API
export const deployApi = {
  createAgentLink: (agentId: string, force: boolean) => 
    invoke<[string, string | null]>('create_agent_link', { agentId, force }),
  removeAgentLink: (agentId: string) => invoke<void>('remove_agent_link', { agentId }),
  checkSymlinkSupport: () => invoke<[boolean, string]>('check_symlink_support'),
};
