import { useEffect, useState } from 'react';
import type { CompositionConfig } from '@core/pack-composer-types';

type PresetSelectorProps = {
  presets: CompositionConfig[];
  onSelect: (packIds: string[]) => void;
  onReset?: () => void;
};

const DEFAULT_PRESETS = [
  { name: 'Minimal', packs: ['core'] },
  { name: 'GitHub Standard', packs: ['core', 'github-hygiene'] },
  { name: 'Azure DevOps', packs: ['core', 'azure-devops'] },
  { name: 'Maximum', packs: ['core', 'github-hygiene', 'azure-devops'] },
];

type CustomPreset = { name: string; packs: string[] };

export function PresetSelector({ presets, onSelect, onReset }: PresetSelectorProps) {
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [savingName, setSavingName] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('custom-presets');
    if (stored) {
      setCustomPresets(JSON.parse(stored));
    }
  }, []);

  const handleSelect = (packs: string[]) => {
    onSelect(packs);
  };

  const handleSave = () => {
    if (!savingName.trim()) return;
    const next = [...customPresets, { name: savingName.trim(), packs: [] }];
    setCustomPresets(next);
    localStorage.setItem('custom-presets', JSON.stringify(next));
    setSavingName('');
  };

  const handleDelete = (name: string) => {
    const next = customPresets.filter(p => p.name !== name);
    setCustomPresets(next);
    localStorage.setItem('custom-presets', JSON.stringify(next));
  };

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={e => {
          const value = e.target.value;
          const foundCustom = customPresets.find(p => p.name === value);
          if (foundCustom) {
            handleSelect(foundCustom.packs);
            return;
          }
          const foundDefault = DEFAULT_PRESETS.find(p => p.name === value);
          if (foundDefault) {
            handleSelect(foundDefault.packs);
            return;
          }
          const found = presets.find(p => p.header === value);
          if (found) handleSelect(found.packs);
        }}
        className="text-sm border border-slate-200 rounded px-2 py-1"
      >
        <option value="">Load Preset</option>
        {DEFAULT_PRESETS.map(preset => (
          <option key={preset.name} value={preset.name}>
            {preset.name}
          </option>
        ))}
        {presets.map(preset => (
          <option key={preset.header} value={preset.header}>
            {preset.header}
          </option>
        ))}
        {customPresets.map(preset => (
          <option key={preset.name} value={preset.name}>
            {preset.name} (custom)
          </option>
        ))}
      </select>

      <input
        value={savingName}
        onChange={e => setSavingName(e.target.value)}
        placeholder="Save current as preset"
        className="text-sm border border-slate-200 rounded px-2 py-1"
      />
      <button
        onClick={handleSave}
        className="px-2 py-1 text-sm rounded border border-slate-200 hover:bg-slate-50"
      >
        Save
      </button>
      {onReset && (
        <button
          onClick={onReset}
          className="px-2 py-1 text-sm rounded border border-slate-200 hover:bg-slate-50"
        >
          Reset
        </button>
      )}
      {customPresets.length > 0 && (
        <button
          onClick={() => handleDelete(customPresets[customPresets.length - 1].name)}
          className="px-2 py-1 text-sm rounded border border-red-200 text-red-700 hover:bg-red-50"
        >
          Delete last custom
        </button>
      )}
    </div>
  );
}
