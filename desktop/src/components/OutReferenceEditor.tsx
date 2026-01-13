import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatCharCount } from '@/lib/outReferences';
import type { FileFormat } from '@/lib/types';

interface OutReferenceEditorProps {
  content: string;
  format: FileFormat;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

export function OutReferenceEditor({
  content,
  format,
  onChange,
  readOnly = false,
}: OutReferenceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Sync with external content
  useEffect(() => {
    setLocalContent(content);
    updateCounts(content);
  }, [content]);

  const updateCounts = (text: string) => {
    setCharCount(text.length);
    setWordCount(text.split(/\s+/).filter(w => w.length > 0).length);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    updateCounts(newContent);
    onChange(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent =
        localContent.substring(0, start) + '  ' + localContent.substring(end);
      setLocalContent(newContent);
      onChange(newContent);

      // Move cursor after the inserted spaces
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
        }
      });
    }

    // Save on Cmd/Ctrl+S
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      // Parent component handles the actual save
    }
  };

  const getLanguageHint = () => {
    switch (format) {
      case 'markdown':
        return 'Markdown';
      case 'json':
        return 'JSON';
      case 'yaml':
        return 'YAML';
      default:
        return 'Plain Text';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase">
            {getLanguageHint()}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{formatCharCount(charCount)} chars</span>
          <span>{wordCount} words</span>
          <button
            onClick={() => setShowPreview(p => !p)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
            type="button"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className={`relative ${showPreview ? 'grid md:grid-cols-2' : ''}`}>
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={format === 'markdown' || format === 'text'}
          className={`w-full min-h-[400px] p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none ${
            readOnly ? 'bg-slate-50 text-slate-600' : 'bg-white'
          } ${showPreview ? 'border-r md:border-r' : ''}`}
          placeholder={getPlaceholder(format)}
        />
        {showPreview && (
          <div className="min-h-[400px] p-4 bg-white overflow-auto border-t md:border-t-0">
            {format === 'markdown' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
                {localContent || '*Nothing to preview*'}
              </ReactMarkdown>
            ) : (
              <pre className="text-sm bg-slate-50 p-3 rounded border overflow-auto">
                {localContent || 'Nothing to preview'}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Format-specific validation hints */}
      {format === 'json' && <JsonValidationHint content={localContent} />}
    </div>
  );
}

function getPlaceholder(format: FileFormat): string {
  switch (format) {
    case 'markdown':
      return '# Title\n\nStart writing your markdown content here...';
    case 'json':
      return '{\n  "key": "value"\n}';
    case 'yaml':
      return 'key: value\nlist:\n  - item1\n  - item2';
    default:
      return 'Enter content here...';
  }
}

function JsonValidationHint({ content }: { content: string }) {
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!content.trim()) {
      setIsValid(true);
      setError(null);
      return;
    }

    try {
      JSON.parse(content);
      setIsValid(true);
      setError(null);
    } catch (e) {
      setIsValid(false);
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [content]);

  if (isValid) return null;

  return (
    <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
      JSON Error: {error}
    </div>
  );
}
