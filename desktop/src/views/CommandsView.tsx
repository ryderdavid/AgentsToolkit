import { Terminal } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function CommandsView() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Custom Commands</h1>
      <p className="text-slate-600 mb-8">
        Manage custom slash commands and deploy them to agents.
      </p>
      <EmptyState
        icon={Terminal}
        title="Command management coming soon"
        description="Phase 7 will add command browser and deployment"
      />
    </div>
  );
}
