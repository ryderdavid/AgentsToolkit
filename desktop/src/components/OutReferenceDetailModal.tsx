import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, Copy, Download, Link2, FileText, AlertTriangle } from 'lucide-react';
import { outReferenceApi, getCategoryLabel, getFormatLabel, formatCharCount } from '@/lib/outReferences';
import { OutReferenceEditor } from '@/components/OutReferenceEditor';
import { ReferenceLinkList } from '@/components/ReferenceLinkList';
import type { OutReference, OutReferenceCategory, FileFormat } from '@/lib/types';

interface OutReferenceDetailModalProps {
  refId: string | null;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  initialContent?: string;
  initialName?: string;
  initialDescription?: string;
  initialCategory?: OutReferenceCategory;
  initialFormat?: FileFormat;
  onChooseTemplate?: () => void;
}

type TabId = 'content' | 'metadata' | 'links';

const CATEGORIES: Array<{ value: OutReferenceCategory; label: string }> = [
  { value: 'templates', label: 'Templates' },
  { value: 'examples', label: 'Examples' },
  { value: 'schemas', label: 'Schemas' },
];

const FORMATS: Array<{ value: FileFormat; label: string }> = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'text', label: 'Text' },
];

export function OutReferenceDetailModal({
  refId,
  onClose,
  onSave,
  onDelete,
  initialContent = '',
  initialName = '',
  initialDescription = '',
  initialCategory = 'templates',
  initialFormat = 'markdown',
  onChooseTemplate,
}: OutReferenceDetailModalProps) {
  const queryClient = useQueryClient();
  const isCreating = refId === null;

  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [content, setContent] = useState(initialContent);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState<OutReferenceCategory>(initialCategory);
  const [format, setFormat] = useState<FileFormat>(initialFormat);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load existing reference
  const { data: existingRef } = useQuery({
    queryKey: ['out-reference', refId],
    queryFn: () => (refId ? outReferenceApi.getById(refId) : null),
    enabled: !!refId,
  });

  // Load content
  const { data: existingContent } = useQuery({
    queryKey: ['out-reference-content', refId],
    queryFn: () => (refId ? outReferenceApi.readContent(refId) : null),
    enabled: !!refId,
  });

  // Load references to this
  const { data: linkedFrom } = useQuery({
    queryKey: ['out-reference-links', refId],
    queryFn: () => (refId ? outReferenceApi.findReferencesTo(refId) : []),
    enabled: !!refId,
  });

  // Initialize form state
  useEffect(() => {
    if (existingRef) {
      setName(existingRef.name);
      setDescription(existingRef.description);
      setCategory(existingRef.category);
      setFormat(existingRef.format);
      setTags(existingRef.tags);
    }
  }, [existingRef]);

  useEffect(() => {
    if (existingContent !== undefined && existingContent !== null) {
      setContent(existingContent);
    }
  }, [existingContent]);

  useEffect(() => {
    if (isCreating) {
      setContent(initialContent);
      setName(initialName);
      setDescription(initialDescription);
      setCategory(initialCategory);
      setFormat(initialFormat);
    }
  }, [isCreating, initialContent, initialName, initialDescription, initialCategory, initialFormat]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: () =>
      outReferenceApi.create({
        name,
        description,
        category,
        content,
        format,
        tags,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['out-references'] });
      onSave();
    },
  });

  const updateContentMutation = useMutation({
    mutationFn: () => outReferenceApi.update(refId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['out-references'] });
      queryClient.invalidateQueries({ queryKey: ['out-reference', refId] });
      setHasChanges(false);
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: () =>
      outReferenceApi.updateMetadata(refId!, { name, description, tags }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['out-references'] });
      queryClient.invalidateQueries({ queryKey: ['out-reference', refId] });
      setHasChanges(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => outReferenceApi.delete(refId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['out-references'] });
      onDelete();
      onClose();
    },
  });

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate();
    } else {
      // Save both content and metadata
      updateContentMutation.mutate();
      updateMetadataMutation.mutate();
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
      setHasChanges(true);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    setHasChanges(true);
  };

  const handleCopyPath = () => {
    if (existingRef) {
      navigator.clipboard.writeText(existingRef.filePath);
    }
  };

  const handleExport = async () => {
    if (refId) {
      const bundle = await outReferenceApi.export([refId]);
      const blob = new Blob([bundle], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name || 'out-reference'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'content', label: 'Content' },
    { id: 'metadata', label: 'Metadata' },
    { id: 'links', label: `Linked From (${linkedFrom?.length ?? 0})` },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="text-slate-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold">
                {isCreating ? 'Create Out-Reference' : existingRef?.name ?? 'Loading...'}
              </h2>
              {existingRef && (
                <p className="text-sm text-slate-500">{existingRef.filePath}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCreating && (
              <>
                <button
                  onClick={handleCopyPath}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                  title="Copy file path"
                >
                  <Copy size={18} />
                </button>
                <button
                  onClick={handleExport}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                  title="Export"
                >
                  <Download size={18} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'content' && (
            <div className="space-y-4">
              {isCreating && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value as OutReferenceCategory)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Format
                    </label>
                    <select
                      value={format}
                      onChange={e => setFormat(e.target.value as FileFormat)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {FORMATS.map(fmt => (
                        <option key={fmt.value} value={fmt.value}>
                          {fmt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {isCreating && onChooseTemplate && (
                <div className="flex justify-end">
                  <button
                    onClick={onChooseTemplate}
                    className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                  >
                    Choose Template
                  </button>
                </div>
              )}
              <OutReferenceEditor
                content={content}
                format={existingRef?.format ?? format}
                onChange={handleContentChange}
              />
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a name for this reference"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => {
                    setDescription(e.target.value);
                    setHasChanges(true);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this reference is used for"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a tag..."
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-slate-100 rounded"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {existingRef && (
                <div className="pt-4 border-t space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-medium">{getCategoryLabel(existingRef.category)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-medium">{getFormatLabel(existingRef.format)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Character count:</span>
                    <span className="font-medium">{formatCharCount(existingRef.characterCount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Word count:</span>
                    <span className="font-medium">{existingRef.wordCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium">
                      {new Date(existingRef.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated:</span>
                    <span className="font-medium">
                      {new Date(existingRef.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'links' && (
            <div>
              {linkedFrom && linkedFrom.length > 0 ? (
                <ReferenceLinkList links={linkedFrom} />
              ) : (
                <div className="text-center py-8">
                  <Link2 className="mx-auto mb-2 text-slate-400" size={32} />
                  <p className="text-slate-500">No commands or packs reference this file</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <div>
            {!isCreating && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateContentMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {isCreating ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-xl">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <AlertTriangle size={24} />
                <h3 className="font-semibold">Delete Out-Reference?</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                This will permanently delete "{existingRef?.name}" and remove the file from disk.
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
