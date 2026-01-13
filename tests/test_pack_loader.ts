/**
 * Tests for rule pack loader utilities.
 * 
 * Run with: npx ts-node tests/test_pack_loader.ts
 * Or: npm test
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  loadPack,
  loadPackFull,
  loadPackContent,
  listAvailablePacks,
  validatePack,
  validatePackAgainstSchema,
  resolveDependencies,
  packExists,
  getPacksDirectory
} from '../src/core/rule-pack-loader';
import {
  composePacks,
  calculateBudget,
  validateComposition,
  generateAgentsMdContent
} from '../src/core/pack-composer';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKS_DIR = path.join(PROJECT_ROOT, 'rule-packs');

// Simple test framework
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${(error as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value: boolean, message?: string): void {
  if (!value) {
    throw new Error(message || 'Expected true');
  }
}

function assertFalse(value: boolean, message?: string): void {
  if (value) {
    throw new Error(message || 'Expected false');
  }
}

function assertIncludes(array: string[], value: string, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(message || `Expected array to include ${value}`);
  }
}

function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(message || `Expected ${actual} > ${expected}`);
  }
}

// Tests
console.log('\n🧪 Rule Pack Loader Tests\n');

test('getPacksDirectory returns correct path', () => {
  const dir = getPacksDirectory(PROJECT_ROOT);
  assertTrue(dir.endsWith('rule-packs'));
});

test('packExists returns true for core pack', () => {
  assertTrue(packExists('core', PROJECT_ROOT));
});

test('packExists returns false for non-existent pack', () => {
  assertFalse(packExists('non-existent-pack', PROJECT_ROOT));
});

test('loadPack loads core pack metadata', () => {
  const pack = loadPack('core', PROJECT_ROOT);
  assertEqual(pack.id, 'core');
  assertEqual(pack.metadata.category, 'universal');
  assertTrue(Array.isArray(pack.files));
  assertTrue(pack.files.length > 0);
});

test('loadPack loads github-hygiene pack', () => {
  const pack = loadPack('github-hygiene', PROJECT_ROOT);
  assertEqual(pack.id, 'github-hygiene');
  assertIncludes(pack.dependencies, 'core');
});

test('loadPack loads azure-devops pack', () => {
  const pack = loadPack('azure-devops', PROJECT_ROOT);
  assertEqual(pack.id, 'azure-devops');
  assertIncludes(pack.dependencies, 'core');
});

test('loadPackContent returns markdown content', () => {
  const content = loadPackContent('core', PROJECT_ROOT);
  assertTrue(content.length > 0);
  assertTrue(content.includes('Prime Directives') || content.includes('NEVER'));
});

test('loadPackFull includes actual counts', () => {
  const pack = loadPackFull('core', PROJECT_ROOT);
  assertTrue(pack.actualWordCount > 0);
  assertTrue(pack.actualCharacterCount > 0);
  assertTrue(pack.content.length > 0);
});

test('resolveDependencies for core has no deps', () => {
  const result = resolveDependencies('core', PROJECT_ROOT);
  assertTrue(result.success);
  assertEqual(result.order.length, 1);
  assertEqual(result.order[0], 'core');
});

test('resolveDependencies for github-hygiene includes core first', () => {
  const result = resolveDependencies('github-hygiene', PROJECT_ROOT);
  assertTrue(result.success);
  assertTrue(result.order.length >= 2);
  assertEqual(result.order[0], 'core');
  assertIncludes(result.order, 'github-hygiene');
});

test('validatePack passes for valid core pack', () => {
  const result = validatePack('core', PROJECT_ROOT);
  assertTrue(result.valid, `Errors: ${result.errors.map(e => e.message).join(', ')}`);
});

test('validatePack passes for github-hygiene pack', () => {
  const result = validatePack('github-hygiene', PROJECT_ROOT);
  assertTrue(result.valid, `Errors: ${result.errors.map(e => e.message).join(', ')}`);
});

test('validatePack passes for azure-devops pack', () => {
  const result = validatePack('azure-devops', PROJECT_ROOT);
  assertTrue(result.valid, `Errors: ${result.errors.map(e => e.message).join(', ')}`);
});

test('listAvailablePacks returns all packs', () => {
  const packs = listAvailablePacks(PROJECT_ROOT);
  assertTrue(packs.length >= 3);
  const ids = packs.map(p => p.id);
  assertIncludes(ids, 'core');
  assertIncludes(ids, 'github-hygiene');
  assertIncludes(ids, 'azure-devops');
});

console.log('\n🧪 Schema Validation Tests\n');

// Create a temporary invalid pack for testing schema violations
const TEMP_PACKS_DIR = path.join(PROJECT_ROOT, 'rule-packs');
const INVALID_PACK_DIR = path.join(TEMP_PACKS_DIR, 'test-invalid-schema');

function setupInvalidPack(): void {
  // Create a pack with schema violations
  fs.mkdirSync(INVALID_PACK_DIR, { recursive: true });
  
  // Invalid pack.json: wrong id format (uppercase), missing required fields
  const invalidPack = {
    id: 'INVALID_ID',  // Schema requires lowercase kebab-case
    name: 'Test Invalid Pack',
    version: 'not-semver',  // Schema requires semver format
    description: 'A pack with schema violations',
    files: [],  // Schema requires minItems: 1
    metadata: {
      wordCount: 0,
      characterCount: 0
      // Missing required 'category' field
    }
  };
  
  fs.writeFileSync(
    path.join(INVALID_PACK_DIR, 'pack.json'),
    JSON.stringify(invalidPack, null, 2)
  );
}

function cleanupInvalidPack(): void {
  if (fs.existsSync(INVALID_PACK_DIR)) {
    fs.rmSync(INVALID_PACK_DIR, { recursive: true });
  }
}

test('validatePackAgainstSchema catches invalid id format', () => {
  setupInvalidPack();
  try {
    const errors = validatePackAgainstSchema('test-invalid-schema', PROJECT_ROOT);
    assertTrue(errors.length > 0, 'Expected schema validation errors');
    const errorMessages = errors.map(e => e.message).join(' ');
    assertTrue(
      errorMessages.includes('Schema violation'),
      `Expected schema violation errors, got: ${errorMessages}`
    );
  } finally {
    cleanupInvalidPack();
  }
});

test('validatePack fails for schema-violating pack', () => {
  setupInvalidPack();
  try {
    const result = validatePack('test-invalid-schema', PROJECT_ROOT);
    assertFalse(result.valid, 'Expected validation to fail for invalid pack');
    assertTrue(result.errors.length > 0, 'Expected errors for invalid pack');
  } finally {
    cleanupInvalidPack();
  }
});

test('validatePackAgainstSchema returns empty for valid packs', () => {
  const errors = validatePackAgainstSchema('core', PROJECT_ROOT);
  assertEqual(errors.length, 0, `Expected no schema errors for core pack, got: ${errors.map(e => e.message).join(', ')}`);
});

console.log('\n🧪 Pack Composer Tests\n');

test('composePacks combines core and github', () => {
  const content = composePacks(['core', 'github-hygiene'], PROJECT_ROOT);
  assertTrue(content.length > 0);
  assertTrue(content.includes('<!-- Pack: core'));
  assertTrue(content.includes('<!-- Pack: github-hygiene'));
});

test('calculateBudget returns correct structure', () => {
  const budget = calculateBudget(['core'], undefined, PROJECT_ROOT);
  assertTrue(budget.totalChars > 0);
  assertTrue(budget.packBreakdown.length === 1);
  assertTrue(budget.withinLimit);
});

test('calculateBudget includes dependencies', () => {
  const budget = calculateBudget(['github-hygiene'], undefined, PROJECT_ROOT);
  // Should include both core and github-hygiene
  assertTrue(budget.packBreakdown.length === 2);
  const ids = budget.packBreakdown.map(b => b.packId);
  assertIncludes(ids, 'core');
  assertIncludes(ids, 'github-hygiene');
});

test('calculateBudget for copilot shows limit', () => {
  const budget = calculateBudget(['core', 'github-hygiene'], 'copilot', PROJECT_ROOT);
  assertEqual(budget.maxChars, 8000);
  assertTrue(budget.percentage !== null);
});

test('validateComposition passes for valid packs', () => {
  const result = validateComposition(['core', 'github-hygiene'], undefined, PROJECT_ROOT);
  assertTrue(result.valid, `Errors: ${result.errors.join(', ')}`);
});

test('generateAgentsMdContent creates valid markdown', () => {
  const content = generateAgentsMdContent(['core', 'github-hygiene'], {}, PROJECT_ROOT);
  assertTrue(content.includes('AGENTS.md'));
  assertTrue(content.includes('Active Rule Packs'));
  assertTrue(content.includes('@rule-packs/core'));
});

// Summary
console.log('\n' + '─'.repeat(50));
console.log(`\n✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log();

if (failed > 0) {
  process.exit(1);
}
