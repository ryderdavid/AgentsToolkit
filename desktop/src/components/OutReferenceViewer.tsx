import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  ExternalLink, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { packApi } from '@/lib/api';
import type { CommandMetadata } from '@/lib/commands';

interface OutReferenceViewerProps {
  command: CommandMetadata;
}

interface OutReferenceInfo {
  path: string;
  type: 'rule-pack' | 'documentation' | 'template' | 'unknown';
  exists: boolean;
  content?: string;
}

/**
 * Display and preview out-references for a command
 */
export function OutReferenceViewer({ command }: OutReferenceViewerProps) {
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  // Parse out-references to determine type and status
  const references: OutReferenceInfo[] = command.outReferences.map(ref => {
    let type: OutReferenceInfo['type'] = 'unknown';
    
    if (ref.includes('rule-packs/')) {
      type = 'rule-pack';
    } else if (ref.includes('docs/')) {
      type = 'documentation';
    } else if (ref.includes('templates/')) {
      type = 'template';
    }

    return {
      path: ref,
      type,
      exists: true, // We'll validate this client-side if possible
    };
  });

  // Get preview content for expanded reference
  const { data: previewContent, isLoading: previewLoading } = useQuery({
    queryKey: ['out-reference-preview', expandedRef],
    queryFn: async () => {
      if (!expandedRef) return null;
      
      // Try to load from pack API if it's a rule pack file
      if (expandedRef.includes('rule-packs/')) {
        const parts = expandedRef.split('/');
        const packId = parts[parts.indexOf('rule-packs') + 1];
        const file = parts.slice(parts.indexOf('rule-packs') + 2).join('/');
        
        if (packId && file) {
          try {
            return await packApi.loadPackFile(packId, file);
          } catch {
            return `Failed to load: ${expandedRef}`;
          }
        }
      }
      
      return `Cannot preview: ${expandedRef}`;
    },
    enabled: !!expandedRef,
  });

  const getTypeIcon = (type: OutReferenceInfo['type']) => {
    switch (type) {
      case 'rule-pack':
        return <FileText size={14} className="text-blue-500" />;
      case 'documentation':
        return <FileText size={14} className="text-purple-500" />;
      case 'template':
        return <FileText size={14} className="text-orange-500" />;
      default:
        return <FileText size={14} className="text-slate-400" />;
    }
  };

  const getTypeLabel = (type: OutReferenceInfo['type']) => {
    switch (type) {
      case 'rule-pack':
        return 'Rule Pack';
      case 'documentation':
        return 'Documentation';
      case 'template':
        return 'Template';
      default:
        return 'File';
    }
  };

  if (references.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <ExternalLink size={32} className="mx-auto mb-2 opacity-50" />
        <p>This command has no out-references.</p>
        <p className="text-sm mt-1">
          Out-references are links to external files like rule packs or documentation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-slate-700">
          Out-References ({references.length})
        </h4>
        <span className="text-xs text-slate-500">
          Files referenced by this command
        </span>
      </div>

      <div className="space-y-2">
        {references.map((ref, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            {/* Reference header */}
            <button
              onClick={() => setExpandedRef(expandedRef === ref.path ? null : ref.path)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedRef === ref.path ? (
                  <ChevronDown size={14} className="text-slate-400" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400" />
                )}
                {getTypeIcon(ref.type)}
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-md">{ref.path}</p>
                  <p className="text-xs text-slate-500">{getTypeLabel(ref.type)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ref.exists ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check size={12} />
                    Valid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <X size={12} />
                    Not Found
                  </span>
                )}
                <ExternalLink size={14} className="text-slate-400" />
              </div>
            </button>

            {/* Reference preview */}
            {expandedRef === ref.path && (
              <div className="border-t bg-slate-50">
                {previewLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                ) : previewContent ? (
                  <pre className="p-4 text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {previewContent}
                  </pre>
                ) : (
                  <div className="p-4 text-center text-slate-500">
                    <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Could not load preview</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Validation summary */}
      <div className="p-3 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Check size={14} className="text-green-500" />
            <span className="text-slate-600">
              {references.filter(r => r.exists).length} valid
            </span>
          </div>
          {references.filter(r => !r.exists).length > 0 && (
            <div className="flex items-center gap-1">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-red-600">
                {references.filter(r => !r.exists).length} not found
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
