import { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  Check,
  Folder,
  Terminal
} from 'lucide-react';
import { useAgentDeployment } from '@/hooks/useAgentDeployment';
import { ValidationResultsPanel } from './ValidationResultsPanel';
import { CharacterBudget } from './CharacterBudget';
import type { DeploymentConfig, PreparedDeployment, ValidationReport } from '@/lib/types';
import type { AgentDefinition } from '@/lib/agents';
import { useDeploymentConfigStore } from '@/stores/deploymentConfigStore';

interface DeploymentPreviewModalProps {
  agent: AgentDefinition;
  config: DeploymentConfig;
  isOpen: boolean;
  onClose: () => void;
  onDeploy: () => void;
}

export function DeploymentPreviewModal({
  agent,
  config,
  isOpen,
  onClose,
  onDeploy,
}: DeploymentPreviewModalProps) {
  const [preview, setPreview] = useState<PreparedDeployment | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [forceOverwrite, setForceOverwrite] = useState(config.forceOverwrite);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'files' | 'commands'>('content');

  const { 
    previewDeployment, 
    validateDeployment, 
    isLoading 
  } = useAgentDeployment();
  const configStore = useDeploymentConfigStore();

  useEffect(() => {
    if (isOpen) {
      setForceOverwrite(config.forceOverwrite);
      // Fetch preview and validation
      Promise.all([
        previewDeployment(agent.id, config),
        validateDeployment(agent.id, config),
      ]).then(([previewResult, validationResult]) => {
        setPreview(previewResult);
        setValidation(validationResult);
      });
    }
  }, [isOpen, agent.id, config, previewDeployment, validateDeployment]);

  if (!isOpen) return null;

  const hasErrors = validation && validation.errors.length > 0;
  const hasWarnings = validation && validation.warnings.length > 0;
  const canDeploy = !hasErrors;

  const handleCopyContent = async () => {
    if (preview?.agentsMdContent) {
      await navigator.clipboard.writeText(preview.agentsMdContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeploy = () => {
    if (canDeploy) {
      // Persist the user's latest choice before deploying
      configStore.setForceOverwrite(agent.id, forceOverwrite);
      onDeploy();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[800px] max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Deployment Preview</h2>
            <p className="text-sm text-slate-500">
              Review before deploying to {agent.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-blue-500 mx-auto mb-4" />
                <p className="text-slate-500">Preparing preview...</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Validation results */}
              <ValidationResultsPanel 
                report={validation} 
                showBudget={false}
              />

              {/* Character budget */}
              {preview && agent.characterLimits.maxChars && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Character Budget</h4>
                  <CharacterBudget
                    current={preview.characterCount}
                    max={agent.characterLimits.maxChars}
                  />
                </div>
              )}

              {/* Tabs */}
              <div className="border rounded-lg">
                <div className="flex border-b">
                  <button
                    onClick={() => setActiveTab('content')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      activeTab === 'content'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText size={14} />
                    AGENTS.md Content
                  </button>
                  <button
                    onClick={() => setActiveTab('files')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      activeTab === 'files'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Folder size={14} />
                    Files ({preview?.targetPaths.length || 0})
                  </button>
                  {preview && Object.keys(preview.commands).length > 0 && (
                    <button
                      onClick={() => setActiveTab('commands')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                        activeTab === 'commands'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Terminal size={14} />
                      Commands ({Object.keys(preview.commands).length})
                    </button>
                  )}
                </div>

                <div className="p-4">
                  {activeTab === 'content' && preview && (
                    <div className="relative">
                      <button
                        onClick={handleCopyContent}
                        className="absolute top-2 right-2 p-2 bg-white border rounded hover:bg-slate-50 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto max-h-64">
                        {preview.agentsMdContent}
                      </pre>
                      <div className="mt-2 text-xs text-slate-500 text-right">
                        {preview.characterCount.toLocaleString()} characters
                      </div>
                    </div>
                  )}

                  {activeTab === 'files' && preview && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600 mb-3">
                        The following files will be created or modified:
                      </p>
                      {preview.targetPaths.map(path => (
                        <div 
                          key={path}
                          className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm font-mono"
                        >
                          <FileText size={14} className="text-slate-400" />
                          <span className="truncate">{path}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'commands' && preview && (
                    <div className="space-y-3">
                      {Object.entries(preview.commands).map(([path, content]) => (
                        <div key={path} className="border rounded-lg">
                          <div className="px-3 py-2 bg-slate-50 border-b text-sm font-mono text-slate-600">
                            {path}
                          </div>
                          <pre className="p-3 text-xs font-mono overflow-x-auto max-h-32">
                            {content}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceOverwrite}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForceOverwrite(checked);
                      configStore.setForceOverwrite(agent.id, checked);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">Force overwrite existing files</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-slate-50">
          <div className="flex items-center gap-2 text-sm">
            {hasErrors && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle size={14} />
                Fix errors before deploying
              </span>
            )}
            {!hasErrors && hasWarnings && (
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle size={14} />
                Deploying with warnings
              </span>
            )}
            {!hasErrors && !hasWarnings && validation && (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle size={14} />
                Ready to deploy
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeploy}
              disabled={!canDeploy || isLoading}
              className="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Preparing...' : 'Deploy Now'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
