import { Terminal, Package, ExternalLink } from 'lucide-react';
import type { ReferenceLink } from '@/lib/types';

interface ReferenceLinkListProps {
  links: ReferenceLink[];
  onNavigate?: (type: string, id: string) => void;
}

export function ReferenceLinkList({ links, onNavigate }: ReferenceLinkListProps) {
  if (links.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No references found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div
          key={`${link.linkType}-${link.id}-${index}`}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            {link.linkType === 'command' ? (
              <Terminal className="text-blue-500" size={20} />
            ) : (
              <Package className="text-purple-500" size={20} />
            )}
            <div>
              <h4 className="font-medium text-slate-900">{link.name}</h4>
              <p className="text-xs text-slate-500">
                {link.linkType === 'command' ? 'Command' : 'Rule Pack'} • {link.linkCount}{' '}
                {link.linkCount === 1 ? 'reference' : 'references'}
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate(link.linkType, link.id)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              title="Go to source"
            >
              <ExternalLink size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
