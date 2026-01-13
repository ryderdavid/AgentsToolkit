import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { packApi } from '@/lib/api';

type PackStoreState = {
  enabledPackIds: string[];
  selectedAgentId: string | null;
};

type PackStoreActions = {
  togglePack: (packId: string) => Promise<void>;
  setSelectedAgent: (agentId: string | null) => void;
  enablePacks: (packIds: string[]) => Promise<void>;
  disablePacks: (packIds: string[]) => void;
  reset: () => void;
  getEnabledPacks: () => string[];
};

const DEFAULT_ENABLED = ['core', 'github-hygiene'];

function uniqueMerge(existing: string[], incoming: string[]): string[] {
  const merged = new Set(existing);
  incoming.forEach(id => merged.add(id));
  return Array.from(merged);
}

export const usePackStore = create<PackStoreState & PackStoreActions>()(
  persist(
    (set, get) => ({
      enabledPackIds: DEFAULT_ENABLED,
      selectedAgentId: 'cursor',

      togglePack: async (packId: string) => {
        const { enabledPackIds } = get();
        const isEnabled = enabledPackIds.includes(packId);

        if (isEnabled) {
          set({ enabledPackIds: enabledPackIds.filter(id => id !== packId) });
          return;
        }

        const resolution = await packApi.resolveDependencies(packId);
        if (!resolution.success) {
          throw new Error(resolution.error || 'Failed to resolve dependencies');
        }

        set({
          enabledPackIds: uniqueMerge(enabledPackIds, resolution.order),
        });
      },

      enablePacks: async (packIds: string[]) => {
        const { enabledPackIds } = get();
        const resolvedIds: string[] = [];

        for (const id of packIds) {
          const resolution = await packApi.resolveDependencies(id);
          if (resolution.success) {
            resolvedIds.push(...resolution.order);
          }
        }

        set({ enabledPackIds: uniqueMerge(enabledPackIds, resolvedIds) });
      },

      disablePacks: (packIds: string[]) => {
        const disabledSet = new Set(packIds);
        set({
          enabledPackIds: get().enabledPackIds.filter(id => !disabledSet.has(id)),
        });
      },

      setSelectedAgent: (agentId: string | null) => set({ selectedAgentId: agentId }),

      reset: () => set({ enabledPackIds: DEFAULT_ENABLED, selectedAgentId: 'cursor' }),

      getEnabledPacks: () => get().enabledPackIds,
    }),
    {
      name: 'pack-store',
    }
  )
);
