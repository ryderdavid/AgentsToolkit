import { useQuery } from '@tanstack/react-query';
import { agentApi, packApi } from '@/lib/api';
import { getAllAgents } from '@/lib/agents';
import { CheckCircle, Package, Bot, Terminal } from 'lucide-react';

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        <Icon size={20} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export function Dashboard() {
  // Load agents from TypeScript core (frontend)
  const agents = getAllAgents();
  
  // Load packs from Rust backend (IPC)
  const { data: packs, isLoading: packsLoading } = useQuery({
    queryKey: ['packs'],
    queryFn: packApi.listAvailablePacks,
  });

  const configuredCount = agents.length;
  const activePacksCount = packs?.length ?? 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-600">Welcome to AgentsToolkit Desktop</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Configured Agents" 
          value={configuredCount} 
          icon={Bot}
        />
        <StatCard 
          title="Active Rule Packs" 
          value={activePacksCount} 
          icon={Package}
        />
        <StatCard 
          title="Custom Commands" 
          value={0} 
          icon={Terminal}
        />
        <StatCard 
          title="Last Deployment" 
          value="Never" 
          icon={CheckCircle}
        />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Deploy All Agents
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
            Validate Configuration
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
            View Documentation
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="border rounded-lg p-4">
          <p className="text-slate-500 text-sm">No recent activity</p>
        </div>
      </div>
    </div>
  );
}
