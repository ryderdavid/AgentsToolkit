# Custom Commands Guide

This guide explains how to create, manage, and deploy custom commands using the AgentsToolkit.

## Overview

Custom commands are reusable instructions that can be deployed to AI coding agents like Cursor, Claude Code, Gemini CLI, and others. They allow you to standardize workflows across your team and agents.

## Command Structure

Commands are defined as Markdown files in `commands/src/`:

```
commands/src/
├── issue.md          # Create GitHub issues
├── pr.md             # Create pull requests
├── status.md         # Show workflow status
├── walkthrough.md    # Create documentation
└── ...
```

### Command File Format

Each command markdown file follows this structure:

```markdown
Brief description of what the command does (first line).

**Purpose:**
Detailed explanation of the command's purpose.

**Workflow:**
1. Step one
2. Step two
3. Step three

Run: `python3 ~/.agentsmd/scripts/command_name.py [args]`
```

### Metadata Extraction

The system automatically extracts the following from command files:

| Field | Source |
|-------|--------|
| `id` | Filename (without `.md`) |
| `name` | Title-cased version of ID |
| `description` | First line of the file |
| `scriptPath` | Detected from `python3 ~/.agentsmd/scripts/*.py` pattern |
| `category` | Inferred from content (workflow/git/documentation/utility) |
| `outReferences` | Markdown links to rule-packs/, docs/, templates/ |
| `requiresGitHub` | Detected if references GitHub CLI |

## Categories

Commands are organized into categories:

| Category | Description | Examples |
|----------|-------------|----------|
| **workflow** | Issue, PR, and branch management | `issue`, `pr`, `branch` |
| **git** | Git operations and status | `status`, `push`, `check-auth` |
| **documentation** | Doc generation and walkthroughs | `walkthrough`, `followup` |
| **utility** | General utilities | `link`, `protect` |

## Agent Compatibility

Commands are converted to agent-specific formats during deployment:

| Agent | Format | Extension | Notes |
|-------|--------|-----------|-------|
| Cursor | Markdown | `.md` | Slash command format |
| Claude Code | Markdown with frontmatter | `.md` | Requires YAML frontmatter |
| Gemini CLI | TOML | `.toml` | Structured command format |
| Aider | YAML | `.yaml` | CLI configuration format |
| Warp | Workflow YAML | `.yaml` | Warp workflow format |
| Cline | JSON | `.json` | Command definition format |
| Codex | Markdown with prefix | `.md` | Uses `/prompts:` prefix |

### Compatibility Matrix

| Command | Cursor | Claude | Gemini | Aider | Warp | Cline |
|---------|--------|--------|--------|-------|------|-------|
| issue | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| pr | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| status | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| walkthrough | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |

✅ = Full support, ⚠️ = Partial support

## Out-References

Commands can reference external files using Markdown links:

```markdown
See [Issue Template](../../rule-packs/github-hygiene/issue-first.md) for proper formatting.
```

These are tracked as "out-references" and displayed in the UI. Agents that support out-references (like Cursor) can access these files directly.

## Templates

Some commands include templates for generated content:

```markdown
**Walkthrough Template:**
# Walkthrough: #{issue} - W{N}

**Issue:** [#{issue}: Title](link)
**Branch:** `{branch-name}`

## Summary
[Summary goes here]
```

Template variables use `{variable-name}` syntax and are substituted when the command runs.

## Creating Custom Commands

### 1. Create the Markdown File

Create a new file in `commands/src/`:

```bash
touch commands/src/my-command.md
```

### 2. Add Command Content

```markdown
Execute my custom workflow for {purpose}.

**Purpose:**
This command helps with {specific task}.

**Workflow:**
1. Analyze the current state
2. Perform the action
3. Report results

**Usage:**
Invoke with `/my-command` in your agent.

Run: `python3 ~/.agentsmd/scripts/my_command.py`
```

### 3. Create the Script (Optional)

If your command runs a script:

```python
#!/usr/bin/env python3
# ~/.agentsmd/scripts/my_command.py

import sys

def main():
    print("Executing my command...")
    # Your logic here

if __name__ == "__main__":
    main()
```

### 4. Deploy to Agents

Use the AgentsToolkit desktop app or CLI to deploy:

```bash
# Via CLI (coming soon)
agentstoolkit deploy --agent cursor --commands my-command

# Via desktop app
# 1. Open Commands view
# 2. Enable your command
# 3. Click "Deploy Commands"
```

## Validation

Commands are validated before deployment:

- **Character limits**: Checked against agent's maximum
- **Format compatibility**: Converted format is validated
- **Out-references**: Referenced files are verified
- **Script existence**: Script paths are checked

## Character Budget

Commands consume character budget when deployed. Monitor your usage:

| Agent | Max Characters | Commands Budget |
|-------|----------------|-----------------|
| Cursor | 1,000,000 | ~50% for commands |
| Claude | 200,000 | ~30% for commands |
| Copilot | 8,000 | ~10% for commands |
| Gemini | 1,000,000 | ~50% for commands |

## Best Practices

### DO:

- Keep commands focused and single-purpose
- Include clear usage instructions
- Reference relevant rule packs
- Test commands before deployment
- Use descriptive IDs (kebab-case)

### DON'T:

- Create commands that exceed agent limits
- Duplicate functionality across commands
- Hardcode project-specific paths
- Skip the description (first line)
- Use complex nested templates

## Troubleshooting

### Command not showing in UI

1. Check file is in `commands/src/`
2. Ensure file has `.md` extension
3. Refresh command cache: "Refresh Commands" button

### Deployment fails

1. Check character budget hasn't been exceeded
2. Verify agent is installed and accessible
3. Check out-references exist

### Script not found

1. Verify script path in command file
2. Ensure script exists at `~/.agentsmd/scripts/`
3. Check script has execute permissions

## API Reference

### TypeScript

```typescript
import { commandApi } from '@/lib/commands';

// List all commands
const commands = await commandApi.listAvailableCommands();

// Get specific command
const command = await commandApi.getCommandById('issue');

// Get commands for an agent
const agentCommands = await commandApi.getCommandsForAgent('cursor');

// Validate compatibility
const result = await commandApi.validateCommandForAgent('issue', 'cursor');
```

### Rust/Tauri

```rust
// List commands
let commands = command_registry::load_commands()?;

// Get by ID
let command = command_registry::get_command_by_id("issue")?;

// Validate
let result = command_registry::validate_command_for_agent("issue", "cursor")?;
```

## Related Documentation

- [Rule Packs Guide](./rule-packs-guide.md) - Configuring rule packs
- [AGENTS_REFERENCE.md](./AGENTS_REFERENCE.md) - Complete reference
- [v2 Migration Guide](./v2-migration.md) - Upgrading from v1
