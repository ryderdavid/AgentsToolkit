import { useQueries } from '@tanstack/react-query';
import { getAllAgents } from '@/lib/agents';
import { AgentCard } from '@/components/AgentCard';
import { fsApi } from '@/lib/api';

export function AgentsView() {
  // Load agents from TypeScript core (frontend)
  const agents = getAllAgents();
  
  // Check installation status for each agent
  const installationQueries = useQueries({
    queries: agents.map(agent => ({
      queryKey: ['agent-installed', agent.id],
      queryFn: () => fsApi.checkAgentInstalled(agent.id),
    })),
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Agents</h1>
      <p className="text-slate-600 mb-8">
        Configure AI agents and deploy AGENTS.md to their installations.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {agents.map((agent, index) => {
          const isInstalled = installationQueries[index]?.data ?? false;
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              isInstalled={isInstalled}
              onConfigure={() => console.log('Configure', agent.id)}
              onDeploy={() => console.log('Deploy', agent.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
