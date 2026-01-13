import { Terminal, GitBranch, FileText, Wrench, Github, ExternalLink } from 'lucide-react';
import type { CommandMetadata } from '@/lib/commands';
import { getCategoryLabel, getCategoryColorClass, formatCharCount } from '@/lib/commands';
import { StatusBadge } from './StatusBadge';
import { CharacterBudget } from './CharacterBudget';

interface CommandCardProps {
  command: CommandMetadata;
  isEnabled?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
  onPreview?: () => void;
}

const categoryIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  workflow: Terminal,
  git: GitBranch,
  documentation: FileText,
  utility: Wrench,
};

export function CommandCard({ 
  command, 
  isEnabled = false, 
  onToggle, 
  onSelect,
  onPreview 
}: CommandCardProps) {
  const CategoryIcon = categoryIcons[command.category] ?? Terminal;

  return (
    <div
      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${getCategoryColorClass(command.category)}`}>
            <CategoryIcon size={18} />
          </div>
          <div>
            <h3 className="font-semibold">{command.name}</h3>
            <p className="text-xs text-slate-500">/{command.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {command.requiresGitHub && (
            <Github size={16} className="text-slate-400" title="Requires GitHub CLI" />
          )}
          <StatusBadge 
            status={isEnabled ? 'success' : 'info'} 
            text={isEnabled ? 'Enabled' : 'Disabled'} 
          />
        </div>
      </div>
      
      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
        {command.description}
      </p>
      
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-1 rounded ${getCategoryColorClass(command.category)}`}>
          {getCategoryLabel(command.category)}
        </span>
        <span className="text-xs text-slate-500">
          {formatCharCount(command.characterCount)} chars
        </span>
        {command.outReferences.length > 0 && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <ExternalLink size={12} />
            {command.outReferences.length} refs
          </span>
        )}
      </div>

      <div className="mb-3">
        <CharacterBudget 
          current={command.characterCount}
          max={10000}
          label="Characters"
        />
      </div>

      {command.agentCompatibility.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Compatible with:</p>
          <div className="flex flex-wrap gap-1">
            {command.agentCompatibility.map(agentId => (
              <span key={agentId} className="text-xs bg-slate-100 px-2 py-1 rounded">
                {agentId}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {onPreview && (
          <button
            onClick={e => {
              e.stopPropagation();
              onPreview();
            }}
            className="flex-1 px-3 py-2 text-sm rounded border border-slate-200 hover:bg-slate-50"
          >
            Preview
          </button>
        )}
        {onToggle && (
          <button
            onClick={e => {
              e.stopPropagation();
              onToggle();
            }}
            className={`flex-1 px-3 py-2 text-sm rounded ${
              isEnabled 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
        )}
      </div>
    </div>
  );
}
