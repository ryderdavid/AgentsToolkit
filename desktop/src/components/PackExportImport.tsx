import { useRef, useState } from 'react';
import { usePackStore } from '@/stores/packStore';

type ExportPayload = {
  version: string;
  enabledPacks: string[];
  selectedAgent: string | null;
  timestamp: string;
};

export function PackExportImport() {
  const { enabledPackIds, selectedAgentId, enablePacks, setSelectedAgent, disablePacks } = usePackStore();
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async () => {
    const payload: ExportPayload = {
      version: '1.0',
      enabledPacks: enabledPackIds,
      selectedAgent: selectedAgentId,
      timestamp: new Date().toISOString(),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pack-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      fileInputRef.current?.click();
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const payload: ExportPayload = {
      version: '1.0',
      enabledPacks: enabledPackIds,
      selectedAgent: selectedAgentId,
      timestamp: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload));
  };

  const handleClear = () => disablePacks(enabledPackIds);

  const handleLoadFromUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(urlInput.trim());
      const payload = (await res.json()) as ExportPayload;
      if (!Array.isArray(payload.enabledPacks)) throw new Error('Invalid config from URL');
      await enablePacks(payload.enabledPacks);
      if (payload.selectedAgent) setSelectedAgent(payload.selectedAgent);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        onClick={handleExport}
        className="px-3 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50"
      >
        Export
      </button>
      <div className="flex items-center gap-1">
        <button
          onClick={handleImport}
          className="px-3 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
          disabled={loading}
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            const payload = JSON.parse(text) as ExportPayload;
            if (Array.isArray(payload.enabledPacks)) {
              await enablePacks(payload.enabledPacks);
              if (payload.selectedAgent) setSelectedAgent(payload.selectedAgent);
            }
          }}
        />
      </div>
      <button
        onClick={handleShare}
        className="px-3 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50"
      >
        Share
      </button>
      <button
        onClick={handleClear}
        className="px-3 py-1.5 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50"
      >
        Clear
      </button>
      <input
        value={urlInput}
        onChange={e => setUrlInput(e.target.value)}
        placeholder="Load from URL"
        className="text-xs border border-slate-200 rounded px-2 py-1 min-w-[180px]"
      />
      <button
        onClick={handleLoadFromUrl}
        className="px-3 py-1.5 text-xs rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        disabled={loading}
      >
        Load
      </button>
    </div>
  );
}
