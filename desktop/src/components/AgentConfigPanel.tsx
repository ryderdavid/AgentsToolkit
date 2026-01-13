import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronDown, 
  ChevronUp, 
  Folder, 
  Settings,
  RefreshCw
} from 'lucide-react';
import { packApi } from '@/lib/api';
import { useDeploymentConfig } from '@/hooks/useDeploymentConfig';
import { useRealtimeBudget } from '@/hooks/useRealtimeBudget';
import { CharacterBudget } from './CharacterBudget';
import { TemplateSelector } from './TemplateSelector';
import { ValidationStatusBadge } from './ValidationResultsPanel';
import { useAgentDeployment } from '@/hooks/useAgentDeployment';
import type { AgentDefinition } from '@/lib/types';
import type { TargetLevel, ValidationReport } from '@/lib/types';

interface AgentConfigPanelProps {
  agent: AgentDefinition;
  isExpanded: boolean;
  onToggle: () => void;
  onValidate: () => void;
  onDeploy: () => void;
}

export function AgentConfigPanel({
  agent,
  isExpanded,
  onToggle,
  onValidate,
  onDeploy,
}: AgentConfigPanelProps) {
  const {
    config,
    deploymentConfig,
    setPackIds,
    setTargetLevel,
    setForceOverwrite,
    setProjectPath,
    isValid,
    validationErrors,
  } = useDeploymentConfig(agent.id);

  const { validateDeployment, isLoading: isValidating } = useAgentDeployment();
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);

  const { budget, isCalculating } = useRealtimeBudget(config.packIds, agent.id);

  // Fetch available packs
  const { data: availablePacks } = useQuery({
    queryKey: ['available-packs'],
    queryFn: () => packApi.listAvailablePacks(),
  });

  const handlePackToggle = (packId: string) => {
    const newPackIds = config.packIds.includes(packId)
      ? config.packIds.filter(id => id !== packId)
      : [...config.packIds, packId];
    setPackIds(newPackIds);
  };

  const handleValidate = async () => {
    const report = await validateDeployment(agent.id, deploymentConfig);
    setValidationReport(report);
    onValidate();
  };

  const maxChars = agent.characterLimits.maxChars;
  const currentChars = budget?.totalChars ?? 0;
  const isOverBudget = maxChars && currentChars > maxChars;

  return (
    <div className="border-t bg-slate-50">
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Settings size={14} />
          <span>Configuration</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Agent metadata */}
          <div className="p-3 bg-white rounded-lg border text-sm">
            <h4 className="font-medium mb-2">Agent Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Config Path:</span>
                <p className="font-mono truncate">{agent.configPaths.user}</p>
              </div>
              <div>
                <span className="text-slate-500">Command Format:</span>
                <p>{agent.commandFormat}</p>
              </div>
              <div>
                <span className="text-slate-500">File Format:</span>
                <p>{agent.fileFormat}</p>
              </div>
              <div>
                <span className="text-slate-500">Deployment:</span>
                <p className="capitalize">{agent.deployment.strategy}</p>
              </div>
            </div>
            {agent.notes && (
              <p className="mt-2 text-xs text-slate-500 italic">
                {agent.notes}
              </p>
            )}
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium mb-2">Quick Setup</label>
            <TemplateSelector
              currentPackIds={config.packIds}
              maxChars={maxChars}
              onApplyTemplate={setPackIds}
            />
          </div>

          {/* Rule packs */}
          <div>
            <label className="block text-sm font-medium mb-2">Rule Packs</label>
            <div className="space-y-2">
              {availablePacks?.map((pack) => {
                const isEnabled = config.packIds.includes(pack.id);
                const packChars = 0; // Would come from budget breakdown
                
                return (
                  <label
                    key={pack.id}
                    className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer transition-colors ${
                      isEnabled ? 'border-blue-300 bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handlePackToggle(pack.id)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{pack.name}</span>
                        <span className="text-xs text-slate-400">v{pack.version}</span>
                      </div>
                      <p className="text-xs text-slate-500">{pack.description}</p>
                    </div>
                    {packChars > 0 && (
                      <span className="text-xs text-slate-400">
                        ~{packChars.toLocaleString()} chars
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Character budget */}
          {maxChars && (
            <div className={`p-3 rounded-lg border ${isOverBudget ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Character Budget</span>
                {isCalculating && (
                  <RefreshCw size={12} className="animate-spin text-slate-400" />
                )}
              </div>
              <CharacterBudget
                current={currentChars}
                max={maxChars}
                label=""
              />
              {isOverBudget && (
                <p className="text-xs text-red-600 mt-2">
                  Configuration exceeds agent's character limit. Remove some packs.
                </p>
              )}
            </div>
          )}

          {/* Deployment level */}
          <div>
            <label className="block text-sm font-medium mb-2">Deployment Level</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`target-level-${agent.id}`}
                  checked={config.targetLevel === 'user'}
                  onChange={() => setTargetLevel('user')}
                  className="text-blue-500"
                />
                <span className="text-sm">User Level</span>
              </label>
              {agent.configPaths.project && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`target-level-${agent.id}`}
                    checked={config.targetLevel === 'project'}
                    onChange={() => setTargetLevel('project')}
                    className="text-blue-500"
                  />
                  <span className="text-sm">Project Level</span>
                </label>
              )}
            </div>
          </div>

          {/* Project path (for project-level) */}
          {config.targetLevel === 'project' && (
            <div>
              <label className="block text-sm font-medium mb-2">Project Path</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.projectPath || ''}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="px-3 py-2 border rounded-lg hover:bg-slate-50 transition-colors">
                  <Folder size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Force overwrite */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Force overwrite existing files</span>
          </label>

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <ul className="text-sm text-red-600 space-y-1">
                {validationErrors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <ValidationStatusBadge 
              report={validationReport} 
              isValidating={isValidating}
            />
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                disabled={!isValid || isValidating}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </button>
              <button
                onClick={onDeploy}
                disabled={!isValid || isOverBudget}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                Deploy Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
