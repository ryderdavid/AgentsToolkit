import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, X } from 'lucide-react';

export interface DeploymentActivity {
  agentId: string;
  agentName: string;
  step: 'preparing' | 'validating' | 'backing-up' | 'deploying' | 'complete' | 'error';
  progress?: number;
  message?: string;
}

interface DeploymentStatusIndicatorProps {
  activities: DeploymentActivity[];
  onDismiss?: (agentId: string) => void;
  onDismissAll?: () => void;
}

const stepLabels: Record<DeploymentActivity['step'], string> = {
  preparing: 'Preparing...',
  validating: 'Validating...',
  'backing-up': 'Backing up...',
  deploying: 'Deploying...',
  complete: 'Complete',
  error: 'Failed',
};

export function DeploymentStatusIndicator({ 
  activities, 
  onDismiss, 
  onDismissAll 
}: DeploymentStatusIndicatorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleActivities = activities.filter(a => !dismissed.has(a.agentId));
  const activeCount = visibleActivities.filter(
    a => !['complete', 'error'].includes(a.step)
  ).length;
  const hasErrors = visibleActivities.some(a => a.step === 'error');

  useEffect(() => {
    // Auto-expand when new activities start
    if (activeCount > 0) {
      setIsMinimized(false);
    }
  }, [activeCount]);

  if (visibleActivities.length === 0) {
    return null;
  }

  const handleDismiss = (agentId: string) => {
    setDismissed(prev => new Set(prev).add(agentId));
    onDismiss?.(agentId);
  };

  const handleDismissAll = () => {
    setDismissed(new Set(visibleActivities.map(a => a.agentId)));
    onDismissAll?.();
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
          activeCount > 0
            ? 'bg-blue-500 text-white animate-pulse'
            : hasErrors
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        }`}
      >
        {activeCount > 0 ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>{activeCount} deployment{activeCount !== 1 ? 's' : ''} in progress</span>
          </>
        ) : hasErrors ? (
          <>
            <XCircle size={16} />
            <span>Deployment errors</span>
          </>
        ) : (
          <>
            <CheckCircle size={16} />
            <span>Deployments complete</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Loader2 size={14} className="animate-spin text-blue-500" />
          )}
          <span className="font-medium text-sm">
            Deployment Activity
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"
            title="Minimize"
          >
            <span className="text-xs">−</span>
          </button>
          <button
            onClick={handleDismissAll}
            className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500"
            title="Dismiss all"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Activity list */}
      <div className="max-h-64 overflow-y-auto">
        {visibleActivities.map((activity) => (
          <div
            key={activity.agentId}
            className="px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {activity.agentName}
                  </span>
                  {activity.step === 'complete' && (
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                  )}
                  {activity.step === 'error' && (
                    <XCircle size={14} className="text-red-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activity.message || stepLabels[activity.step]}
                </p>
              </div>
              {['complete', 'error'].includes(activity.step) && (
                <button
                  onClick={() => handleDismiss(activity.agentId)}
                  className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Progress bar for active deployments */}
            {!['complete', 'error'].includes(activity.step) && (
              <div className="mt-2">
                <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ 
                      width: activity.progress !== undefined 
                        ? `${activity.progress}%` 
                        : '30%'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple inline status for card display */
export function InlineDeploymentStatus({ 
  isDeploying, 
  step 
}: { 
  isDeploying: boolean; 
  step?: DeploymentActivity['step'];
}) {
  if (!isDeploying) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-blue-600">
      <Loader2 size={14} className="animate-spin" />
      <span>{step ? stepLabels[step] : 'Deploying...'}</span>
    </div>
  );
}
