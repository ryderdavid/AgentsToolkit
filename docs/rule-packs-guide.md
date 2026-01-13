# Rule Packs Guide

This guide explains the modular rule pack system introduced in AgentsToolkit v2.0.

## Overview

Rule packs are modular collections of workflow standards that can be mixed and matched based on your development environment. Instead of a single monolithic AGENTS.md, you can now compose your workflow rules from:

- **Core pack** — Universal, VCS-agnostic workflow fundamentals
- **GitHub Hygiene pack** — GitHub-specific standards (issues, PRs, Actions)
- **Azure DevOps pack** — Azure DevOps-specific standards (work items, repos, pipelines)

## Architecture

```
rule-packs/
├── core/                      # Universal rules (required)
│   ├── pack.json              # Pack metadata
│   ├── prime-directives.md    # Non-negotiable rules
│   ├── scope-management.md    # Scope creep handling
│   ├── feedback-discipline.md # Documentation standards
│   └── safety-execution.md    # Safety tiers
├── github-hygiene/            # GitHub-specific
│   ├── pack.json
│   ├── issue-first.md
│   ├── branch-management.md
│   ├── screenshot-handling.md
│   ├── pr-protocol.md
│   ├── commit-standards.md
│   ├── walkthrough-docs.md
│   ├── github-output.md
│   └── anti-patterns.md
└── azure-devops/              # Azure DevOps-specific
    ├── pack.json
    ├── work-item-first.md
    ├── branch-management.md
    ├── pr-protocol.md
    ├── commit-standards.md
    ├── azure-output.md
    └── anti-patterns.md
```

## Pack Metadata

Each pack has a `pack.json` file with the following structure:

```json
{
  "id": "github-hygiene",
  "name": "GitHub Workflow Hygiene",
  "version": "1.0.0",
  "description": "GitHub-specific workflow standards",
  "dependencies": ["core"],
  "targetAgents": ["*"],
  "files": ["issue-first.md", "branch-management.md", ...],
  "metadata": {
    "wordCount": 650,
    "characterCount": 4200,
    "category": "vcs",
    "tags": ["github", "git", "workflow"]
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (kebab-case) |
| `name` | string | Human-readable name |
| `version` | string | Semantic version |
| `description` | string | Purpose of the pack |
| `dependencies` | string[] | Required pack IDs |
| `targetAgents` | string[] | Compatible agents (`["*"]` = all) |
| `files` | string[] | Markdown files in load order |
| `metadata.wordCount` | number | Approximate word count |
| `metadata.characterCount` | number | Approximate character count |
| `metadata.category` | string | `workflow`, `vcs`, or `universal` |
| `metadata.tags` | string[] | Searchable tags |

## Using Packs

### Default Configuration

The default `AGENTS.md` imports Core + GitHub Hygiene:

```markdown
<!-- BEGIN PACK IMPORTS -->
@rule-packs/core/prime-directives.md
@rule-packs/core/scope-management.md
...
@rule-packs/github-hygiene/issue-first.md
@rule-packs/github-hygiene/branch-management.md
...
<!-- END PACK IMPORTS -->
```

### Switching to Azure DevOps

Edit `AGENTS.md` to replace GitHub imports with Azure DevOps:

```markdown
<!-- BEGIN PACK IMPORTS -->
@rule-packs/core/prime-directives.md
@rule-packs/core/scope-management.md
...
@rule-packs/azure-devops/work-item-first.md
@rule-packs/azure-devops/branch-management.md
...
<!-- END PACK IMPORTS -->
```

### Using Legacy Mode

If you prefer the original monolithic format:

1. During installation, answer "n" to "Use modular rule packs?"
2. Or manually copy `AGENTS.legacy.md` to `AGENTS.md`

## Character Budget

Different AI agents have different context limits. Rule packs help you stay within budget:

| Pack | Words | Characters |
|------|-------|------------|
| Core | ~450 | ~2,800 |
| GitHub Hygiene | ~650 | ~4,200 |
| Azure DevOps | ~550 | ~3,600 |
| **Core + GitHub** | **~1,100** | **~7,000** |
| **Core + Azure** | **~1,000** | **~6,400** |

### Agent Limits

| Agent | Character Limit | Core + GitHub Usage |
|-------|-----------------|---------------------|
| Cursor | 1,000,000 | 0.7% |
| Claude | 200,000 | 3.5% |
| Gemini | 1,000,000 | 0.7% |
| Copilot | 8,000 | 87.5% ⚠️ |
| Codex | 50,000 | 14% |

**Note:** Copilot users may need to use a slimmed configuration or rely on out-references.

## Creating Custom Packs

### 1. Create Directory Structure

```bash
mkdir -p rule-packs/my-custom-pack
```

### 2. Create pack.json

```json
{
  "id": "my-custom-pack",
  "name": "My Custom Rules",
  "version": "1.0.0",
  "description": "Custom workflow rules for my team",
  "dependencies": ["core"],
  "targetAgents": ["*"],
  "files": ["my-rules.md"],
  "metadata": {
    "wordCount": 200,
    "characterCount": 1200,
    "category": "workflow",
    "tags": ["custom", "team"]
  }
}
```

### 3. Create Markdown Files

```markdown
# My Custom Rules

