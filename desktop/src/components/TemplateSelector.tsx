import { useState } from 'react';
import { ChevronDown, Check, Save, Sparkles } from 'lucide-react';
import { 
  getAllTemplatesWithCustom, 
  saveCustomTemplate,
  type ConfigurationTemplate 
} from '@/lib/agentTemplates';

interface TemplateSelectorProps {
  currentPackIds: string[];
  maxChars?: number;
  onApplyTemplate: (packIds: string[]) => void;
  onSaveAsTemplate?: () => void;
}

export function TemplateSelector({
  currentPackIds,
  maxChars,
  onApplyTemplate,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  const templates = getAllTemplatesWithCustom();
  
  // Filter templates that fit within budget
  const availableTemplates = maxChars
    ? templates.filter(t => t.characterEstimate <= maxChars)
    : templates;

  // Find matching template
  const matchingTemplate = templates.find(
    t => JSON.stringify([...t.packIds].sort()) === JSON.stringify([...currentPackIds].sort())
  );

  const handleApply = (template: ConfigurationTemplate) => {
    onApplyTemplate(template.packIds);
    setIsOpen(false);
  };

  const handleSaveCustom = () => {
    if (!customName.trim()) return;

    const template: ConfigurationTemplate = {
      id: `custom-${Date.now()}`,
      name: customName,
      description: customDescription || 'Custom template',
      packIds: currentPackIds,
      recommendedFor: ['Custom configuration'],
      characterEstimate: 0, // Will be calculated from packs
    };

    saveCustomTemplate(template);
    setShowSaveDialog(false);
    setCustomName('');
    setCustomDescription('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-slate-50 transition-colors w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-500" />
          <span>
            {matchingTemplate ? matchingTemplate.name : 'Custom Configuration'}
          </span>
        </div>
        <ChevronDown 
          size={14} 
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-80 overflow-y-auto">
            {availableTemplates.map((template) => {
              const isSelected = matchingTemplate?.id === template.id;
              const exceedsBudget = maxChars && template.characterEstimate > maxChars;

              return (
                <button
                  key={template.id}
                  onClick={() => !exceedsBudget && handleApply(template)}
                  disabled={exceedsBudget}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-b-0 ${
                    exceedsBudget ? 'opacity-50 cursor-not-allowed' : ''
                  } ${isSelected ? 'bg-purple-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        {isSelected && (
                          <Check size={14} className="text-purple-500" />
                        )}
                        {template.id.startsWith('custom-') && (
                          <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">
                          ~{template.characterEstimate.toLocaleString()} chars
                        </span>
                        {exceedsBudget && (
                          <span className="text-xs text-red-500">
                            Exceeds budget
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Save as template option */}
            <button
              onClick={() => {
                setIsOpen(false);
                setShowSaveDialog(true);
              }}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-t flex items-center gap-2 text-sm text-purple-600"
            >
              <Save size={14} />
              Save current as template...
            </button>
          </div>
        </>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowSaveDialog(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-50 p-6 w-96 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-semibold mb-4">Save as Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Custom Template"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Describe this template..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="text-sm text-slate-500">
                Includes packs: {currentPackIds.join(', ')}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={!customName.trim()}
                className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
