import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, FileText, Plus, AlertTriangle } from 'lucide-react';
import { OutReferenceBrowser } from '@/components/OutReferenceBrowser';
import { OutReferenceDetailModal } from '@/components/OutReferenceDetailModal';
import { OutReferenceValidation } from '@/components/OutReferenceValidation';
import { outReferenceApi } from '@/lib/outReferences';
import { OutReferenceTemplateSelector } from '@/components/OutReferenceTemplateSelector';
import type { OutReferenceCategory, FileFormat } from '@/lib/types';

export function OutReferencesView() {
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [initialTemplate, setInitialTemplate] = useState<{
    content: string;
    category: OutReferenceCategory;
    format: FileFormat;
    name?: string;
    description?: string;
  } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: allRefs, refetch: refetchRefs } = useQuery({
    queryKey: ['out-references', 'all'],
    queryFn: () => outReferenceApi.listAll(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: stats } = useQuery({
    queryKey: ['out-references', 'stats'],
    queryFn: () => outReferenceApi.getStats(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: validation } = useQuery({
    queryKey: ['out-references', 'validation'],
    queryFn: () => outReferenceApi.validate(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (isCmdOrCtrl && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (isCmdOrCtrl && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setShowTemplateSelector(true);
      }
      if (event.key === 'Escape') {
        if (selectedRefId) {
          setSelectedRefId(null);
        }
        if (showCreateModal) {
          setShowCreateModal(false);
        }
        if (showTemplateSelector) {
          setShowTemplateSelector(false);
        }
        if (showShortcuts) {
          setShowShortcuts(false);
        }
      }
      if (event.key === '?') {
        setShowShortcuts(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedRefId, showCreateModal, showShortcuts]);

  const handleRefreshAfterChange = () => {
    refetchRefs();
  };

  const handleStartCreate = () => {
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = (template: {
    content: string;
    category: OutReferenceCategory;
    format: FileFormat;
    name?: string;
    description?: string;
  }) => {
    setInitialTemplate(template);
    setShowTemplateSelector(false);
    setShowCreateModal(true);
  };

  return (
    <main className="p-8 space-y-4" role="main">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="text-slate-600" />
            Out-References
          </h1>
          <p className="text-slate-600 mt-1">
            Manage external reference files for your agents - templates, examples, and schemas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleStartCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            Create New
          </button>
          <a
            href="/docs/out-references-guide.md"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
          >
            <HelpCircle size={16} />
            Help
          </a>
        </div>
      </header>

      {/* Validation Warnings */}
      {validation && !validation.valid && (
        <OutReferenceValidation validation={validation} />
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-6 py-3 px-4 bg-slate-50 rounded-lg">
        <div>
          <span className="text-sm text-slate-500">Total References:</span>
          <span className="ml-2 font-semibold">{stats?.totalCount ?? 0}</span>
        </div>
        <div>
          <span className="text-sm text-slate-500">Templates:</span>
          <span className="ml-2 font-semibold text-purple-600">{stats?.templatesCount ?? 0}</span>
        </div>
        <div>
          <span className="text-sm text-slate-500">Examples:</span>
          <span className="ml-2 font-semibold text-green-600">{stats?.examplesCount ?? 0}</span>
        </div>
        <div>
          <span className="text-sm text-slate-500">Schemas:</span>
          <span className="ml-2 font-semibold text-blue-600">{stats?.schemasCount ?? 0}</span>
        </div>
        {(stats?.brokenLinkCount ?? 0) > 0 && (
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle size={14} />
            <span className="text-sm">{stats?.brokenLinkCount} broken links</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 gap-4">
        <OutReferenceBrowser
          onSelectRef={id => setSelectedRefId(id)}
          searchInputRef={searchInputRef}
        />
      </div>

      {/* Detail Modal */}
      {selectedRefId && (
        <OutReferenceDetailModal
          refId={selectedRefId}
          onClose={() => setSelectedRefId(null)}
          onSave={handleRefreshAfterChange}
          onDelete={handleRefreshAfterChange}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <OutReferenceDetailModal
          refId={null}
          initialContent={initialTemplate?.content ?? ''}
          initialCategory={initialTemplate?.category ?? 'templates'}
          initialFormat={initialTemplate?.format ?? 'markdown'}
          initialName={initialTemplate?.name ?? ''}
          initialDescription={initialTemplate?.description ?? ''}
          onChooseTemplate={() => {
            setShowCreateModal(false);
            setShowTemplateSelector(true);
          }}
          onClose={() => {
            setShowCreateModal(false);
            setInitialTemplate(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setInitialTemplate(null);
            handleRefreshAfterChange();
          }}
          onDelete={() => {}}
        />
      )}

      {/* Template Selector */}
      {showTemplateSelector && (
        <OutReferenceTemplateSelector
          onSelect={template =>
            handleTemplateSelect({
              content: template.content,
              category: template.category,
              format: template.format,
              name: template.name,
              description: template.description,
            })
          }
          onCancel={() => setShowTemplateSelector(false)}
        />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500">Keyboard shortcuts</p>
                <h3 className="text-lg font-semibold">Out-References</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li><strong>Cmd/Ctrl + K</strong> — Focus search</li>
              <li><strong>Cmd/Ctrl + N</strong> — Create new reference</li>
              <li><strong>Esc</strong> — Close modal</li>
              <li><strong>?</strong> — Open this help</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
