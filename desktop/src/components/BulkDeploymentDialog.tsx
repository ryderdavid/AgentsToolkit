import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  SkipForward
} from 'lucide-react';
import { useAgentDeployment } from '@/hooks/useAgentDeployment';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';
import type { AgentDefinition } from '@/lib/types';

interface BulkDeploymentDialogProps {
  isOpen: boolean;
  agents: AgentDefinition[];
  onClose: () => void;
  onComplete: (results: BulkDeploymentResult[]) => void;
}

export interface BulkDeploymentResult {
  agentId: string;
  agentName: string;
  success: boolean;
  error?: string;
}

type DeploymentPhase = 'preview' | 'deploying' | 'complete';

export function BulkDeploymentDialog({
  isOpen,
  agents,
  onClose,
  onComplete,
}: BulkDeploymentDialogProps) {
  const [phase, setPhase] = useState<DeploymentPhase>('preview');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<BulkDeploymentResult[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [continueOnError, setContinueOnError] = useState(true);

  const { deployToAgent, reset: resetDeployment } = useAgentDeployment();
  const configStore = useDeploymentConfigStore();

  const currentAgent = agents[currentIndex];
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  const deployNext = useCallback(async () => {
    if (currentIndex >= agents.length) {
      setPhase('complete');
      onComplete(results);
      return;
    }

    const agent = agents[currentIndex];
    const config = configStore.getDeploymentConfig(agent.id);

    try {
      const output = await deployToAgent(agent.id, config);
      
      const result: BulkDeploymentResult = {
        agentId: agent.id,
        agentName: agent.name,
        success: output?.success ?? false,
        error: output?.errors?.join(', '),
      };

      setResults(prev => [...prev, result]);

      if (!result.success && !continueOnError) {
        setPhase('complete');
        onComplete([...results, result]);
        return;
      }

      setCurrentIndex(prev => prev + 1);
      resetDeployment();
    } catch (err) {
      const result: BulkDeploymentResult = {
        agentId: agent.id,
        agentName: agent.name,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };

      setResults(prev => [...prev, result]);

      if (!continueOnError) {
        setPhase('complete');
        onComplete([...results, result]);
        return;
      }

      setCurrentIndex(prev => prev + 1);
      resetDeployment();
    }
  }, [currentIndex, agents, configStore, deployToAgent, resetDeployment, continueOnError, results, onComplete]);

  useEffect(() => {
    if (phase === 'deploying' && !isPaused) {
      deployNext();
    }
  }, [phase, isPaused, currentIndex, deployNext]);

  useEffect(() => {
    if (isOpen) {
      setPhase('preview');
      setCurrentIndex(0);
      setResults([]);
      setIsPaused(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartDeployment = () => {
    setPhase('deploying');
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleSkip = () => {
    const result: BulkDeploymentResult = {
      agentId: currentAgent.id,
      agentName: currentAgent.name,
      success: false,
      error: 'Skipped by user',
    };
    setResults(prev => [...prev, result]);
    setCurrentIndex(prev => prev + 1);
  };

  const estimatedTime = agents.length * 3; // ~3 seconds per deployment

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[600px] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Bulk Deployment</h2>
            <p className="text-sm text-slate-500">
              Deploy to {agents.length} agent{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
          {phase !== 'deploying' && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'preview' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  The following agents will be deployed to sequentially:
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Estimated time: ~{estimatedTime} seconds
                </p>
              </div>

              <div className="space-y-2">
                {agents.map((agent, index) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="w-6 h-6 flex items-center justify-center text-xs bg-slate-200 rounded-full">
                      {index + 1}
                    </span>
                    <span className="font-medium text-sm">{agent.name}</span>
                    <span className="text-xs text-slate-400">{agent.id}</span>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={continueOnError}
                  onChange={(e) => setContinueOnError(e.target.checked)}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-medium text-yellow-800">
                    Continue on error
                  </span>
                  <p className="text-xs text-yellow-600">
                    If a deployment fails, continue with remaining agents
                  </p>
                </div>
              </label>
            </div>
          )}

          {phase === 'deploying' && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {currentIndex + 1} / {agents.length}
                </p>
                <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / agents.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current agent */}
              {currentAgent && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                    <div>
                      <p className="font-medium">Deploying to {currentAgent.name}...</p>
                      <p className="text-sm text-slate-500">{currentAgent.id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results so far */}
              {results.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Completed:</h4>
                  {results.map((result) => (
                    <div
                      key={result.agentId}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        result.success 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-500" />
                        )}
                        <span className="text-sm font-medium">{result.agentName}</span>
                      </div>
                      {result.error && (
                        <span className="text-xs text-red-600 truncate max-w-[200px]">
                          {result.error}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'complete' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">{successCount}</p>
                  <p className="text-sm text-green-600">Successful</p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <XCircle size={24} className="text-red-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-700">{failCount}</p>
                  <p className="text-sm text-red-600">Failed</p>
                </div>
              </div>

              {/* Full results */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Results:</h4>
                {results.map((result) => (
                  <div
                    key={result.agentId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.success 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                      <span className="text-sm font-medium">{result.agentName}</span>
                    </div>
                    {result.error && (
                      <span className="text-xs text-red-600 truncate max-w-[200px]">
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50 rounded-b-xl">
          {phase === 'preview' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStartDeployment}
                className="flex items-center gap-2 px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Play size={14} />
                Start Deployment
              </button>
            </>
          )}

          {phase === 'deploying' && (
            <>
              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    onClick={handleResume}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Play size={14} />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Pause size={14} />
                    Pause
                  </button>
                )}
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-white transition-colors"
                >
                  <SkipForward size={14} />
                  Skip Current
                </button>
              </div>
              <div className="text-sm text-slate-500">
                {successCount} completed, {failCount} failed
              </div>
            </>
          )}

          {phase === 'complete' && (
            <>
              <div className="text-sm text-slate-500">
                Deployment complete
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
