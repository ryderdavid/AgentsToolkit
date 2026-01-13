/**
 * Rule Pack Loader
 * 
 * Utilities for loading and validating rule packs.
 */

import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ErrorObject } from 'ajv';
import type {
  RulePack,
  LoadedPack,
  PackMetadata,
  PackValidationResult,
  PackValidationError,
  DependencyResolution
} from './rule-pack-types';
import rulePackSchema from '../../schemas/rule-pack.schema.json';

/** Default rule packs directory relative to project root */
const DEFAULT_PACKS_DIR = 'rule-packs';

/** AJV instance for schema validation */
const ajv = new Ajv({ allErrors: true });
const validatePackSchemaFn = ajv.compile<RulePack>(rulePackSchema as Record<string, unknown>);

/**
 * Format AJV validation error for display
 */
function formatSchemaError(err: ErrorObject): string {
  const location = err.instancePath || '/';
  const message = err.message ?? 'validation error';
  return `${location} ${message}`.trim();
}

/**
 * Get the rule packs directory path
 */
export function getPacksDirectory(baseDir?: string): string {
  const base = baseDir || process.env.AGENTSMD_HOME || process.cwd();
  return path.join(base, DEFAULT_PACKS_DIR);
}

/**
 * Load a pack's metadata from pack.json
 */
export function loadPack(packId: string, baseDir?: string): RulePack {
  const packsDir = getPacksDirectory(baseDir);
  const packDir = path.join(packsDir, packId);
  const packJsonPath = path.join(packDir, 'pack.json');

  if (!fs.existsSync(packJsonPath)) {
    throw new Error(`Pack not found: ${packId} (looked in ${packJsonPath})`);
  }

  const content = fs.readFileSync(packJsonPath, 'utf-8');
  const pack: RulePack = JSON.parse(content);

  // Validate basic structure
  if (pack.id !== packId) {
    throw new Error(`Pack ID mismatch: expected ${packId}, got ${pack.id}`);
  }

  return pack;
}

/**
 * Resolve dependency tree for a pack
 * Returns ordered list of pack IDs to load (dependencies first)
 */
