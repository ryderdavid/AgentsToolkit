import { useState } from 'react';
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Wrench,
  FileCheck,
  Link,
  FileText
} from 'lucide-react';
import { useAgentHealth, type HealthIssue } from '@/hooks/useAgentHealth';

interface AgentHealthCheckProps {
  agentId: string;
  agentName: string;
  onFixIssues?: (issues: HealthIssue[]) => void;
}

export function AgentHealthCheck({ 
  agentId, 
  agentName,
  onFixIssues 
}: AgentHealthCheckProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { 
    healthStatus, 
    issues, 
    isChecking, 
    runHealthCheck, 
    result 
  } = useAgentHealth(agentId);

  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      label: 'All checks passed',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      label: 'Some warnings detected',
    },
    error: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      label: 'Issues found',
    },
    unknown: {
      icon: Activity,
      color: 'text-gray-400',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      label: 'Not checked',
    },
  };

  const config = statusConfig[healthStatus];
  const StatusIcon = config.icon;
  const autoFixableIssues = issues.filter(i => i.autoFixable);

  return (
    <div className={`border rounded-lg ${config.borderColor} ${config.bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <StatusIcon size={20} className={config.color} />
          <div className="text-left">
            <p className="font-medium text-sm">{agentName} Health</p>
            <p className="text-xs text-slate-500">{config.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {issues.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-white rounded-full">
              {issues.length} issue{issues.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              runHealthCheck();
            }}
            disabled={isChecking}
            className="p-1.5 hover:bg-white rounded transition-colors"
            title="Run health check"
          >
            <RefreshCw 
              size={14} 
              className={`${isChecking ? 'animate-spin text-blue-500' : 'text-slate-400'}`} 
            />
          </button>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-current/10">
          {/* Health check items */}
          <div className="mt-4 space-y-3">
            <HealthCheckItem
              label="Config Files"
              description="Agent configuration files exist"
              status={result?.configFileExists ? 'pass' : 'fail'}
              icon={FileCheck}
            />
            <HealthCheckItem
              label="Symlinks Valid"
              description="Symbolic links are properly configured"
              status={result?.symlinkValid ? 'pass' : 'warn'}
              icon={Link}
            />
            <HealthCheckItem
              label="Format Valid"
              description="AGENTS.md format is correct"
              status={result?.formatValid ? 'pass' : 'fail'}
              icon={FileText}
            />
          </div>

          {/* Issues list */}
          {issues.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Issues</h4>
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div 
                    key={issue.id}
                    className={`p-3 rounded-lg border ${
                      issue.severity === 'error' 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error' ? (
                        <XCircle size={14} className="mt-0.5 text-red-500" />
                      ) : (
                        <AlertTriangle size={14} className="mt-0.5 text-yellow-500" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {issue.message}
                        </p>
                        {issue.suggestion && (
                          <p className="text-xs text-slate-600 mt-1">
                            Suggestion: {issue.suggestion}
                          </p>
                        )}
                        {issue.autoFixable && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            Auto-fixable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {autoFixableIssues.length > 0 && onFixIssues && (
            <div className="mt-4 pt-4 border-t border-current/10">
              <button
                onClick={() => onFixIssues(autoFixableIssues)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-white border rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Wrench size={14} />
                Fix {autoFixableIssues.length} issue{autoFixableIssues.length !== 1 ? 's' : ''} automatically
              </button>
            </div>
          )}

          {/* Last checked */}
          {result?.lastChecked && (
            <p className="mt-4 text-xs text-slate-400 text-center">
              Last checked: {result.lastChecked.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface HealthCheckItemProps {
  label: string;
  description: string;
  status: 'pass' | 'warn' | 'fail';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

function HealthCheckItem({ label, description, status, icon: Icon }: HealthCheckItemProps) {
  const statusStyles = {
    pass: { color: 'text-green-500', bg: 'bg-green-100' },
    warn: { color: 'text-yellow-500', bg: 'bg-yellow-100' },
    fail: { color: 'text-red-500', bg: 'bg-red-100' },
  };

  const styles = statusStyles[status];

  return (
    <div className="flex items-center gap-3 p-2 bg-white rounded-lg">
      <div className={`p-2 rounded-lg ${styles.bg}`}>
        <Icon size={14} className={styles.color} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div>
        {status === 'pass' && <CheckCircle size={16} className="text-green-500" />}
        {status === 'warn' && <AlertTriangle size={16} className="text-yellow-500" />}
        {status === 'fail' && <XCircle size={16} className="text-red-500" />}
      </div>
    </div>
  );
}
