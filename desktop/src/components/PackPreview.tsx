import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { packApi } from '@/lib/api';

type PackPreviewProps = {
  packId: string;
  forceExpanded?: boolean;
};

export function PackPreview({ packId, forceExpanded = false }: PackPreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pack', 'preview', packId],
    queryFn: () => packApi.loadPackFull(packId),
    staleTime: 1000 * 60 * 5,
  });

  const { data: fileContent, isLoading: isFileLoading } = useQuery({
    queryKey: ['pack', 'file', packId, selectedFile],
    queryFn: () => packApi.loadPackFile(packId, selectedFile ?? ''),
    enabled: !!selectedFile,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data && data.files.length > 0) {
      setSelectedFile(data.files[0]);
    }
  }, [data]);

  useEffect(() => {
    setExpanded(forceExpanded);
  }, [forceExpanded]);

  const content = useMemo(() => fileContent ?? '', [fileContent]);
  const filteredContent = useMemo(() => {
    if (!searchTerm) return content;
    const regex = new RegExp(searchTerm, 'ig');
    return content.replace(regex, match => `**${match}**`);
  }, [content, searchTerm]);

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
  };

  if (isLoading || !data) {
    return <div className="h-48 bg-slate-100 rounded-lg animate-pulse" />;
  }

  return (
    <div className="border rounded-lg p-3 bg-slate-50">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={selectedFile ?? ''}
          onChange={e => setSelectedFile(e.target.value)}
          className="px-2 py-1 text-sm border border-slate-200 rounded"
        >
          {data.files.map(file => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search content"
          className="flex-1 min-w-[180px] px-2 py-1 text-sm border border-slate-200 rounded"
        />
        {isFileLoading && <span className="text-xs text-slate-500">Loading file…</span>}
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-sm rounded border border-slate-200 hover:bg-slate-100"
        >
          Copy Content
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          className="px-2 py-1 text-sm rounded border border-slate-200 hover:bg-slate-100"
        >
          {expanded ? 'Collapse' : 'View Full Content'}
        </button>
      </div>

      <div
        className={`overflow-auto border rounded bg-white ${expanded ? 'max-h-[520px]' : 'max-h-64'}`}
      >
        <div className="grid grid-cols-[48px_1fr] text-sm font-mono">
          <div className="bg-slate-50 text-slate-500 border-r border-slate-200">
            {filteredContent.split('\n').map((_, idx) => (
              <div key={idx} className="px-2 py-1 leading-5">
                {idx + 1}
              </div>
            ))}
          </div>
          <div className="px-3 py-2 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {filteredContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-600 flex gap-3">
        <span>Characters: {data.actualCharacterCount.toLocaleString()}</span>
        <span>Words: {data.actualWordCount.toLocaleString()}</span>
        <span>Files: {data.files.length}</span>
      </div>
    </div>
  );
}
