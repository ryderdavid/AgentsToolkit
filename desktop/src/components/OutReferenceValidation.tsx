import { AlertTriangle, XCircle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { OutReferenceValidationReport } from '@/lib/types';

interface OutReferenceValidationProps {
  validation: OutReferenceValidationReport;
}

export function OutReferenceValidation({ validation }: OutReferenceValidationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const errorCount = validation.brokenLinks.length;
  const warningCount = validation.unusedReferences.length + validation.orphanedFiles.length;

  if (errorCount === 0 && warningCount === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border ${
        errorCount > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-3">
          {errorCount > 0 ? (
            <XCircle className="text-red-500" size={20} />
          ) : (
            <AlertTriangle className="text-amber-500" size={20} />
          )}
          <span
            className={`font-medium ${errorCount > 0 ? 'text-red-700' : 'text-amber-700'}`}
          >
            {errorCount > 0 ? `${errorCount} Error${errorCount > 1 ? 's' : ''}` : ''}
            {errorCount > 0 && warningCount > 0 ? ' • ' : ''}
            {warningCount > 0 ? `${warningCount} Warning${warningCount > 1 ? 's' : ''}` : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown size={20} className="text-slate-500" />
        ) : (
          <ChevronRight size={20} className="text-slate-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Broken Links */}
          {validation.brokenLinks.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-red-700">Broken Links</h4>
              <ul className="space-y-1">
                {validation.brokenLinks.map((link, i) => (
                  <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>{link.sourceType}:{link.sourceId}</strong> → {link.targetPath}
                      <span className="text-red-500 ml-1">({link.reason})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unused References */}
          {validation.unusedReferences.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-amber-700">Unused References</h4>
              <ul className="space-y-1">
                {validation.unusedReferences.map((id, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Reference <strong>{id}</strong> is not linked from any command or pack</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Orphaned Files */}
          {validation.orphanedFiles.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-amber-700">Orphaned Files</h4>
              <ul className="space-y-1">
                {validation.orphanedFiles.map((path, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                    <span>
                      File <strong>{path}</strong> exists but is not tracked in metadata
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
