import { Package } from 'lucide-react';

export function RulePacksView() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Rule Packs</h1>
      <p className="text-slate-600 mb-8">
        Manage and configure modular rule packs for your agents.
      </p>
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
        <Package size={48} className="mx-auto mb-4 text-slate-400" />
        <p className="text-slate-500">Rule pack management coming in Phase 4</p>
      </div>
    </div>
  );
}
