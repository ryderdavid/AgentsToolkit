import { useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useAgentHealth, type HealthStatus } from '@/hooks/useAgentHealth';

interface AgentHealthIndicatorProps {
  agentId: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<HealthStatus, {
  color: string;
  bgColor: string;
  label: string;
}> = {
  healthy: {
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    label: 'Healthy',
  },
  warning: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    label: 'Warning',
  },
  error: {
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    label: 'Error',
  },
  unknown: {
    color: 'bg-gray-400',
    bgColor: 'bg-gray-100',
    label: 'Unknown',
  },
};

const sizeConfig = {
  sm: { dot: 'w-2 h-2', text: 'text-xs' },
  md: { dot: 'w-3 h-3', text: 'text-sm' },
  lg: { dot: 'w-4 h-4', text: 'text-base' },
};

export function AgentHealthIndicator({ 
  agentId, 
  showLabel = false,
  size = 'md'
}: AgentHealthIndicatorProps) {
  const { healthStatus, issues, isChecking, runHealthCheck } = useAgentHealth(agentId);
  const [showTooltip, setShowTooltip] = useState(false);

  const config = statusConfig[healthStatus];
  const sizeStyles = sizeConfig[size];

  return (
    <div className="relative inline-flex items-center gap-2">
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div 
          className={`${sizeStyles.dot} rounded-full ${config.color} ${
            healthStatus !== 'unknown' ? 'animate-pulse' : ''
          } transition-colors duration-300`}
        />
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[200px] max-w-[300px]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{config.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runHealthCheck();
                  }}
                  disabled={isChecking}
                  className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                  title="Run health check"
                >
                  <RefreshCw size={12} className={isChecking ? 'animate-spin' : ''} />
                </button>
              </div>
              
              {issues.length > 0 ? (
                <ul className="space-y-1">
                  {issues.slice(0, 3).map((issue) => (
                    <li key={issue.id} className="flex items-start gap-2">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        issue.severity === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                      }`} />
                      <span className="text-slate-300">{issue.message}</span>
                    </li>
                  ))}
                  {issues.length > 3 && (
                    <li className="text-slate-400 text-xs">
                      +{issues.length - 3} more issues
                    </li>
                  )}
                </ul>
              ) : (
                <p className="text-slate-300">No issues detected</p>
              )}
              
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
          </div>
        )}
      </div>

      {showLabel && (
        <span className={`${sizeStyles.text} text-slate-600`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

/** Standalone health check button */
export function HealthCheckButton({ agentId }: { agentId: string }) {
  const { isChecking, runHealthCheck, healthStatus } = useAgentHealth(agentId);
  const config = statusConfig[healthStatus];

  return (
    <button
      onClick={runHealthCheck}
      disabled={isChecking}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${config.bgColor} hover:opacity-80 disabled:opacity-50`}
    >
      <Activity size={14} className={isChecking ? 'animate-pulse' : ''} />
      {isChecking ? 'Checking...' : 'Run Health Check'}
    </button>
  );
}
