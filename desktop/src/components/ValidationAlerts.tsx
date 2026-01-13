import { useState } from 'react';
import type { ValidationResult } from '@core/pack-composer-types';
import { AlertTriangle, AlertOctagon } from 'lucide-react';

type ValidationAlertsProps = {
  validation: ValidationResult;
};

export function ValidationAlerts({ validation }: ValidationAlertsProps) {
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  const visibleWarnings = validation.warnings.filter(
    msg => !dismissedWarnings.has(msg)
  );

  return (
    <div className="space-y-2">
      {validation.errors.map((error, idx) => (
        <div
          key={`error-${idx}`}
          className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 rounded-lg px-3 py-2"
        >
          <AlertOctagon size={16} className="mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-semibold">Validation error</p>
            <p>{error}</p>
          </div>
        </div>
      ))}

      {visibleWarnings.map((warning, idx) => (
        <div
          key={`warn-${idx}`}
          className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2"
        >
          <AlertTriangle size={16} className="mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-semibold">Validation warning</p>
            <p>{warning}</p>
          </div>
          <button
            onClick={() =>
              setDismissedWarnings(prev => {
                const next = new Set(prev);
                next.add(warning);
                return next;
              })
            }
            className="text-xs text-yellow-800 underline"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
