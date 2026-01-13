import { useQuery } from '@tanstack/react-query';
import { packApi, outReferenceApi } from '@/lib/api';
import { commandApi } from '@/lib/commands';
import { getAllAgents } from '@/lib/agents';
import { CheckCircle, Package, Bot, Terminal, FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  href,
  warning 
}: { 
  title: string; 
  value: string | number; 
  icon: any;
  href?: string;
  warning?: string;
}) {
  const content = (
    <div className={`border rounded-lg p-4 transition-colors ${href ? 'hover:bg-slate-50 cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        <Icon size={20} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {warning && (
        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
          <AlertTriangle size={12} />
          {warning}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

export function Dashboard() {
  // Load agents from TypeScript core (frontend)
  const agents = getAllAgents();
  
  // Load packs from Rust backend (IPC)
  const { data: packs } = useQuery({
    queryKey: ['packs'],
    queryFn: packApi.listAvailablePacks,
  });

  // Load commands
  const { data: commands } = useQuery({
    queryKey: ['commands'],
    queryFn: commandApi.listAvailableCommands,
  });

  // Load out-reference stats
  const { data: outRefStats } = useQuery({
    queryKey: ['out-references', 'stats'],
    queryFn: outReferenceApi.getStats,
  });

  const configuredCount = agents.length;
  const activePacksCount = packs?.length ?? 0;
  const commandsCount = commands?.length ?? 0;
  const outRefsCount = outRefStats?.totalCount ?? 0;
  const brokenLinksWarning = outRefStats?.brokenLinkCount 
    ? `${outRefStats.brokenLinkCount} broken link${outRefStats.brokenLinkCount > 1 ? 's' : ''}`
    : undefined;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-600">Welcome to AgentsToolkit Desktop</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard 
          title="Configured Agents" 
          value={configuredCount} 
          icon={Bot}
          href="/agents"
        />
        <StatCard 
          title="Active Rule Packs" 
          value={activePacksCount} 
          icon={Package}
          href="/rule-packs"
        />
        <StatCard 
          title="Custom Commands" 
          value={commandsCount} 
          icon={Terminal}
          href="/commands"
        />
        <StatCard 
          title="Out-References" 
          value={outRefsCount} 
          icon={FileText}
          href="/out-references"
          warning={brokenLinksWarning}
        />
        <StatCard 
          title="Last Deployment" 
          value="Never" 
          icon={CheckCircle}
        />
      </div>

      {/* Out-Reference breakdown */}
      {outRefStats && outRefStats.totalCount > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Out-Reference Summary</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
              <p className="text-sm text-purple-600 font-medium">Templates</p>
              <p className="text-2xl font-bold text-purple-700">{outRefStats.templatesCount}</p>
            </div>
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <p className="text-sm text-green-600 font-medium">Examples</p>
              <p className="text-2xl font-bold text-green-700">{outRefStats.examplesCount}</p>
            </div>
            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
              <p className="text-sm text-blue-600 font-medium">Schemas</p>
              <p className="text-2xl font-bold text-blue-700">{outRefStats.schemasCount}</p>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <p className="text-sm text-slate-600 font-medium">Total Characters</p>
              <p className="text-2xl font-bold text-slate-700">
                {outRefStats.totalCharacterCount >= 1000 
                  ? `${(outRefStats.totalCharacterCount / 1000).toFixed(1)}k`
                  : outRefStats.totalCharacterCount}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Deploy All Agents
          </button>
          <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200">
            Validate Configuration
          </button>
          <Link 
            to="/out-references"
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
          >
            Manage Out-References
          </Link>
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
