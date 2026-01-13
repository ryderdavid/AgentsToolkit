import { useQuery } from '@tanstack/react-query';
import { fsApi, deployApi } from '@/lib/api';
import { StatusBadge } from '@/components/StatusBadge';

function SymlinkSupportCheck() {
  const { data: support, isLoading } = useQuery({
    queryKey: ['symlink-support'],
    queryFn: deployApi.checkSymlinkSupport,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-600">Checking...</p>;
  }

  if (!support) {
    return <p className="text-sm text-slate-600">Unknown</p>;
  }

  const [supported, message] = support;

  return (
    <div>
      <StatusBadge 
        status={supported ? 'success' : 'warning'} 
        text={supported ? 'Supported' : 'Limited Support'} 
      />
      <p className="text-sm text-slate-500 mt-2">{message}</p>
    </div>
  );
}

export function SettingsView() {
  const { data: home } = useQuery({
    queryKey: ['agentsmd-home'],
    queryFn: fsApi.getAgentsMdHome,
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Settings</h1>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-xl font-semibold mb-2">Installation</h2>
          <div className="bg-slate-50 p-4 rounded">
            <p className="text-sm text-slate-600 mb-1">AgentsToolkit Home:</p>
            <p className="font-mono text-sm">{home || 'Loading...'}</p>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Symlink Support</h2>
          <SymlinkSupportCheck />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">About</h2>
          <div className="bg-slate-50 p-4 rounded">
            <p className="text-sm text-slate-600">
              AgentsToolkit Desktop v0.1.0
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Cross-platform GUI for managing AI agent configurations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
