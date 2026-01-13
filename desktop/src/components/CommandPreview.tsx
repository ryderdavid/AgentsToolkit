import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, CheckCircle, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { commandApi, type CommandMetadata } from '@/lib/commands';
import { agentApi } from '@/lib/api';

interface CommandPreviewProps {
  command: CommandMetadata;
  initialContent?: string;
}

interface AgentPreviewContent {
  format: string;
  extension: string;
  content: string;
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function escapeToml(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function indentLines(content: string, prefix: string): string {
  return content
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}

function generatePreviewContent(
  command: CommandMetadata,
  commandContent: string,
  agentId: string
): AgentPreviewContent {
  const normalizedContent = commandContent || '';

  switch (agentId.toLowerCase()) {
    case 'cursor':
      return {
        format: 'Markdown (Cursor)',
        extension: '.md',
        content: `# /${command.id}\n\n${command.description}\n\n---\n\n${normalizedContent}`,
      };

    case 'claude':
      return {
        format: 'Markdown with Frontmatter (Claude)',
        extension: '.md',
        content: `---\nname: "${escapeYaml(command.id)}"\ndescription: "${escapeYaml(command.description)}"\n---\n\n${normalizedContent}`,
      };

    case 'gemini':
      return {
        format: 'TOML (Gemini)',
        extension: '.toml',
        content: `name = "${escapeToml(command.id)}"\ndescription = "${escapeToml(command.description)}"\ntype = "command"\n\ncontent = """\n${ensureTrailingNewline(normalizedContent)}"""`,
      };

    case 'aider':
      return {
        format: 'YAML (Aider)',
        extension: '.yaml',
        content: `---\nname: "${escapeYaml(command.id)}"\ndescription: "${escapeYaml(command.description)}"\ntype: command\ncontent: |\n${indentLines(normalizedContent, '  ')}\n---`,
      };

    case 'warp':
      {
        const warpCommand = `# ${command.description}\n${normalizedContent}`;
        return {
          format: 'Workflow YAML (Warp)',
          extension: '.yaml',
          content: [
            `name: ${command.id}`,
            `description: ${command.description}`,
            'steps:',
            '  - command: |',
            ...warpCommand.split('\n').map(line => `      ${line}`),
            `    description: "Execute ${command.id} command"`,
          ].join('\n'),
        };
      }

    case 'cline':
      return {
        format: 'JSON (Cline)',
        extension: '.json',
        content: JSON.stringify(
          {
            name: command.id,
            description: command.description,
            type: 'command',
            content: normalizedContent,
            metadata: { version: '1.0', format: 'markdown' },
          },
          null,
          2
        ),
      };

    case 'codex':
      return {
        format: 'Prompts Prefix (Codex)',
        extension: '.md',
        content: `---\nname: "/prompts:${command.id}"\ndescription: "${escapeYaml(command.description)}"\n---\n\n${normalizedContent}`,
      };

    default:
      return {
        format: 'Markdown (Default)',
        extension: '.md',
        content: `# /${command.id}\n\n${command.description}\n\n---\n\n${normalizedContent}`,
      };
  }
}

export function CommandPreview({ command, initialContent }: CommandPreviewProps) {
  const [selectedAgent, setSelectedAgent] = useState('cursor');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAllAgents(),
  });

  const {
    data: content,
    isLoading: contentLoading,
    error: contentError,
  } = useQuery({
    queryKey: ['command-content', command.id],
    queryFn: () => commandApi.loadCommandContent(command.id),
    initialData: initialContent,
    enabled: Boolean(command.id),
  });

  const hasContentError = Boolean(contentError);
  const commandContent = content ?? '';
  const preview = generatePreviewContent(command, commandContent, selectedAgent);

  const handleCopy = async () => {
    if (contentLoading || hasContentError) {
      return;
    }
    await navigator.clipboard.writeText(preview.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="font-medium">Agent Format Preview</span>
        <ChevronDown
          size={18}
          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Agent Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-600">Preview for agent:</label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {agents?.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          {/* Format Info */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              Format: <strong>{preview.format}</strong>
            </span>
            <span className="text-slate-500">
              Extension: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{preview.extension}</code>
            </span>
            <span className="text-slate-500">
              Characters: <strong>{preview.content.length.toLocaleString()}</strong>
            </span>
          </div>

          {/* Preview Content */}
          <div className="relative">
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 text-xs bg-white/90 hover:bg-white border rounded transition-colors"
            >
              {copied ? (
                <>
                  <CheckCircle size={12} className="text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy
                </>
              )}
            </button>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm overflow-x-auto max-h-64 whitespace-pre-wrap">
              {contentLoading ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <Loader2 className="animate-spin" size={16} />
                  Loading command content...
                </div>
              ) : hasContentError ? (
                <div className="flex items-center gap-2 text-red-200">
                  <AlertCircle size={16} />
                  Unable to load command content
                </div>
              ) : (
                preview.content
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
