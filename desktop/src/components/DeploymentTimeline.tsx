import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deploymentApi } from '@/lib/api';
import { 
  Clock, 
  RotateCcw, 
  Package, 
  Terminal, 
  ChevronDown, 
  ChevronRight,
  GitBranch,
  Folder
} from 'lucide-react';
import type { DeploymentState } from '@/lib/types';

interface DeploymentTimelineProps {
  agentId: string;
  onRollback?: (timestamp: string) => void;
  maxItems?: number;
}

export function DeploymentTimeline({ 
  agentId, 
  onRollback,
  maxItems = 10 
}: DeploymentTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const { data: history, isLoading, error } = useQuery({
    queryKey: ['deployment-history', agentId],
    queryFn: () => deploymentApi.getDeploymentHistory(agentId),
  });

  const toggleExpand = (timestamp: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  };

  const toggleCompare = (timestamp: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(timestamp)) {
        return prev.filter(t => t !== timestamp);
      }
      if (prev.length >= 2) {
        return [prev[1], timestamp];
      }
      return [...prev, timestamp];
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load deployment history
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Clock size={32} className="mx-auto mb-2 opacity-50" />
        <p>No deployment history</p>
        <p className="text-sm">Deploy to this agent to see history here</p>
      </div>
    );
  }

  const displayItems = history.slice(0, maxItems);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

      {/* Timeline items */}
      <div className="space-y-4">
        {displayItems.map((deployment, index) => {
          const isExpanded = expandedItems.has(deployment.timestamp);
          const isLatest = index === 0;
          const isSelectedForCompare = selectedForCompare.includes(deployment.timestamp);
          const date = new Date(deployment.timestamp);

          return (
            <div key={deployment.timestamp} className="relative pl-10">
              {/* Timeline dot */}
              <div 
                className={`absolute left-2.5 w-3 h-3 rounded-full border-2 bg-white z-10 ${
                  isLatest 
                    ? 'border-green-500' 
                    : isSelectedForCompare 
                    ? 'border-purple-500' 
                    : 'border-slate-300'
                }`}
              />

              {/* Card */}
              <div 
                className={`border rounded-lg transition-all ${
                  isExpanded ? 'bg-white shadow-md' : 'bg-slate-50 hover:bg-white'
                } ${isSelectedForCompare ? 'ring-2 ring-purple-200' : ''}`}
              >
                {/* Header */}
                <button
                  onClick={() => toggleExpand(deployment.timestamp)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {date.toLocaleDateString()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {date.toLocaleTimeString()}
                        </span>
                        {isLatest && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="capitalize">{deployment.method}</span>
                        <span>•</span>
                        <span className="capitalize">{deployment.targetLevel} level</span>
                      </div>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t">
                    {/* Packs */}
                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                        <Package size={14} />
                        <span>Deployed Packs</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {deployment.deployedPacks.map(pack => (
                          <span 
                            key={pack}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                          >
                            {pack}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Commands */}
                    {deployment.deployedCommands.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                          <Terminal size={14} />
                          <span>Commands</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {deployment.deployedCommands.map(cmd => (
                            <span 
                              key={cmd}
                              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                            >
                              {cmd}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    {deployment.filesCreated.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                          <Folder size={14} />
                          <span>Files Created ({deployment.filesCreated.length})</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono bg-slate-50 p-2 rounded max-h-24 overflow-y-auto">
                          {deployment.filesCreated.map(file => (
                            <div key={file} className="truncate">{file}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Backup path */}
                    {deployment.backupPath && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                          <GitBranch size={14} />
                          <span>Backup</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono truncate">
                          {deployment.backupPath}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                      {onRollback && !isLatest && (
                        <button
                          onClick={() => onRollback(deployment.timestamp)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                        >
                          <RotateCcw size={12} />
                          Rollback to this
                        </button>
                      )}
                      <button
                        onClick={() => toggleCompare(deployment.timestamp)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors ${
                          isSelectedForCompare
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelectedForCompare ? 'Selected' : 'Select for compare'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Compare panel */}
      {selectedForCompare.length === 2 && (
        <DeploymentComparison
          agentId={agentId}
          timestamps={selectedForCompare}
          history={history}
          onClear={() => setSelectedForCompare([])}
        />
      )}

      {/* Show more */}
      {history.length > maxItems && (
        <div className="text-center mt-4">
          <span className="text-sm text-slate-500">
            Showing {maxItems} of {history.length} deployments
          </span>
        </div>
      )}
    </div>
  );
}

function DeploymentComparison({
  timestamps,
  history,
  onClear,
}: {
  agentId: string;
  timestamps: string[];
  history: DeploymentState[];
  onClear: () => void;
}) {
  const [older, newer] = timestamps
    .map(t => history.find(h => h.timestamp === t)!)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const olderPacks = new Set(older.deployedPacks);
  const newerPacks = new Set(newer.deployedPacks);
  
  const addedPacks = newer.deployedPacks.filter(p => !olderPacks.has(p));
  const removedPacks = older.deployedPacks.filter(p => !newerPacks.has(p));
  const unchangedPacks = newer.deployedPacks.filter(p => olderPacks.has(p));

  return (
    <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-purple-900">Deployment Comparison</h4>
        <button
          onClick={onClear}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          Clear selection
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        {addedPacks.length > 0 && (
          <div>
            <span className="text-green-700 font-medium">Added:</span>
            <div className="mt-1 space-y-1">
              {addedPacks.map(p => (
                <span key={p} className="block text-green-600">+ {p}</span>
              ))}
            </div>
          </div>
        )}
        {removedPacks.length > 0 && (
          <div>
            <span className="text-red-700 font-medium">Removed:</span>
            <div className="mt-1 space-y-1">
              {removedPacks.map(p => (
                <span key={p} className="block text-red-600">- {p}</span>
              ))}
            </div>
          </div>
        )}
        {unchangedPacks.length > 0 && (
          <div>
            <span className="text-slate-600 font-medium">Unchanged:</span>
            <div className="mt-1 space-y-1">
              {unchangedPacks.map(p => (
                <span key={p} className="block text-slate-500">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
