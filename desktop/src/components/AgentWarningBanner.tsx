import { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, X, ExternalLink } from 'lucide-react';
import type { AgentWarning, WarningSeverity } from '@/lib/agentWarnings';

interface AgentWarningBannerProps {
  warnings: AgentWarning[];
  agentId: string;
  compact?: boolean;
  maxVisible?: number;
}

const DISMISSED_WARNINGS_KEY = 'agents-toolkit-dismissed-warnings';

function getDismissedWarnings(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED_WARNINGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setDismissedWarning(warningId: string) {
  const current = getDismissedWarnings();
  if (!current.includes(warningId)) {
    localStorage.setItem(DISMISSED_WARNINGS_KEY, JSON.stringify([...current, warningId]));
  }
}

const severityConfig: Record<WarningSeverity, {
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
}> = {
  info: {
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: Info,
  },
  warning: {
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    icon: AlertCircle,
  },
  critical: {
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: AlertTriangle,
  },
};

export function AgentWarningBanner({ 
  warnings, 
  agentId, 
  compact = false,
  maxVisible = 3 
}: AgentWarningBannerProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setDismissedIds(getDismissedWarnings());
  }, []);

  const visibleWarnings = warnings.filter(
    w => !dismissedIds.includes(w.id) || !w.autoDismissable
  );

  if (visibleWarnings.length === 0) {
    return null;
  }

  const handleDismiss = (warningId: string) => {
    setDismissedWarning(warningId);
    setDismissedIds(prev => [...prev, warningId]);
  };

  const displayWarnings = isExpanded 
    ? visibleWarnings 
    : visibleWarnings.slice(0, maxVisible);
  
  const remainingCount = visibleWarnings.length - maxVisible;

  if (compact) {
    const highestSeverity = visibleWarnings.reduce((highest, w) => {
      const order: Record<WarningSeverity, number> = { info: 0, warning: 1, critical: 2 };
      return order[w.severity] > order[highest] ? w.severity : highest;
    }, 'info' as WarningSeverity);

    const config = severityConfig[highestSeverity];
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${config.bgColor} ${config.textColor}`}>
        <Icon size={12} />
        <span>{visibleWarnings.length} warning{visibleWarnings.length !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-in fade-in duration-300">
      {displayWarnings.map((warning) => {
        const config = severityConfig[warning.severity];
        const Icon = config.icon;

        return (
          <div
            key={warning.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${config.bgColor} ${config.borderColor} ${config.textColor} animate-in slide-in-from-top-2 duration-200`}
          >
            <Icon size={16} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{warning.message}</p>
              {warning.detail && (
                <p className="text-xs mt-1 opacity-80">{warning.detail}</p>
              )}
              {warning.learnMoreUrl && (
                <a
                  href={warning.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                >
                  Learn more <ExternalLink size={10} />
                </a>
              )}
            </div>
            {warning.autoDismissable && (
              <button
                onClick={() => handleDismiss(warning.id)}
                className="p-1 hover:bg-black/10 rounded transition-colors"
                aria-label="Dismiss warning"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}

      {remainingCount > 0 && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          Show {remainingCount} more warning{remainingCount !== 1 ? 's' : ''}
        </button>
      )}

      {isExpanded && visibleWarnings.length > maxVisible && (
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}

/** Badge showing warning count */
export function WarningCountBadge({ warnings }: { warnings: AgentWarning[] }) {
  if (warnings.length === 0) return null;

  const criticalCount = warnings.filter(w => w.severity === 'critical').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  if (criticalCount > 0) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
        {criticalCount}
      </span>
    );
  }

  if (warningCount > 0) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-yellow-500 rounded-full">
        {warningCount}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
      {warnings.length}
    </span>
  );
}