export function resolveDependencies(
  packId: string,
  baseDir?: string,
  visited: Set<string> = new Set(),
  path: string[] = []
): DependencyResolution {
  // Check for circular dependency
  if (visited.has(packId)) {
    return {
      order: [],
      success: false,
      error: `Circular dependency detected`,
      circularPath: [...path, packId]
    };
  }

  visited.add(packId);
  path.push(packId);

  try {
    const pack = loadPack(packId, baseDir);
    const order: string[] = [];

    // Resolve dependencies first
    for (const depId of pack.dependencies) {
      const depResult = resolveDependencies(depId, baseDir, new Set(visited), [...path]);
      if (!depResult.success) {
        return depResult;
      }
      // Add dependencies we haven't seen yet
      for (const id of depResult.order) {
        if (!order.includes(id)) {
          order.push(id);
        }
      }
    }

    // Add this pack
    if (!order.includes(packId)) {
      order.push(packId);
    }

    return { order, success: true };
  } catch (error) {
    return {
      order: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Load and concatenate markdown content for a pack
 */
export function loadPackContent(packId: string, baseDir?: string): string {
  const packsDir = getPacksDirectory(baseDir);
  const packDir = path.join(packsDir, packId);
  const pack = loadPack(packId, baseDir);

  const contents: string[] = [];

  for (const file of pack.files) {
    const filePath = path.join(packDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Pack file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    contents.push(content);
  }

  return contents.join('\n\n---\n\n');
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Load a pack with resolved content
 */
export function loadPackFull(packId: string, baseDir?: string): LoadedPack {
  const packsDir = getPacksDirectory(baseDir);
  const packDir = path.join(packsDir, packId);
  const pack = loadPack(packId, baseDir);
  const content = loadPackContent(packId, baseDir);

  return {
    ...pack,
    path: packDir,
    content,
    actualWordCount: countWords(content),
    actualCharacterCount: content.length
  };
}

/**
 * Validate a pack against the schema and check file existence
 */
export function validatePack(packId: string, baseDir?: string): PackValidationResult {
  const errors: PackValidationError[] = [];
  const warnings: PackValidationError[] = [];
  const packsDir = getPacksDirectory(baseDir);
  const packDir = path.join(packsDir, packId);

  // First, validate against JSON schema
  const schemaErrors = validatePackAgainstSchema(packId, baseDir);
  errors.push(...schemaErrors);

  // If schema validation failed, return early
  if (schemaErrors.length > 0) {
    return {
      valid: false,
      errors,
      warnings
    };
  }

  try {
    const pack = loadPack(packId, baseDir);

    // Check required fields (redundant with schema but kept for clarity)
    const requiredFields = ['id', 'name', 'version', 'description', 'files', 'metadata'];
    for (const field of requiredFields) {
      if (!(field in pack)) {
        errors.push({
          packId,
          message: `Missing required field: ${field}`,
          severity: 'error'
        });
      }
    }

    // Check files exist
    for (const file of pack.files) {
      const filePath = path.join(packDir, file);
      if (!fs.existsSync(filePath)) {
        errors.push({
          packId,
          message: `File not found: ${file}`,
          severity: 'error',
          file
        });
      }
    }

    // Check dependencies exist
    for (const depId of pack.dependencies) {
      try {
        loadPack(depId, baseDir);
      } catch {
        errors.push({
          packId,
          message: `Dependency not found: ${depId}`,
          severity: 'error'
        });
      }
    }

    // Check for circular dependencies
    const depResult = resolveDependencies(packId, baseDir);
    if (!depResult.success && depResult.circularPath) {
      errors.push({
        packId,
        message: `Circular dependency: ${depResult.circularPath.join(' -> ')}`,
        severity: 'error'
      });
    }

    // Warn if metadata counts are significantly off
    if (pack.files.length > 0 && errors.length === 0) {
      const loaded = loadPackFull(packId, baseDir);
      const wordDiff = Math.abs(loaded.actualWordCount - pack.metadata.wordCount);
      const charDiff = Math.abs(loaded.actualCharacterCount - pack.metadata.characterCount);

      if (wordDiff > pack.metadata.wordCount * 0.2) {
        warnings.push({
          packId,
          message: `Word count mismatch: declared ${pack.metadata.wordCount}, actual ${loaded.actualWordCount}`,
          severity: 'warning'
        });
      }

      if (charDiff > pack.metadata.characterCount * 0.2) {
        warnings.push({
          packId,
          message: `Character count mismatch: declared ${pack.metadata.characterCount}, actual ${loaded.actualCharacterCount}`,
          severity: 'warning'
        });
      }
    }

  } catch (error) {
    errors.push({
      packId,
      message: error instanceof Error ? error.message : String(error),
      severity: 'error'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate pack.json against the JSON schema only (no file existence checks)
 * Returns schema validation errors for the given pack.
 */
export function validatePackAgainstSchema(packId: string, baseDir?: string): PackValidationError[] {
  const errors: PackValidationError[] = [];
  const packsDir = getPacksDirectory(baseDir);
  const packJsonPath = path.join(packsDir, packId, 'pack.json');

  if (!fs.existsSync(packJsonPath)) {
    errors.push({
      packId,
      message: `pack.json not found at ${packJsonPath}`,
      severity: 'error'
    });
    return errors;
  }

  try {
    const content = fs.readFileSync(packJsonPath, 'utf-8');
    const packData = JSON.parse(content);

    // Validate against JSON schema using the module-level compiled validator
    const isValid = validatePackSchemaFn(packData);
    if (!isValid && validatePackSchemaFn.errors) {
      for (const err of validatePackSchemaFn.errors) {
        errors.push({
          packId,
          message: `Schema violation: ${formatSchemaError(err)}`,
          severity: 'error'
        });
      }
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push({
        packId,
        message: `Invalid JSON in pack.json: ${error.message}`,
        severity: 'error'
      });
    } else {
      errors.push({
        packId,
        message: `Error reading pack.json: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error'
      });
    }
  }

  return errors;
}

/**
 * Get metadata for a pack
 */
export function getPackMetadata(packId: string, baseDir?: string): PackMetadata {
  const pack = loadPack(packId, baseDir);
  return pack.metadata;
}

/**
 * List all available packs in the packs directory
 */
export function listAvailablePacks(baseDir?: string): RulePack[] {
  const packsDir = getPacksDirectory(baseDir);
  
  if (!fs.existsSync(packsDir)) {
    return [];
  }

  const packs: RulePack[] = [];
  const entries = fs.readdirSync(packsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const packJsonPath = path.join(packsDir, entry.name, 'pack.json');
      if (fs.existsSync(packJsonPath)) {
        try {
          const pack = loadPack(entry.name, baseDir);
          packs.push(pack);
        } catch {
          // Skip invalid packs
        }
      }
    }
  }

  return packs;
}

/**
 * Check if a pack exists
 */
export function packExists(packId: string, baseDir?: string): boolean {
  const packsDir = getPacksDirectory(baseDir);
  const packJsonPath = path.join(packsDir, packId, 'pack.json');
  return fs.existsSync(packJsonPath);
}
