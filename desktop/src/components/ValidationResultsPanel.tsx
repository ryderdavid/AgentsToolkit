import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Wrench } from 'lucide-react';
import type { ValidationReport, BudgetUsage } from '@/lib/types';
import { CharacterBudget } from './CharacterBudget';

interface ValidationResultsPanelProps {
  report: ValidationReport | null;
  isValidating?: boolean;
  onRevalidate?: () => void;
  onAutoFix?: () => void;
  showBudget?: boolean;
}

export function ValidationResultsPanel({
  report,
  isValidating = false,
  onRevalidate,
  onAutoFix,
  showBudget = true,
}: ValidationResultsPanelProps) {
  if (!report && !isValidating) {
    return null;
  }

  const hasErrors = report && report.errors.length > 0;
  const hasWarnings = report && report.warnings.length > 0;
  const isValid = report?.valid ?? false;

  // Determine overall status
  let statusColor = 'bg-green-50 border-green-200';
  let statusIcon = <CheckCircle className="text-green-500" size={20} />;
  let statusText = 'Validation Passed';

  if (isValidating) {
    statusColor = 'bg-blue-50 border-blue-200';
    statusIcon = <RefreshCw className="text-blue-500 animate-spin" size={20} />;
    statusText = 'Validating...';
  } else if (hasErrors) {
    statusColor = 'bg-red-50 border-red-200';
    statusIcon = <XCircle className="text-red-500" size={20} />;
    statusText = 'Validation Failed';
  } else if (hasWarnings) {
    statusColor = 'bg-yellow-50 border-yellow-200';
    statusIcon = <AlertTriangle className="text-yellow-500" size={20} />;
    statusText = 'Validation Passed with Warnings';
  }

  return (
    <div className={`rounded-lg border p-4 ${statusColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium">{statusText}</span>
        </div>
        <div className="flex items-center gap-2">
          {onAutoFix && hasErrors && (
            <button
              onClick={onAutoFix}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-50 transition-colors"
            >
              <Wrench size={12} />
              Fix Automatically
            </button>
          )}
          {onRevalidate && (
            <button
              onClick={onRevalidate}
              disabled={isValidating}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isValidating ? 'animate-spin' : ''} />
              Validate Again
            </button>
          )}
        </div>
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-red-700 mb-2">
            Errors ({report.errors.length})
          </h4>
          <ul className="space-y-1">
            {report.errors.map((error, index) => (
              <li 
                key={index} 
                className="flex items-start gap-2 text-sm text-red-600"
              >
                <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-yellow-700 mb-2">
            Warnings ({report.warnings.length})
          </h4>
          <ul className="space-y-1">
            {report.warnings.map((warning, index) => (
              <li 
                key={index} 
                className="flex items-start gap-2 text-sm text-yellow-600"
              >
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Budget usage */}
      {showBudget && report?.budgetUsage && (
        <BudgetUsageDisplay usage={report.budgetUsage} />
      )}
    </div>
  );
}

function BudgetUsageDisplay({ usage }: { usage: BudgetUsage }) {
  const percentage = usage.percentage ?? 0;
  
  return (
    <div className="mt-3 pt-3 border-t border-current/10">
      <h4 className="text-sm font-medium mb-2">Character Budget</h4>
      {usage.maxChars ? (
        <CharacterBudget
          current={usage.currentChars}
          max={usage.maxChars}
          label=""
        />
      ) : (
        <div className="text-sm text-slate-600">
          {usage.currentChars.toLocaleString()} characters (no limit)
        </div>
      )}
      {!usage.withinLimit && (
        <p className="text-xs text-red-600 mt-1">
          ⚠️ Configuration exceeds character budget
        </p>
      )}
    </div>
  );
}

/** Compact validation status badge */
export function ValidationStatusBadge({ 
  report, 
  isValidating 
}: { 
  report: ValidationReport | null; 
  isValidating?: boolean;
}) {
  if (isValidating) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
        <RefreshCw size={10} className="animate-spin" />
        Validating
      </span>
    );
  }

  if (!report) return null;

  if (report.errors.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
        <XCircle size={10} />
        {report.errors.length} error{report.errors.length !== 1 ? 's' : ''}
      </span>
    );
  }

  if (report.warnings.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
        <AlertTriangle size={10} />
        {report.warnings.length} warning{report.warnings.length !== 1 ? 's' : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
      <CheckCircle size={10} />
      Valid
    </span>
  );
}
