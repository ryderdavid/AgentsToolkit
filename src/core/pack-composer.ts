/**
 * Pack Composer
 * 
 * Utilities for composing multiple rule packs into AGENTS.md content.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  BudgetInfo,
  PackBudgetItem,
  ValidationResult,
  GenerateOptions,
  GenerateResult,
  CompositionConfig
} from './pack-composer-types';
import type { LoadedPack } from './rule-pack-types';
import {
  loadPackFull,
  resolveDependencies,
  validatePack,
  listAvailablePacks,
  getPacksDirectory
} from './rule-pack-loader';
import { getMaxCharacters } from './agent-capabilities';

/**
 * Known agent character limits
 */
const AGENT_CHAR_LIMITS: Record<string, number | null> = {
  'cursor': 1000000,
  'claude': 200000,
  'copilot': 8000,
  'gemini': 1000000,
  'codex': 50000,
  'aider': null,  // No limit
  'jules': null,  // No limit
};

/**
 * Get character limit for an agent
 */
export function getAgentCharLimit(agentId: string): number | null {
  // Try to get from agent-capabilities first
  try {
    const limit = getMaxCharacters(agentId);
    if (limit !== null) {
      return limit;
    }
  } catch {
    // Fall back to hardcoded limits
  }
  return AGENT_CHAR_LIMITS[agentId.toLowerCase()] ?? null;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Compose multiple packs into a single content string
 */
export function composePacks(packIds: string[], baseDir?: string): string {
  const loadedPacks: LoadedPack[] = [];
  const seen = new Set<string>();

  // Resolve all dependencies and load packs in order
  for (const packId of packIds) {
    const resolution = resolveDependencies(packId, baseDir);
    if (!resolution.success) {
      throw new Error(`Failed to resolve dependencies for ${packId}: ${resolution.error}`);
    }

    for (const id of resolution.order) {
      if (!seen.has(id)) {
        seen.add(id);
        loadedPacks.push(loadPackFull(id, baseDir));
      }
    }
  }

  // Compose content
  const sections: string[] = [];
  
  for (const pack of loadedPacks) {
    sections.push(`<!-- Pack: ${pack.id} v${pack.version} -->`);
    sections.push(pack.content);
  }

  return sections.join('\n\n');
}

/**
 * Calculate budget information for a pack composition
 */
export function calculateBudget(
  packIds: string[],
  agentId?: string,
  baseDir?: string
): BudgetInfo {
  const packBreakdown: PackBudgetItem[] = [];
  let totalChars = 0;
  let totalWords = 0;

  // Load each pack and calculate its contribution
  const seen = new Set<string>();
  for (const packId of packIds) {
    const resolution = resolveDependencies(packId, baseDir);
    if (!resolution.success) {
      throw new Error(`Failed to resolve dependencies: ${resolution.error}`);
    }

    for (const id of resolution.order) {
      if (!seen.has(id)) {
        seen.add(id);
        const pack = loadPackFull(id, baseDir);
        totalChars += pack.actualCharacterCount;
        totalWords += pack.actualWordCount;
        packBreakdown.push({
          packId: id,
          chars: pack.actualCharacterCount,
          words: pack.actualWordCount,
          percentageOfTotal: 0  // Will be calculated below
        });
      }
    }
  }

  // Calculate percentages
  for (const item of packBreakdown) {
    item.percentageOfTotal = totalChars > 0 
      ? Math.round((item.chars / totalChars) * 100) 
      : 0;
  }

  // Get agent limit
  const maxChars = agentId ? getAgentCharLimit(agentId) : null;
  const percentage = maxChars !== null 
    ? Math.round((totalChars / maxChars) * 100) 
    : null;
  const withinLimit = maxChars === null || totalChars <= maxChars;

  return {
    totalChars,
    maxChars,
    percentage,
    withinLimit,
    packBreakdown
  };
}

/**
 * Validate a pack composition for an agent
 */
export function validateComposition(
  packIds: string[],
  agentId?: string,
  baseDir?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate each pack
  for (const packId of packIds) {
    const result = validatePack(packId, baseDir);
    for (const error of result.errors) {
      errors.push(`[${error.packId}] ${error.message}`);
    }
    for (const warning of result.warnings) {
      warnings.push(`[${warning.packId}] ${warning.message}`);
    }
  }

  // Check budget if agent specified
  if (agentId && errors.length === 0) {
    const budget = calculateBudget(packIds, agentId, baseDir);
    if (!budget.withinLimit) {
      errors.push(
        `Composition exceeds ${agentId} character limit: ` +
        `${budget.totalChars} / ${budget.maxChars} (${budget.percentage}%)`
      );
    } else if (budget.percentage !== null && budget.percentage > 80) {
      warnings.push(
        `Composition uses ${budget.percentage}% of ${agentId} character limit`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate AGENTS.md content from pack composition
 */
export function generateAgentsMdContent(
  packIds: string[],
  options: Partial<GenerateOptions> = {},
  baseDir?: string
): string {
  const includeMetadata = options.includeMetadata ?? true;
  const inlineContent = options.inlineContent ?? false;

  const lines: string[] = [];

  // Header
  lines.push('# AGENTS.md — Mandatory Agent Behavior & Workflow Standards');
  lines.push('');
  lines.push('Non-negotiable rules for all AI agents. Violations constitute workflow failures.');
  lines.push('');
  lines.push('**Version:** 2.0.0 (Modular Rule Packs)  ');
  lines.push('**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Active Rule Packs');
  lines.push('');

  // List active packs
  const packs = packIds.map(id => {
    try {
      return loadPackFull(id, baseDir);
    } catch {
      return null;
    }
  }).filter((p): p is LoadedPack => p !== null);

  for (const pack of packs) {
    lines.push(`- **${pack.name}** (\`rule-packs/${pack.id}/\`) — ${pack.description}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  if (inlineContent) {
    // Inline all content
    lines.push(composePacks(packIds, baseDir));
  } else {
    // Use import syntax
    lines.push('<!-- BEGIN PACK IMPORTS -->');
    lines.push('');

    for (const pack of packs) {
      for (const file of pack.files) {
        lines.push(`@rule-packs/${pack.id}/${file}`);
      }
      lines.push('');
    }

    lines.push('<!-- END PACK IMPORTS -->');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Budget info
  if (includeMetadata) {
    lines.push('## Configuration');
    lines.push('');
    lines.push('**Character Budget:**');
    
    const budget = calculateBudget(packIds, undefined, baseDir);
    for (const item of budget.packBreakdown) {
      const pack = packs.find(p => p.id === item.packId);
      lines.push(`- ${pack?.name || item.packId}: ~${item.words} words (~${item.chars} chars)`);
    }
    lines.push(`- **Total:** ~${budget.packBreakdown.reduce((a, b) => a + b.words, 0)} words (~${budget.totalChars} chars)`);
  }

  return lines.join('\n');
}

/**
 * Generate AGENTS.md file from pack composition
 */
export function generateAgentsMd(
  options: GenerateOptions,
  baseDir?: string
): GenerateResult {
  try {
    const content = generateAgentsMdContent(options.packIds, options, baseDir);
    const budget = calculateBudget(options.packIds, undefined, baseDir);

    // Write to file
    const outputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, content, 'utf-8');

    return {
      success: true,
      content,
      outputPath: options.outputPath,
      budget
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      outputPath: options.outputPath,
      budget: {
        totalChars: 0,
        maxChars: null,
        percentage: null,
        withinLimit: true,
        packBreakdown: []
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get recommended pack combinations for different use cases
 */
export function getRecommendedConfigs(): CompositionConfig[] {
  return [
    {
      packs: ['core', 'github-hygiene'],
      header: 'Standard GitHub workflow configuration'
    },
    {
      packs: ['core', 'azure-devops'],
      header: 'Azure DevOps workflow configuration'
    },
    {
      packs: ['core'],
      header: 'Minimal VCS-agnostic configuration'
    }
  ];
}
