import { Package } from 'lucide-react';
import type { RulePack } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { CharacterBudget } from './CharacterBudget';

interface RulePackCardProps {
  pack: RulePack;
  isEnabled?: boolean;
  onToggle?: () => void;
  onSelect?: () => void;
}

export function RulePackCard({ pack, isEnabled = false, onToggle, onSelect }: RulePackCardProps) {
  return (
    <div
      className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package size={20} className="text-slate-600" />
          <div>
            <h3 className="font-semibold">{pack.name}</h3>
            <p className="text-sm text-slate-600">v{pack.version}</p>
          </div>
        </div>
        <StatusBadge 
          status={isEnabled ? 'success' : 'info'} 
          text={isEnabled ? 'Enabled' : 'Disabled'} 
        />
      </div>
      
      <p className="text-sm text-slate-600 mb-3">{pack.description}</p>
      
      <div className="mb-3">
        <CharacterBudget 
          current={pack.metadata.characterCount}
          max={10000}
          label="Characters"
        />
      </div>

      {pack.dependencies.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Dependencies:</p>
          <div className="flex flex-wrap gap-1">
            {pack.dependencies.map(dep => (
              <span key={dep} className="text-xs bg-slate-100 px-2 py-1 rounded">
                {dep}
              </span>
            ))}
          </div>
        </div>
      )}

      {onToggle && (
        <button
          onClick={e => {
            e.stopPropagation();
            onToggle();
          }}
          className={`w-full px-3 py-2 text-sm rounded ${
            isEnabled 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </button>
      )}
    </div>
  );
}
