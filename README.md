# AgentsToolkit v2

A global toolkit that enforces issue-first development workflows across AI coding agents (Cursor, Claude Code, GitHub Copilot, Jules, Aider, etc.).

**v2 Changes:** No per-project setup! Install once, use everywhere. See [Migration Guide](docs/v2-migration.md) if upgrading from v1.

**Windows, macOS, and Linux supported!** All scripts are Python 3.8+ for cross-platform compatibility.

## Features

- **🌍 One Command Setup** - `python3 install.py` configures everything globally
- **📋 Single Constitution** - Global AGENTS.md enforces workflow standards
- **🎯 Works Everywhere** - Cursor commands available in all projects without per-project setup
- **🤖 Cross-Agent Compatible** - Works with Cursor, Claude Code, GitHub Copilot, Jules, Aider
- **✅ Issue-First Workflow** - Enforces traceable development patterns
- **🚀 Zero Per-Project Setup** - No more running init commands in each repo
- **💻 Cross-Platform** - Windows, macOS, Linux (Python 3.8+)

## Prerequisites

**All platforms:**
- Python 3.8 or higher
- Git
- GitHub CLI (`gh`) - [Installation guide](https://cli.github.com/)

**Check your Python version:**
```bash
python3 --version  # macOS/Linux
python --version   # Windows
```

**Windows-specific:**
- Enable Developer Mode (optional, for symlinks) or the toolkit will use fallback methods
- Git for Windows installed

## Quick Start

### One-Time Setup

```bash
# Clone the repository
git clone https://github.com/YOU/AgentsToolkit.git ~/Projects/AgentsToolkit

# Install and configure
cd ~/Projects/AgentsToolkit
python3 install.py
```

The installer will:
1. Install toolkit to `~/.agentsmd/`
2. Add to PATH
3. Prompt for agent configuration (interactive menu)
4. Build commands for Cursor/Claude/Codex/Gemini via `bin/build-commands.sh install`
5. Symlink multi-agent commands (`~/.cursor/commands`, `~/.claude/commands`, `~/.codex/prompts`, `~/.gemini/commands`)
6. Set up Cursor User Rule (clipboard + instructions)

**Restart your terminal** (or `source ~/.zshrc`) to activate PATH.

### Use Anywhere

```bash
cd ~/any-project

# Cursor users: Just type /status, /issue, /branch, etc.
# Other agents: python3 ~/.agentsmd/scripts/status.py
```

**That's it!** No per-project setup needed.

## What Gets Installed

### Global Installation (`~/.agentsmd/`)

```
~/.agentsmd/
├── AGENTS.md                    # Workflow standards constitution
├── CLAUDE.md                    # Claude Code enforcement rules
├── commands/                    # Canonical commands (source of truth)
│   └── src/
│       ├── status.md
│       ├── issue.md
│       ├── branch.md
│       ├── pr.md
│       ├── push.md
│       ├── followup.md
│       ├── link.md
│       ├── check-workflow.md
│       ├── check-auth.md
│       └── protect.md
├── build/                       # Generated agent-specific outputs (via build-commands.sh)
│   ├── cursor/commands/
│   ├── claude/commands/
│   ├── codex/prompts/
│   └── gemini/commands/
└── scripts/                     # Python workflow scripts
    ├── status.py
    ├── issue.py
    ├── branch.py
    ├── pr.py
    ├── push.py
    ├── followup.py
    ├── link.py
    ├── check-workflow.py
    ├── check-auth.py
    └── protect.py
```

### Cursor Configuration (`~/.cursor/`)

```
~/.cursor/
└── commands/ -> ~/.agentsmd/build/cursor/commands/   # Symlinked by build-commands.sh
    ├── status.md
    ├── issue.md
    └── ... (all 10 commands)
```

### Per-Project (Auto-Created)

```
your-repo/
└── .issue_screenshots/          # Created by scripts on first use
    └── .gitkeep
```

**That's it!** No other toolkit files needed in your repositories.

## Supported Agents (commands)

- Cursor: `~/.cursor/commands` (symlink to `~/.agentsmd/build/cursor/commands`)
- Claude Code: `~/.claude/commands` (symlink to `~/.agentsmd/build/claude/commands`)
- Codex CLI: `~/.codex/prompts` (symlink to `~/.agentsmd/build/codex/prompts`, invoked as `/prompts:<name>`)
- Gemini CLI: `~/.gemini/commands` (symlink to `~/.agentsmd/build/gemini/commands`)
- All outputs generated from `~/.agentsmd/commands/src` via `bin/build-commands.sh install`

## Philosophy

**Every piece of work flows through: Issue → Branch → Commits → PR → Merge**

The toolkit enforces:
- ✅ Issue-first development (never code before creating an issue)
- ✅ Branch naming: `{type}/{issue-num}-{description}`
- ✅ Screenshot handling in `.issue_screenshots/`
- ✅ PR linking with `Closes #N` syntax
- ✅ Commit format: `#42: Description`

## Workflow Commands

### Via Cursor (Recommended)

Type slash commands in Cursor:
- `/status` - Show workflow status
- `/issue` - Create GitHub issue
- `/branch` - Create feature branch
- `/pr` - Create pull request
- `/push` - Commit and push changes
- `/followup` - Add issue comment
- `/link` - Link existing PR to issue
- `/check-workflow` - Validate workflow compliance
- `/check-auth` - Check GitHub CLI authentication
- `/protect` - Enable branch protection

### Via Terminal (All Agents)

```bash
python3 ~/.agentsmd/scripts/status.py
python3 ~/.agentsmd/scripts/issue.py "title" "body" [screenshots]
python3 ~/.agentsmd/scripts/branch.py feat "description"
python3 ~/.agentsmd/scripts/pr.py
python3 ~/.agentsmd/scripts/push.py "commit message"
python3 ~/.agentsmd/scripts/followup.py <issue-num> "comment" [screenshots]
python3 ~/.agentsmd/scripts/link.py <pr-num> <issue-num>
```

### Example: Creating an Issue

```bash
# Via Cursor
/issue

# Via terminal
python3 ~/.agentsmd/scripts/issue.py "Fix login button" "Button misaligned on mobile" screenshot.png

# What it does:
# 1. Creates branch: fix/pending-fix-login-button
# 2. Saves screenshot to .issue_screenshots/
# 3. Commits and pushes
# 4. Creates GitHub issue with embedded screenshot
# 5. Renames branch: fix/42-fix-login-button
# 6. Links branch to issue in git config
```

### Example: Checking Status

```bash
# Via Cursor
/status

# Output:
# 📋 Current Workflow Status
# Branch: fix/42-fix-login-button
# Linked Issue: #42
# Issue State: OPEN
# Commits ahead: 2
# Pushed: ✅ Yes
# PR: None - run pr.py to create
# 📋 Next step: Create PR
```

## Agent-Specific Setup

### Cursor

Configured automatically during installation:
- ✅ Commands symlinked to `~/.cursor/commands/`
- ✅ User Rule copied to clipboard (paste in Settings → Rules)

**User Rule:** `Always read and follow ~/.agentsmd/AGENTS.md`

### Claude Code (VS Code Extension)

Create `.claude/config.yml` in your project:

```yaml
rules:
  - '~/.agentsmd/AGENTS.md'
```

Run scripts via terminal or VS Code tasks.

### Gemini CLI

Configured automatically during installation (if selected):
- ✅ AGENTS.md symlinked to `~/.config/gemini/prompts/agents.md`

### Codex CLI

Configured automatically during installation:
- ✅ Commands generated to `~/.codex/prompts` (invoke as `/prompts:<command>`)

### GitHub Copilot

Create `.github/copilot-instructions.md` in your project:

```markdown
See AGENTS.md for workflow standards.
```

Reference: `~/.agentsmd/AGENTS.md`

### OpenAI Codex

Add to `~/.openai-codex-prompt`:

```
Always read and follow ~/.agentsmd/AGENTS.md
```

## Documentation

- **[AGENTS.md](AGENTS.md)** - Workflow standards (issue-first development, Git conventions)
- **[AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md)** - Command examples and templates
- **[v2 Migration Guide](docs/v2-migration.md)** - Upgrading from v1

## Safety Guarantees

All workflow scripts are restricted to safe (Tier 1) operations:
- ✅ Create/edit issues, PRs, comments, branches
- ✅ Normal git operations (`add`, `commit`, `push`, `checkout`, `branch`)
- ✅ Read-only status/log/diff/show commands
- ❌ No deletes of issues/PRs/repos/branches
- ❌ No force push or history rewrite
- ❌ No automatic PR merges

Safety tiers (per AGENTS.md):
- **Tier 1 (execute):** Safe/read-only/additive operations
- **Tier 2 (confirm):** Closing issues/PRs manually
- **Tier 3 (explicit request only):** Destructive operations (delete/force/merge)

## How It Works

### The Hybrid Architecture

```
┌─────────────────────────────────────┐
│ Global AGENTS.md                    │
│ - When to create issues             │
│ - Scope boundaries                  │
│ - Workflow decisions                │
│ ↓ (~600 tokens in context)          │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ Cursor User Rule                    │
│ - "Read ~/.agentsmd/AGENTS.md"      │
│ ↓ (~20 tokens in context)           │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ AI Decision Layer                   │
│ - Consults AGENTS.md rules          │
│ - Decides: "Need to create issue"   │
│ - Executes: python3 ~/.agentsmd/... │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ Scripts (Deterministic)             │
│ - Handles complex logic             │
│ - Returns clean output              │
│ - 0 tokens until called             │
└─────────────────────────────────────┘
```

**Benefits:**
- ✅ **~620 tokens** for workflow rules (vs 2000+ for explicit commands)
- ✅ **Deterministic** execution of complex procedures
- ✅ **Flexible** AI decision-making
- ✅ **Automatic updates** via symlinks
- ✅ **Single source of truth**

## Cross-Agent Compatibility

| Agent | AGENTS.md Support | Global Commands | Script Access | Status |
|-------|------------------|-----------------|---------------|--------|
| **Cursor** | ✅ Native (User Rule) | ✅ `~/.cursor/commands` (symlink) | Built-in | ✅ Fully supported |
| **Claude Code** | ✅ Via config.yml | ✅ `~/.claude/commands` (symlink) | Terminal/tasks | ✅ Fully supported |
| **Codex CLI** | ⚠️ Manual prompt include | ✅ `~/.codex/prompts` (`/prompts:<name>`) | Terminal | ✅ Fully supported |
| **Gemini CLI** | ✅ Via prompts directory | ✅ `~/.gemini/commands` (symlink) | Terminal | ✅ Fully supported |
| **GitHub Copilot** | ✅ Native (Aug 2025) | ✅ Via workspace instructions | Terminal/tasks | ✅ Fully supported |
| **Jules** | ✅ Native | ✅ Repo root | Terminal | ✅ Fully supported |
| **Aider** | ✅ Recommended | ✅ Standard | Terminal | ✅ Fully supported |

## Windows Support

AgentsToolkit has full Windows support via Python 3.8+ scripts.

### Installation on Windows

1. **Install Python 3.8+** from [python.org](https://python.org) or via `winget install Python.Python.3`
2. **Install Git for Windows** from [git-scm.com](https://git-scm.com/)
3. **Install GitHub CLI** from [cli.github.com](https://cli.github.com/) or via `winget install GitHub.cli`
4. **Run the installer:** `python install.py`

### Symlinks on Windows

The toolkit uses a smart fallback chain:

1. **Symlinks** (preferred) - Requires Developer Mode or Administrator privileges
2. **Junctions** (directories) - Works without special permissions
3. **Hard links** (files) - Same volume required
4. **Copy** (last resort) - Manual updates needed

**To enable symlinks:**
- Windows 10/11: Settings → Update & Security → For Developers → Developer Mode

## AGENTS.md Compliance

All scripts strictly follow AGENTS.md standards:

| Requirement | Format | Example |
|-------------|--------|---------|
| Branch naming | `{type}/{issue-num}-{desc}` | `fix/42-login-button` |
| Pending branches | `{type}/pending-{desc}` | `fix/pending-login-button` |
| Screenshot dir | `.issue_screenshots/` | ✓ |
| Screenshot naming | `YYYYMMDD_{num}_{branch}_{desc}.ext` | `20251220_42_fix-login_error.png` |
| Commit messages | `#{issue-num}: description` | `#42: Add null check` |
| PR linking | `Closes #{issue-num}` | `Closes #42` |

## Updating the Toolkit

To get toolkit updates:

```bash
# Pull latest toolkit changes
cd ~/Projects/AgentsToolkit
git pull

# Re-run installer if needed
python3 install.py
```

**Symlinked files update automatically:**
- AGENTS.md
- CLAUDE.md
- Commands source (`~/.agentsmd/commands/src/*.md`)
- Built commands (`~/.agentsmd/build/**/*` regenerated via `bin/build-commands.sh install`)
- Scripts (`~/.agentsmd/scripts/*.py`)

## Testing

Unit tests verify all deterministic functions:

```bash
cd ~/Projects/AgentsToolkit
./tests/test_functions.py

# 39 tests covering:
# ✓ Branch type detection
# ✓ Branch slug generation
# ✓ Branch name format (AGENTS.md)
# ✓ Screenshot filename format
# ✓ Commit message format
# ✓ PR title format
```

## Troubleshooting

### Cursor Commands Not Working

```bash
# Verify symlinks
ls -la ~/.cursor/commands/

# Should point to ~/.agentsmd/build/cursor/commands/*
# If not, run: ~/.agentsmd/bin/build-commands.sh install
# or re-run: python3 install.py
```

### GitHub CLI Not Working

```bash
# Install gh CLI
brew install gh  # macOS
# or: https://cli.github.com/

# Authenticate
gh auth login
```

### Screenshots Not Showing in Issues

1. Ensure branch is pushed: `git push`
2. Verify files in `.issue_screenshots/`
3. Check raw GitHub URLs in issue body

## Uninstallation

### Remove Global Installation

```bash
rm -rf ~/.agentsmd
rm -rf ~/.cursor/commands

# Remove from shell config
# Edit ~/.zshrc or ~/.bashrc and delete:
# # AgentsMD Toolkit
# export PATH="$HOME/.agentsmd/bin:$PATH"
```

## Contributing

Contributions welcome! Please:

1. Follow AGENTS.md standards (yes, meta!)
2. Run tests: `./tests/test_functions.py`
3. Update documentation
4. Create issues before PRs

## File Structure

```
AgentsToolkit/
├── README.md                 # This file
├── AGENTS.md                 # Workflow standards (source of truth)
├── install.py                # Global installer with agent config
│
├── commands/                 # Canonical commands (source of truth)
│   └── src/                  # Source Markdown commands
│       ├── status.md
│       ├── issue.md
│       ├── branch.md
│       ├── pr.md
│       ├── push.md
│       ├── followup.md
│       ├── link.md
│       ├── check-workflow.md
│       ├── check-auth.md
│       └── protect.md
│
├── bin/                      # Build and setup scripts
│   ├── build-commands.sh     # Multi-agent command builder
│   └── cursor_setup.sh       # Cursor User Rule helper
│
├── scripts/                  # Workflow commands (Python)
│   ├── issue.py
│   ├── branch.py
│   ├── pr.py
│   ├── status.py
│   ├── push.py
│   ├── followup.py
│   ├── link.py
│   ├── check-workflow.py
│   ├── check-auth.py
│   └── protect.py
│
├── bin/
│   ├── cursor_setup.sh       # Cursor User Rule helper
│   └── legacy/
│       └── agentsdotmd-init.py  # v1 script (archived)
│
├── templates/                # Templates for optional installs
│   ├── CLAUDE.md
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── tests/                    # Unit tests
│   └── test_functions.py
│
└── docs/                     # Additional documentation
    ├── AGENTS_REFERENCE.md
    └── v2-migration.md
```

## License

MIT License - feel free to use and modify as needed.

## Credits

Created to enforce consistent, traceable, issue-first development workflows across AI coding agents.

Inspired by the need for deterministic execution of complex Git workflows while maintaining AI flexibility in decision-making.

Built on the AGENTS.md standard that emerged in July 2025, now supported by 60+ AI development tools.

---

## Why v2?

v2 eliminates the repetitive per-project setup that plagued v1. Now you install once and Cursor commands work everywhere. See the [Migration Guide](docs/v2-migration.md) for details.

**Upgrading from v1?** Check the [Migration Guide](docs/v2-migration.md).
