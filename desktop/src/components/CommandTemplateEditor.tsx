import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, FileText, Eye, Loader2 } from 'lucide-react';
import type { CommandMetadata } from '@/lib/commands';

interface CommandTemplateEditorProps {
  command: CommandMetadata;
  onSave?: (template: string) => void;
}

/**
 * Visual editor for command templates (walkthrough, issue, pr)
 * Allows customizing template variables and previewing output
 */
export function CommandTemplateEditor({ command, onSave }: CommandTemplateEditorProps) {
  const [template, setTemplate] = useState<string>(command.template ?? '');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const queryClient = useQueryClient();

  // Initialize template from command
  useEffect(() => {
    if (command.template) {
      setTemplate(command.template);
      
      // Extract variables from template (e.g., {issue}, {branch-name})
      const variableMatches = command.template.match(/\{([^}]+)\}/g) || [];
      const extractedVars: Record<string, string> = {};
      for (const match of variableMatches) {
        const varName = match.slice(1, -1);
        extractedVars[varName] = '';
      }
      setVariables(extractedVars);
    }
  }, [command.template]);

  // Track changes
  useEffect(() => {
    setHasChanges(template !== command.template);
  }, [template, command.template]);

  // Generate preview with variable substitution
  const preview = template.replace(/\{([^}]+)\}/g, (match, varName) => {
    const value = variables[varName];
    if (value) return value;
    return `<${varName}>`;
  });

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setTemplate(command.template ?? '');
    setHasChanges(false);
  };

  const handleSave = () => {
    onSave?.(template);
    setHasChanges(false);
  };

  if (!command.template) {
    return (
      <div className="p-6 text-center text-slate-500">
        <FileText size={32} className="mx-auto mb-2 opacity-50" />
        <p>This command does not have a template.</p>
      </div>
    );
  }

  const variableNames = Object.keys(variables);

  return (
    <div className="space-y-6">
      {/* Variable inputs */}
      {variableNames.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-slate-700">Template Variables</h4>
          <div className="grid grid-cols-2 gap-4">
            {variableNames.map(name => (
              <div key={name}>
                <label className="block text-xs text-slate-500 mb-1">{name}</label>
                <input
                  type="text"
                  value={variables[name] ?? ''}
                  onChange={e => handleVariableChange(name, e.target.value)}
                  placeholder={`Enter ${name}...`}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-slate-700">Template</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                showPreview ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Eye size={12} />
              Preview
            </button>
          </div>
        </div>
        
        <div className={`grid ${showPreview ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
          {/* Editor */}
          <div>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="w-full h-64 p-4 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter template content..."
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="h-64 overflow-y-auto p-4 bg-slate-50 border rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{preview}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <span className="text-xs text-slate-500">
          {hasChanges ? 'Unsaved changes' : 'No changes'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            Save Template
          </button>
        </div>
      </div>
    </div>
  );
}