1. **Always include ticket numbers in commit messages**
2. **Code reviews require 2 approvals**
3. ...
```

### 4. Validate

```bash
npm run validate-packs
```

### 5. Add to AGENTS.md

```markdown
@rule-packs/my-custom-pack/my-rules.md
```

## Validation

Validate all packs with:

```bash
npm run validate-packs
# or
npx ts-node src/cli/validate-agents.ts packs
```

This checks:
- ✅ pack.json schema compliance
- ✅ All referenced files exist
- ✅ Dependencies exist
- ✅ No circular dependencies
- ✅ Word/character count accuracy

## Migration

To migrate from legacy to modular:

```bash
python3 ~/.agentsmd/scripts/migrate_to_packs.py
```

The migration script:
1. Detects if you have customized AGENTS.md
2. Offers to preserve customizations as a custom pack
3. Updates symlinks to new modular AGENTS.md
4. Creates backup of old configuration

## API Reference

### TypeScript

```typescript
import {
  loadPack,
  loadPackFull,
  listAvailablePacks,
  validatePack,
  resolveDependencies
} from './src/core/rule-pack-loader';

import {
  composePacks,
  calculateBudget,
  validateComposition,
  generateAgentsMd
} from './src/core/pack-composer';

// List available packs
const packs = listAvailablePacks();

// Load a pack with content
const pack = loadPackFull('github-hygiene');
console.log(pack.content);

// Compose multiple packs
const content = composePacks(['core', 'github-hygiene']);

// Calculate budget for an agent
const budget = calculateBudget(['core', 'github-hygiene'], 'copilot');
console.log(budget.withinLimit);  // false for Copilot
```

## Best Practices

1. **Always include Core** — It contains fundamental rules all workflows need
2. **Choose one VCS pack** — Don't mix GitHub and Azure DevOps packs
3. **Monitor your budget** — Run `validate-packs` to see character usage
4. **Keep custom packs small** — Focus on team-specific additions
5. **Version your packs** — Use semver for tracking changes

## Rule Pack Management UI (Desktop)

- **Layout:** Three-column view — Available Packs, Active Composition, Per-Agent Budget. Validation alerts appear at the top with actionable messages.
- **Enable/Disable:** Use the toggle on each Rule Pack card. Dependencies auto-resolve; circular dependencies show an error modal.
- **Search & Filter:** Search by name/description/tags and filter by category (Universal, VCS, Workflow).
- **Pack Details:** Click a card to open the detail modal with metadata, dependencies, files, and markdown preview. Use “Enable Pack” in the footer to activate it.
- **Active Composition:** Shows enabled packs, combined stats, breakdown table, dependency tree, and validation alerts. Clear all, load presets, or generate AGENTS.md from here.
- **Per-Agent Budgets:** Cards show character limits, usage percentages, and status badges. Select an agent to highlight its budget.
- **Presets:** Built-in presets include Minimal, GitHub Standard, Azure DevOps, and Maximum. Custom presets are stored locally and can be saved/deleted from the preset selector.
- **Export/Import:** Export the current configuration to JSON via Tauri file dialog, import from JSON, or copy/share the config payload.
- **Statistics:** Local-only usage stats track most-used packs and can be exported as CSV.
- **Keyboard Shortcuts:**  
  - `Cmd/Ctrl + K` focus search  
  - `Cmd/Ctrl + A` enable all packs  
  - `Esc` closes the detail modal  
  - `?` opens the shortcuts help modal (planned)
- **Troubleshooting:**  
  - If budget exceeds limits, remove packs or switch to an agent with a higher limit.  
  - If dependencies fail to resolve, review the dependency modal for missing or circular references.  
  - Use “Generate AGENTS.md” to copy composed content when deploying to agents.
