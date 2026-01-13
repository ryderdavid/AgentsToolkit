import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deploymentApi } from '@/lib/api';
import type { 
  DeploymentConfig, 
  DeploymentOutput, 
  PreparedDeployment, 
  ValidationReport 
} from '@/lib/types';

/** Deployment workflow states */
export type DeploymentState = 
  | 'idle'
  | 'validating'
  | 'previewing'
  | 'deploying'
  | 'success'
  | 'error';

export interface DeploymentError {
  message: string;
  details?: string[];
  recoverable: boolean;
}

interface UseAgentDeploymentReturn {
  /** Current deployment state */
  state: DeploymentState;
  /** Error information if state is 'error' */
  error: DeploymentError | null;
  /** Last validation report */
  validationReport: ValidationReport | null;
  /** Last deployment preview */
  preview: PreparedDeployment | null;
  /** Last deployment output */
  deploymentOutput: DeploymentOutput | null;
  /** Whether any operation is in progress */
  isLoading: boolean;
  /** Validate deployment configuration */
  validateDeployment: (agentId: string, config: DeploymentConfig) => Promise<ValidationReport | null>;
  /** Preview deployment without executing */
  previewDeployment: (agentId: string, config: DeploymentConfig) => Promise<PreparedDeployment | null>;
  /** Execute deployment */
  deployToAgent: (agentId: string, config: DeploymentConfig) => Promise<DeploymentOutput | null>;
  /** Rollback a deployment */
  rollbackDeployment: (agentId: string, timestamp?: string) => Promise<boolean>;
  /** Reset state to idle */
  reset: () => void;
}

export function useAgentDeployment(): UseAgentDeploymentReturn {
  const queryClient = useQueryClient();
  const [state, setState] = useState<DeploymentState>('idle');
  const [error, setError] = useState<DeploymentError | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [preview, setPreview] = useState<PreparedDeployment | null>(null);
  const [deploymentOutput, setDeploymentOutput] = useState<DeploymentOutput | null>(null);

  const isLoading = ['validating', 'previewing', 'deploying'].includes(state);

  const parseError = useCallback((err: unknown): DeploymentError => {
    if (err instanceof Error) {
      return {
        message: err.message,
        recoverable: true,
      };
    }
    if (typeof err === 'string') {
      return {
        message: err,
        recoverable: true,
      };
    }
    return {
      message: 'An unknown error occurred',
      recoverable: false,
    };
  }, []);

  const validateDeployment = useCallback(async (
    agentId: string, 
    config: DeploymentConfig
  ): Promise<ValidationReport | null> => {
    setState('validating');
    setError(null);
    
    try {
      const report = await deploymentApi.validateDeployment(agentId, config);
      setValidationReport(report);
      setState('idle');
      return report;
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setState('error');
      return null;
    }
  }, [parseError]);

  const previewDeployment = useCallback(async (
    agentId: string, 
    config: DeploymentConfig
  ): Promise<PreparedDeployment | null> => {
    setState('previewing');
    setError(null);
    
    try {
      const previewResult = await deploymentApi.previewDeployment(agentId, config);
      setPreview(previewResult);
      setState('idle');
      return previewResult;
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setState('error');
      return null;
    }
  }, [parseError]);

  const deployToAgent = useCallback(async (
    agentId: string, 
    config: DeploymentConfig
  ): Promise<DeploymentOutput | null> => {
    setState('deploying');
    setError(null);
    
    try {
      const output = await deploymentApi.deployToAgent(agentId, config);
      setDeploymentOutput(output);
      
      if (output.success) {
        setState('success');
        // Invalidate relevant queries to refresh status
        queryClient.invalidateQueries({ queryKey: ['agent-status', agentId] });
        queryClient.invalidateQueries({ queryKey: ['agent-installed', agentId] });
        queryClient.invalidateQueries({ queryKey: ['deployment-history', agentId] });
      } else {
        setError({
          message: 'Deployment failed',
          details: output.errors,
          recoverable: true,
        });
        setState('error');
      }
      
      return output;
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setState('error');
      return null;
    }
  }, [parseError, queryClient]);

  const rollbackDeployment = useCallback(async (
    agentId: string, 
    timestamp?: string
  ): Promise<boolean> => {
    setState('deploying');
    setError(null);
    
    try {
      await deploymentApi.rollbackDeployment(agentId, timestamp);
      setState('success');
      // Invalidate queries to refresh status
      queryClient.invalidateQueries({ queryKey: ['agent-status', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent-installed', agentId] });
      queryClient.invalidateQueries({ queryKey: ['deployment-history', agentId] });
      return true;
    } catch (err) {
      const parsedError = parseError(err);
      setError(parsedError);
      setState('error');
      return false;
    }
  }, [parseError, queryClient]);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setValidationReport(null);
    setPreview(null);
    setDeploymentOutput(null);
  }, []);

  return {
    state,
    error,
    validationReport,
    preview,
    deploymentOutput,
    isLoading,
    validateDeployment,
    previewDeployment,
    deployToAgent,
    rollbackDeployment,
    reset,
  };
}
