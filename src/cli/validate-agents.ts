import fs from "fs";
import os from "os";
import path from "path";
import {getAllAgents, validateAgent} from "../core/agent-registry";
import {
  listAvailablePacks,
  validatePack,
  validatePackAgainstSchema,
  resolveDependencies,
  loadPackFull,
  getPacksDirectory
} from "../core/rule-pack-loader";
import {calculateBudget, validateComposition} from "../core/pack-composer";

type ValidationResult = {
  id: string;
  missingPaths: string[];
};

type PackValidationSummary = {
  packId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  wordCount: number;
  charCount: number;
};

function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return path.resolve(p);
}

function checkPaths(agentId: string, paths: string[]): ValidationResult {
  const missing: string[] = [];
  for (const p of paths) {
    const resolved = expandPath(p);
    if (!fs.existsSync(resolved)) {
      missing.push(resolved);
    }
  }
  return {id: agentId, missingPaths: missing};
}

function findConflicts<T>(
  items: T[],
  keySelector: (item: T) => string
): Map<string, string[]> {
  const conflicts = new Map<string, string[]>();
  for (const item of items) {
    const key = keySelector(item);
    const ids = conflicts.get(key) || [];
    ids.push((item as any).id);
    conflicts.set(key, ids);
  }
  for (const [key, ids] of [...conflicts]) {
    if (ids.length < 2) {
      conflicts.delete(key);
    }
  }
  return conflicts;
}

function validateAllPacks(baseDir?: string): PackValidationSummary[] {
  const packs = listAvailablePacks(baseDir);
  const summaries: PackValidationSummary[] = [];

  for (const pack of packs) {
    // First validate against JSON schema
    const schemaErrors = validatePackAgainstSchema(pack.id, baseDir);
    
    // Then run full validation (which also includes schema validation)
    const result = validatePack(pack.id, baseDir);
    let wordCount = 0;
    let charCount = 0;

    try {
      const loaded = loadPackFull(pack.id, baseDir);
      wordCount = loaded.actualWordCount;
      charCount = loaded.actualCharacterCount;
    } catch {
      // Skip if can't load
    }

    // Combine errors, ensuring schema errors are surfaced
    const allErrors = result.errors.map(e => e.message);
    
    // Add any schema-specific errors that might not be in result.errors
    for (const schemaErr of schemaErrors) {
      if (!allErrors.includes(schemaErr.message)) {
        allErrors.push(schemaErr.message);
      }
    }

    summaries.push({
      packId: pack.id,
      valid: result.valid && schemaErrors.length === 0,
      errors: allErrors,
      warnings: result.warnings.map(w => w.message),
      wordCount,
      charCount
    });
  }

  return summaries;
}

function checkCircularDependencies(baseDir?: string): string[] {
  const packs = listAvailablePacks(baseDir);
  const circularErrors: string[] = [];

  for (const pack of packs) {
    const result = resolveDependencies(pack.id, baseDir);
    if (!result.success && result.circularPath) {
      circularErrors.push(`${pack.id}: ${result.circularPath.join(" -> ")}`);
    }
  }

  return circularErrors;
}

function printPackBudgets(baseDir?: string): void {
  const packs = listAvailablePacks(baseDir);
  
  console.log("\n📦 Rule Pack Budgets:");
  console.log("─".repeat(60));
  
  for (const pack of packs) {
    try {
      const loaded = loadPackFull(pack.id, baseDir);
      const deps = pack.dependencies.length > 0 
        ? ` (requires: ${pack.dependencies.join(", ")})` 
        : "";
      console.log(
        `  ${pack.id}${deps}\n` +
        `    Words: ${loaded.actualWordCount} | Chars: ${loaded.actualCharacterCount}`
      );
    } catch (e) {
      console.log(`  ${pack.id}: Error loading pack`);
    }
  }

  // Print common compositions
  console.log("\n📊 Common Compositions:");
  console.log("─".repeat(60));
  
  const compositions = [
    {name: "Core + GitHub", packs: ["core", "github-hygiene"]},
    {name: "Core + Azure DevOps", packs: ["core", "azure-devops"]},
    {name: "Core only", packs: ["core"]}
  ];

  for (const comp of compositions) {
    try {
      const budget = calculateBudget(comp.packs, undefined, baseDir);
      console.log(
        `  ${comp.name}:\n` +
        `    Words: ~${budget.packBreakdown.reduce((a, b) => a + b.words, 0)} | ` +
        `Chars: ${budget.totalChars}`
      );
    } catch {
      console.log(`  ${comp.name}: Error calculating budget`);
    }
  }
}

function validatePacksCommand(baseDir?: string): boolean {
  console.log("🔍 Validating Rule Packs...\n");
  
  const packsDir = getPacksDirectory(baseDir);
  if (!fs.existsSync(packsDir)) {
    console.log(`Rule packs directory not found: ${packsDir}`);
    return true;  // Not an error if no packs exist
  }

  const summaries = validateAllPacks(baseDir);
  let hasErrors = false;

  for (const summary of summaries) {
    const status = summary.valid ? "✓" : "✗";
    console.log(`${status} ${summary.packId}`);
    
    for (const error of summary.errors) {
      console.error(`    ERROR: ${error}`);
      hasErrors = true;
    }
    
    for (const warning of summary.warnings) {
      console.warn(`    WARN: ${warning}`);
    }
  }

  // Check for circular dependencies
  const circularErrors = checkCircularDependencies(baseDir);
  if (circularErrors.length > 0) {
    console.error("\n❌ Circular dependencies detected:");
    for (const error of circularErrors) {
      console.error(`  ${error}`);
    }
    hasErrors = true;
  }

  if (!hasErrors) {
    console.log("\n✅ All rule packs are valid.");
    printPackBudgets(baseDir);
  }

  return !hasErrors;
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  // Handle pack validation command
  if (command === "packs" || command === "validate-packs") {
    const success = validatePacksCommand();
    process.exit(success ? 0 : 1);
  }

  // Default: validate agents
  const agents = getAllAgents();
  const missing: ValidationResult[] = [];

  // Schema validation
  for (const agent of agents) {
    validateAgent(agent);
    const result = checkPaths(agent.id, agent.configPaths);
    if (result.missingPaths.length) {
      missing.push(result);
    }
  }

  // Duplicate checks
  const idConflicts = findConflicts(agents, (a) => a.id);
  const outputConflicts = findConflicts(agents, (a) => a.buildOutput);

  const hasErrors =
    idConflicts.size > 0 || outputConflicts.size > 0 || missing.length > 0;

  if (idConflicts.size > 0) {
    console.error("Duplicate agent IDs detected:", Object.fromEntries(idConflicts));
  }
  if (outputConflicts.size > 0) {
    console.error(
      "Conflicting build outputs detected:",
      Object.fromEntries(outputConflicts)
    );
  }
  if (missing.length > 0) {
    console.warn("Missing config paths:");
    for (const result of missing) {
      console.warn(`- ${result.id}: ${result.missingPaths.join(", ")}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("All agent definitions are valid and config paths exist.");
  }

  // Also validate packs if they exist
  const packsDir = getPacksDirectory();
  if (fs.existsSync(packsDir)) {
    console.log("\n");
    validatePacksCommand();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

export {validatePacksCommand, validateAllPacks, checkCircularDependencies};
