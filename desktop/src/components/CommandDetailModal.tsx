import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Terminal, FileText, Check, AlertCircle, Loader2, Copy, CheckCircle, Link2, Unlink } from 'lucide-react';
import { commandApi, type CommandMetadata, getCategoryLabel, getCategoryColorClass } from '@/lib/commands';
import { agentApi } from '@/lib/api';
import { CommandPreview } from './CommandPreview';
import { outReferenceApi } from '@/lib/outReferences';
import type { OutReference } from '@/lib/types';
import { OutReferenceBrowser } from './OutReferenceBrowser';

interface CommandDetailModalProps {
  commandId: string;
  onClose: () => void;
}

type Tab = 'overview' | 'content' | 'compatibility' | 'references';

export function CommandDetailModal({ commandId, onClose }: CommandDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: command, isLoading: commandLoading } = useQuery({
    queryKey: ['command', commandId],
    queryFn: () => commandApi.getCommandById(commandId),
  });

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['command-content', commandId],
    queryFn: () => commandApi.loadCommandContent(commandId),
    enabled: activeTab === 'content' || activeTab === 'overview',
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAllAgents(),
  });

  const { data: outReferences } = useQuery({
    queryKey: ['out-references', 'all'],
    queryFn: () => outReferenceApi.listAll(),
    staleTime: 1000 * 60 * 5,
  });

  const updateRefs = useMutation({
    mutationFn: (refs: string[]) => commandApi.updateOutReferences(commandId, refs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['command', commandId] });
      queryClient.invalidateQueries({ queryKey: ['out-references', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['out-reference-links'] });
    },
  });

  const linkedRefs: OutReference[] = useMemo(() => {
    if (!command || !outReferences) return [];
    return command.outReferences
      .map(refPath =>
        outReferences.find(r => refPath.includes(r.filePath) || r.filePath.includes(refPath))
      )
      .filter((r): r is OutReference => Boolean(r));
  }, [command, outReferences]);

  const linkedRefIds = useMemo(() => linkedRefs.map(r => r.id), [linkedRefs]);

  const handleLink = (id: string) => {
    if (!outReferences || !command) return;
    const ref = outReferences.find(r => r.id === id);
    if (!ref) return;
    const nextRefs = Array.from(new Set([...command.outReferences, ref.filePath]));
    updateRefs.mutate(nextRefs);
  };

  const handleUnlink = (id: string) => {
    if (!outReferences || !command) return;
    const ref = outReferences.find(r => r.id === id);
    if (!ref) return;
    const nextRefs = command.outReferences.filter(
      path => !(path.includes(ref.filePath) || ref.filePath.includes(path))
    );
    updateRefs.mutate(nextRefs);
  };

  const handleCopyContent = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (commandLoading) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      </div>
    );
  }

  if (!command) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <p className="text-red-600">Command not found: {commandId}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'content', label: 'Content' },
    { key: 'compatibility', label: 'Agent Compatibility' },
    { key: 'references', label: 'Out-References' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${getCategoryColorClass(command.category)}`}>
                <Terminal size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{command.name}</h2>
                <p className="text-slate-500">/{command.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-6 border-b -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-slate-600">{command.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Category</h3>
                  <span className={`inline-flex px-3 py-1 rounded-lg ${getCategoryColorClass(command.category)}`}>
                    {getCategoryLabel(command.category)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Script Path</h3>
                  <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                    {command.scriptPath || 'N/A'}
                  </code>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Characters</p>
                  <p className="text-2xl font-bold">{command.characterCount.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Words</p>
                  <p className="text-2xl font-bold">{command.wordCount.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Out-References</p>
                  <p className="text-2xl font-bold">{command.outReferences.length}</p>
                </div>
              </div>

              {command.requiresGitHub && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle size={18} className="text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This command requires GitHub CLI (gh) to be authenticated
                  </span>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Usage Instructions</h3>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-sm">
                  <p className="text-green-400"># Run this command in your agent:</p>
                  <p className="mt-2">/{command.id}</p>
                  {command.scriptPath && (
                    <>
                      <p className="text-green-400 mt-4"># Or run directly:</p>
                      <p className="mt-2">python3 {command.scriptPath}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Command Markdown</h3>
                <button
                  onClick={handleCopyContent}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {copied ? <CheckCircle size={16} className="text-green-600" /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {contentLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-slate-400" size={24} />
                </div>
              ) : (
                <pre className="bg-slate-50 border rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
                  {content}
                </pre>
              )}

              <CommandPreview command={command} initialContent={content} />
            </div>
          )}

          {activeTab === 'compatibility' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                {command.agentCompatibility.length === 0
                  ? 'This command is compatible with all agents.'
                  : `This command is compatible with ${command.agentCompatibility.length} specific agent(s).`}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {agents?.map(agent => {
                  const isCompatible =
                    command.agentCompatibility.length === 0 ||
                    command.agentCompatibility.includes(agent.id);

                  return (
                    <div
                      key={agent.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isCompatible ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-xs text-slate-500">{agent.commandFormat} format</p>
                      </div>
                      {isCompatible ? (
                        <Check size={18} className="text-green-600" />
                      ) : (
                        <X size={18} className="text-slate-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'references' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Linked Out-References</h3>
                {updateRefs.isPending && (
                  <span className="text-xs text-slate-500">Saving…</span>
                )}
              </div>

              {linkedRefs.length === 0 && (
                <p className="text-slate-500">This command has no out-references.</p>
              )}

              {linkedRefs.length > 0 && (
                <div className="space-y-2">
                  {linkedRefs.map(ref => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{ref.name}</p>
                          <p className="text-xs text-slate-500">
                            {ref.category} • {ref.filePath}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnlink(ref.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        <Unlink size={14} />
                        Unlink
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 size={16} className="text-slate-500" />
                  <h4 className="font-medium text-slate-800">Add/Remove References</h4>
                </div>
                <OutReferenceBrowser
                  onSelectRef={() => {}}
                  selectable
                  onLink={handleLink}
                  onUnlink={handleUnlink}
                  selectedIds={linkedRefIds}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
