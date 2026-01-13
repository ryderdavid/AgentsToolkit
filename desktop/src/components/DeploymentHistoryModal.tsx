import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Clock, BarChart3, List, Download } from 'lucide-react';
import { deploymentApi } from '@/lib/api';
import { DeploymentTimeline } from './DeploymentTimeline';
import type { DeploymentState } from '@/lib/types';

interface DeploymentHistoryModalProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onRollback: (timestamp: string) => void;
}

type ViewMode = 'timeline' | 'list' | 'statistics';

export function DeploymentHistoryModal({
  agentId,
  agentName,
  isOpen,
  onClose,
  onRollback,
}: DeploymentHistoryModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ['deployment-history', agentId],
    queryFn: () => deploymentApi.getDeploymentHistory(agentId),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleRollbackClick = (timestamp: string) => {
    setShowRollbackConfirm(timestamp);
  };

  const handleRollbackConfirm = () => {
    if (showRollbackConfirm) {
      onRollback(showRollbackConfirm);
      setShowRollbackConfirm(null);
    }
  };

  const handleExport = (format: 'json' | 'csv') => {
    if (!history) return;

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(history, null, 2);
      filename = `${agentId}-deployment-history.json`;
      mimeType = 'application/json';
    } else {
      const headers = ['Timestamp', 'Method', 'Target Level', 'Packs', 'Commands', 'Files'];
      const rows = history.map(d => [
        d.timestamp,
        d.method,
        d.targetLevel,
        d.deployedPacks.join(';'),
        d.deployedCommands.join(';'),
        d.filesCreated.length.toString(),
      ]);
      content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      filename = `${agentId}-deployment-history.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-50 w-[700px] max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Deployment History</h2>
            <p className="text-sm text-slate-500">{agentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b bg-slate-50">
          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'timeline'
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock size={14} />
            Timeline
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={14} />
            List
          </button>
          <button
            onClick={() => setViewMode('statistics')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'statistics'
                ? 'bg-white shadow text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 size={14} />
            Statistics
          </button>

          <div className="flex-1" />

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition-colors">
              <Download size={14} />
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('json')}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'timeline' && (
            <DeploymentTimeline 
              agentId={agentId} 
              onRollback={handleRollbackClick}
            />
          )}
          {viewMode === 'list' && (
            <DeploymentListView 
              history={history || []} 
              onRollback={handleRollbackClick}
            />
          )}
          {viewMode === 'statistics' && (
            <DeploymentStatistics history={history || []} />
          )}
        </div>
      </div>

      {/* Rollback confirmation */}
      {showRollbackConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-[60]"
            onClick={() => setShowRollbackConfirm(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl z-[60] p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Confirm Rollback</h3>
            <p className="text-sm text-slate-600 mb-4">
              This will restore the configuration from{' '}
              {new Date(showRollbackConfirm).toLocaleString()}.
              Any changes made since then will be lost.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRollbackConfirm(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleRollbackConfirm}
                className="px-4 py-2 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
              >
                Rollback
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DeploymentListView({ 
  history, 
  onRollback 
}: { 
  history: DeploymentState[];
  onRollback: (timestamp: string) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No deployment history
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-medium">Date</th>
            <th className="text-left py-2 font-medium">Method</th>
            <th className="text-left py-2 font-medium">Level</th>
            <th className="text-left py-2 font-medium">Packs</th>
            <th className="text-right py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {history.map((deployment, index) => (
            <tr key={deployment.timestamp} className="border-b hover:bg-slate-50">
              <td className="py-2">
                {new Date(deployment.timestamp).toLocaleDateString()}
                {index === 0 && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                    Latest
                  </span>
                )}
              </td>
              <td className="py-2 capitalize">{deployment.method}</td>
              <td className="py-2 capitalize">{deployment.targetLevel}</td>
              <td className="py-2">{deployment.deployedPacks.join(', ')}</td>
              <td className="py-2 text-right">
                {index !== 0 && (
                  <button
                    onClick={() => onRollback(deployment.timestamp)}
                    className="text-yellow-600 hover:text-yellow-700"
                  >
                    Rollback
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeploymentStatistics({ history }: { history: DeploymentState[] }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No deployment history to analyze
      </div>
    );
  }

  // Calculate statistics
  const totalDeployments = history.length;
  const packUsage = new Map<string, number>();
  const methodUsage = new Map<string, number>();

  history.forEach(d => {
    d.deployedPacks.forEach(pack => {
      packUsage.set(pack, (packUsage.get(pack) || 0) + 1);
    });
    methodUsage.set(d.method, (methodUsage.get(d.method) || 0) + 1);
  });

  const mostUsedPacks = Array.from(packUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Deployment frequency (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentDeployments = history.filter(
    d => new Date(d.timestamp) >= thirtyDaysAgo
  ).length;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">{totalDeployments}</div>
          <div className="text-sm text-blue-600">Total Deployments</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-700">{recentDeployments}</div>
          <div className="text-sm text-green-600">Last 30 Days</div>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">{packUsage.size}</div>
          <div className="text-sm text-purple-600">Unique Packs Used</div>
        </div>
      </div>

      {/* Most used packs */}
      <div>
        <h4 className="font-medium mb-3">Most Deployed Packs</h4>
        <div className="space-y-2">
          {mostUsedPacks.map(([pack, count]) => (
            <div key={pack} className="flex items-center gap-3">
              <div className="w-24 text-sm font-medium">{pack}</div>
              <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(count / totalDeployments) * 100}%` }}
                />
              </div>
              <div className="text-sm text-slate-500 w-16 text-right">
                {count} ({Math.round((count / totalDeployments) * 100)}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment methods */}
      <div>
        <h4 className="font-medium mb-3">Deployment Methods</h4>
        <div className="flex gap-4">
          {Array.from(methodUsage.entries()).map(([method, count]) => (
            <div key={method} className="px-4 py-2 bg-slate-100 rounded-lg">
              <div className="text-lg font-semibold">{count}</div>
              <div className="text-sm text-slate-600 capitalize">{method}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
