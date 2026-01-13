import { useEffect, useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import type { DeploymentOutput } from '@/lib/types';

export type DeploymentStep = 
  | 'preparing'
  | 'validating'
  | 'backing-up'
  | 'deploying'
  | 'complete'
  | 'error';

interface DeploymentProgressDialogProps {
  isOpen: boolean;
  agentName: string;
  currentStep: DeploymentStep;
  output: DeploymentOutput | null;
  error: string | null;
  onViewHistory?: () => void;
  onRollback?: () => void;
  onClose?: () => void;
}

const stepConfig: Record<DeploymentStep, { label: string; description: string }> = {
  preparing: {
    label: 'Preparing',
    description: 'Setting up deployment configuration...',
  },
  validating: {
    label: 'Validating',
    description: 'Checking configuration and dependencies...',
  },
  'backing-up': {
    label: 'Backing Up',
    description: 'Creating backup of existing files...',
  },
  deploying: {
    label: 'Deploying',
    description: 'Writing files to agent configuration...',
  },
  complete: {
    label: 'Complete',
    description: 'Deployment finished successfully!',
  },
  error: {
    label: 'Failed',
    description: 'Deployment encountered an error',
  },
};

const stepOrder: DeploymentStep[] = ['preparing', 'validating', 'backing-up', 'deploying', 'complete'];

export function DeploymentProgressDialog({
  isOpen,
  agentName,
  currentStep,
  output,
  error,
  onViewHistory,
  onRollback,
  onClose,
}: DeploymentProgressDialogProps) {
  const [canClose, setCanClose] = useState(false);

  // Allow closing only after completion or error
  useEffect(() => {
    setCanClose(currentStep === 'complete' || currentStep === 'error');
  }, [currentStep]);

  if (!isOpen) return null;

  const isActive = (step: DeploymentStep) => currentStep === step;
  const isComplete = (step: DeploymentStep) => {
    if (currentStep === 'error') return false;
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    return stepIndex < currentIndex;
  };
  const isPending = (step: DeploymentStep) => {
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    return stepIndex > currentIndex && currentStep !== 'error';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[500px] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">
            Deploying to {agentName}
          </h2>
        </div>

        {/* Progress steps */}
        <div className="px-6 py-6">
          <div className="space-y-4">
            {stepOrder.slice(0, -1).map((step, index) => {
              const config = stepConfig[step];
              const active = isActive(step);
              const complete = isComplete(step);
              const pending = isPending(step);

              return (
                <div 
                  key={step}
                  className={`flex items-start gap-4 ${pending ? 'opacity-40' : ''}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {complete ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : active ? (
                      <Loader2 size={20} className="text-blue-500 animate-spin" />
                    ) : currentStep === 'error' && index === stepOrder.indexOf(currentStep) ? (
                      <XCircle size={20} className="text-red-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${active ? 'text-blue-600' : ''}`}>
                      {config.label}
                    </p>
                    <p className="text-sm text-slate-500">
                      {config.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Success state */}
        {currentStep === 'complete' && output && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                <CheckCircle size={16} />
                Deployment Successful
              </div>
              
              {/* Deployed files */}
              {output.deployedFiles.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-green-600 mb-1">Files deployed:</p>
                  <ul className="text-xs text-green-700 font-mono space-y-1">
                    {output.deployedFiles.slice(0, 3).map(file => (
                      <li key={file} className="truncate">• {file}</li>
                    ))}
                    {output.deployedFiles.length > 3 && (
                      <li className="text-green-600">
                        +{output.deployedFiles.length - 3} more files
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {output.warnings.length > 0 && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-center gap-1 text-yellow-700 text-sm font-medium">
                    <AlertTriangle size={12} />
                    Warnings
                  </div>
                  <ul className="mt-1 text-xs text-yellow-600 space-y-1">
                    {output.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manual steps */}
              {output.manualSteps.length > 0 && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-700 font-medium">Manual steps required:</p>
                  <ol className="mt-1 text-xs text-blue-600 space-y-1 list-decimal list-inside">
                    {output.manualSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {currentStep === 'error' && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <XCircle size={16} />
                Deployment Failed
              </div>
              <p className="text-sm text-red-600">
                {error || 'An unknown error occurred during deployment.'}
              </p>
              {output?.errors && output.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 space-y-1">
                  {output.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 rounded-b-xl flex items-center justify-between">
          <div>
            {currentStep === 'error' && onRollback && (
              <button
                onClick={onRollback}
                className="flex items-center gap-2 px-4 py-2 text-sm text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 transition-colors"
              >
                <RotateCcw size={14} />
                Rollback Changes
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {currentStep === 'complete' && onViewHistory && (
              <button
                onClick={onViewHistory}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ExternalLink size={14} />
                View History
              </button>
            )}
            {canClose && onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
