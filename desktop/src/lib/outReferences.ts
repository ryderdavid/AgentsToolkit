import { invoke } from '@tauri-apps/api/core';
import type {
  OutReference,
  OutReferenceValidationReport,
  ReferenceLink,
  OutReferenceStats,
} from './types';

// ============================================================================
// Out-Reference API
// ============================================================================

export const outReferenceApi = {
  /** List all out-references */
  listAll: () => invoke<OutReference[]>('list_out_references'),

  /** Get a single out-reference by ID */
  getById: (id: string) => invoke<OutReference>('get_out_reference', { id }),

  /** Create a new out-reference */
  create: (params: {
    name: string;
    description: string;
    category: string;
    content: string;
    format: string;
    tags: string[];
  }) => invoke<OutReference>('create_out_reference', params),

  /** Update an out-reference's content */
  update: (id: string, content: string) =>
    invoke<void>('update_out_reference', { id, content }),

  /** Update an out-reference's metadata */
  updateMetadata: (
    id: string,
    updates: {
      name?: string;
      description?: string;
      tags?: string[];
    }
  ) =>
    invoke<OutReference>('update_out_reference_metadata', {
      id,
      name: updates.name,
      description: updates.description,
      tags: updates.tags,
    }),

  /** Delete an out-reference */
  delete: (id: string) => invoke<void>('delete_out_reference', { id }),

  /** Read the content of an out-reference */
  readContent: (id: string) => invoke<string>('read_out_reference_content', { id }),

  /** Write content to an out-reference */
  writeContent: (id: string, content: string) =>
    invoke<void>('write_out_reference_content', { id, content }),

  /** Validate all out-references */
  validate: () => invoke<OutReferenceValidationReport>('validate_out_references'),

  /** Find what references a specific out-reference */
  findReferencesTo: (id: string) => invoke<ReferenceLink[]>('find_references_to', { id }),

  /** Export out-references to a JSON bundle */
  export: (ids: string[]) => invoke<string>('export_out_references', { ids }),

  /** Import out-references from a JSON bundle */
  import: (bundle: string) => invoke<OutReference[]>('import_out_references', { bundle }),

  /** Get out-reference statistics */
  getStats: () => invoke<OutReferenceStats>('get_out_reference_stats'),
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Get category display label */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    templates: 'Templates',
    examples: 'Examples',
    schemas: 'Schemas',
  };
  return labels[category] ?? category;
}

/** Get category color classes */
export function getCategoryColorClass(category: string): string {
  const colors: Record<string, string> = {
    templates: 'bg-purple-100 text-purple-700',
    examples: 'bg-green-100 text-green-700',
    schemas: 'bg-blue-100 text-blue-700',
  };
  return colors[category] ?? 'bg-slate-100 text-slate-700';
}

/** Get format display label */
export function getFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    markdown: 'Markdown',
    json: 'JSON',
    yaml: 'YAML',
    text: 'Text',
  };
  return labels[format] ?? format;
}

/** Get format badge color classes */
export function getFormatColorClass(format: string): string {
  const colors: Record<string, string> = {
    markdown: 'bg-amber-100 text-amber-700',
    json: 'bg-cyan-100 text-cyan-700',
    yaml: 'bg-rose-100 text-rose-700',
    text: 'bg-slate-100 text-slate-700',
  };
  return colors[format] ?? 'bg-slate-100 text-slate-700';
}

/** Format character count for display */
export function formatCharCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/** Get file extension from format */
export function getExtensionFromFormat(format: string): string {
  const extensions: Record<string, string> = {
    markdown: 'md',
    json: 'json',
    yaml: 'yaml',
    text: 'txt',
  };
  return extensions[format] ?? 'txt';
}

/** Detect format from file extension */
export function detectFormatFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const formats: Record<string, string> = {
    md: 'markdown',
    markdown: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    txt: 'text',
  };
  return formats[ext ?? ''] ?? 'text';
}
