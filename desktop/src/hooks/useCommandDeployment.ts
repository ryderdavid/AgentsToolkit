import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { commandApi, type CommandMetadata, type CommandBudgetInfo } from '@/lib/commands';
import { deploymentApi } from '@/lib/api';
import type { DeploymentConfig, DeploymentOutput, ValidationReport } from '@/lib/types';

interface UseCommandDeploymentResult {
  /** Deploy commands to an agent */
  deployCommands: (agentId: string, commandIds: string[]) => Promise<DeploymentOutput>;
  /** Validate commands for an agent */
  validateCommands: (agentId: string, commandIds: string[]) => Promise<ValidationReport>;
  /** Preview what the deployment would look like */
  previewCommands: (agentId: string, commandIds: string[]) => Promise<CommandPreview>;
  /** Loading state */
  isLoading: boolean;
  /** Current error */
  error: Error | null;
  /** Reset error state */
  clearError: () => void;
}

interface CommandPreview {
  commands: Array<{
    id: string;
    name: string;
    formattedContent: string;
    characterCount: number;
  }>;
  totalCharacters: number;
  compatibilityWarnings: string[];
}

export function useCommandDeployment(): UseCommandDeploymentResult {
  const [error, setError] = useState<Error | null>(null);

  const deployMutation = useMutation({
    mutationFn: async ({ agentId, commandIds }: { agentId: string; commandIds: string[] }) => {
      const config: DeploymentConfig = {
        agentId,
        packIds: [], // Commands-only deployment
        customCommandIds: commandIds,
        targetLevel: 'user',
        forceOverwrite: false,
      };
      return deploymentApi.deployToAgent(agentId, config);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
    },
  });

  const validateMutation = useMutation({
    mutationFn: async ({ agentId, commandIds }: { agentId: string; commandIds: string[] }) => {
      const config: DeploymentConfig = {
        agentId,
        packIds: [],
        customCommandIds: commandIds,
        targetLevel: 'user',
        forceOverwrite: false,
      };
      return deploymentApi.validateDeployment(agentId, config);
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
    },
  });

  const deployCommands = useCallback(
    async (agentId: string, commandIds: string[]): Promise<DeploymentOutput> => {
      return deployMutation.mutateAsync({ agentId, commandIds });
    },
    [deployMutation]
  );

  const validateCommands = useCallback(
    async (agentId: string, commandIds: string[]): Promise<ValidationReport> => {
      return validateMutation.mutateAsync({ agentId, commandIds });
    },
    [validateMutation]
  );

  const previewCommands = useCallback(
    async (agentId: string, commandIds: string[]): Promise<CommandPreview> => {
      const commands: CommandPreview['commands'] = [];
      const compatibilityWarnings: string[] = [];
      let totalCharacters = 0;

      for (const commandId of commandIds) {
        try {
          const command = await commandApi.getCommandById(commandId);
          const content = await commandApi.loadCommandContent(commandId);
          
          // Check compatibility
          const compatibility = await commandApi.validateCommandForAgent(commandId, agentId);
          if (!compatibility.compatible && compatibility.reason) {
            compatibilityWarnings.push(compatibility.reason);
          }

          commands.push({
            id: command.id,
            name: command.name,
            formattedContent: content,
            characterCount: command.characterCount,
          });
          totalCharacters += command.characterCount;
        } catch (err) {
          compatibilityWarnings.push(`Failed to load command ${commandId}: ${err}`);
        }
      }

      return {
        commands,
        totalCharacters,
        compatibilityWarnings,
      };
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    deployCommands,
    validateCommands,
    previewCommands,
    isLoading: deployMutation.isPending || validateMutation.isPending,
    error,
    clearError,
  };
}
