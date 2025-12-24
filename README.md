# Agents Toolkit

A global toolkit that enforces issue-first development workflows across AI coding agents (Cursor, Claude Code, GitHub Copilot, Jules, Aider, etc.).

**Now with native Windows support!** All scripts rewritten in Python for true cross-platform compatibility.

## Features

- **🌍 Global Installation** - Install once, use everywhere
- **📋 Single Constitution** - Shared AGENTS.md symlinked into every repo
- **🔗 Symlink Architecture** - Update once, all repos benefit automatically (with Windows fallback)
- **🤖 Cross-Agent Compatible** - Works with Cursor, Claude Code, GitHub Copilot, Jules, Aider
- **✅ Issue-First Workflow** - Enforces traceable development patterns
- **🚀 Zero Mental Context** - Simple `agentsdotmd-init` command
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

### One-Time Global Installation

**All Platforms:**
```bash
# Clone the repository
git clone https://github.com/YOU/AgentsToolkit.git ~/Projects/AgentsToolkit

# Run global installer
cd ~/Projects/AgentsToolkit
python3 install.py

# Restart your terminal (or source your shell config)
source ~/.zshrc  # or ~/.bashrc (Unix only)
```

This installs the toolkit to `~/.agents_toolkit/` (or `%USERPROFILE%\.agents_toolkit` on Windows) and adds `agentsdotmd-init` to your PATH.

### Initialize Any Repository

**All Platforms:**
```bash
# Navigate to any git repository
cd ~/my-project

# Initialize with toolkit
agentsdotmd-init

# For monorepos (optional)
cd ~/my-monorepo
agentsdotmd-init --subdir backend
```

**Note:** On Unix systems, `agentsdotmd-init` is a symlink to `agentsdotmd-init.py`. On Windows, you can use either `agentsdotmd-init.py` or add `.py` to your PATHEXT.

## What Gets Created

When you run `agentsdotmd-init` in a repository:

```
your-repo/
├── AGENTS.md -> ~/.agents_toolkit/AGENTS.md          # Symlink to base constitution
├── CLAUDE.md -> ~/.agents_toolkit/templates/CLAUDE.md # Claude Code enforcement (symlink)
├── .agents/
│   └── commands/ -> ~/.agents_toolkit/scripts/        # Universal script location (symlink)
├── .cursor/
│   ├── commands/                                      # Cursor markdown wrappers for /commands
│   │   ├── status.md, issue.md, branch.md, pr.md, etc.
│   └── rules/agents-workflow/RULE.md                  # Cursor enforcement (copied, customizable)
├── .issue_screenshots/                                # Screenshot storage (committed to git)
├── .github/                                           # Optional GitHub templates
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
└── .vscode/                                           # Optional VS Code tasks
    └── tasks.json
```

### Symlinks vs Copies

- **Symlinked** (automatic updates): AGENTS.md, CLAUDE.md, `.agents/commands/`
- **Copied** (refreshed via `--update`): `.cursor/commands/*.md`, `.cursor/rules/`, `.github/` templates

## Documentation Structure

- **AGENTS.md (Base Constitution)**  
  Symlinked from `~/.agents_toolkit/AGENTS.md`. Contains universal workflow standards. See [AGENTS.md](AGENTS.md).

- **AGENTS_REFERENCE.md (Command Reference)**  
  Command examples, templates, and detailed examples in `docs/AGENTS_REFERENCE.md`. See [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

### What Goes Where?

**AGENTS.md (Base)** - Universal workflow standards
- Issue-first development process
- Git conventions (branches, commits, PRs)
- Documentation requirements

**Project-specific details** - Add directly to AGENTS.md or use nested AGENTS.md files in monorepos (closest file wins per agents.md spec).

**Note:** Currently GitHub-focused, but AGENTS.md principles (traceable development, structured issues, linked PRs) are universal. Future support for other platforms (GitLab, Linear, etc.) is possible.

## Philosophy

**Every piece of work flows through: Issue → Branch → Commits → PR → Merge**

The toolkit enforces:
- ✅ Issue-first development (never code before creating an issue)
- ✅ Branch naming: `{type}/{issue-num}-{description}` or `{type}/pending-{desc}`
- ✅ Screenshot handling in `.issue_screenshots/`
- ✅ PR linking with `Closes #N` syntax
- ✅ Commit format: `#42: Description`

## Workflow Scripts

All commands available via `.agents/commands/` (symlinked to `~/.agents_toolkit/scripts/`). Cursor users can also use `/status`, `/issue`, etc. via the markdown wrappers in `.cursor/commands/`.

### Creating Issues

```bash
.agents/commands/issue.py "Fix login button" "Button misaligned on mobile" screenshot.png

# What it does:
# 1. Creates branch: fix/pending-fix-login-button
# 2. Saves screenshot to .issue_screenshots/
# 3. Commits and pushes
# 4. Creates GitHub issue with embedded screenshot
# 5. Renames branch: fix/42-fix-login-button
# 6. Links branch to issue in git config
```

### Checking Status

```bash
.agents/commands/status.py

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

### Creating Pull Requests

```bash
.agents/commands/pr.py

# What it does:
# 1. Detects linked issue from git config
# 2. Validates branch is pushed
# 3. Generates PR with proper template
# 4. Links with "Closes #42" syntax
```

### Other Commands

- `branch.py [type] "description"` - Create branch (auto-detects type if omitted)
- `link.py <pr-num> <issue-num>` - Link existing PR to issue
- `followup.py <issue-num> "comment"` - Add comment to issue with optional screenshots

## Safety Guarantees

All workflow scripts are restricted to safe (Tier 1) operations:
- ✅ Create/edit issues, PRs, comments, branches
- ✅ Normal git operations (`add`, `commit`, `push` without `--force`, `checkout`, `branch` create/rename)
- ✅ Read-only status/log/diff/show commands
- ❌ No deletes of issues/PRs/repos/branches
- ❌ No force push, history rewrite, or `git reset --hard`
- ❌ No automatic PR merges

Safety tiers (per AGENTS.md):
- **Tier 1 (execute):** Safe/read-only/additive operations
- **Tier 2 (confirm):** Closing issues/PRs manually
- **Tier 3 (explicit request only):** Destructive operations (delete/force/merge)

## How It Works

### The Hybrid Architecture

```
┌─────────────────────────────────────┐
│ AGENTS.md                           │
│ - When to create issues             │
│ - Scope boundaries                  │
│ - Workflow decisions                │
│ ↓ (~600 tokens in context)          │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ Cursor Rule (Enforcement)           │
│ - alwaysApply: true                 │
│ - "Read AGENTS.md"                  │
│ - "Use workflow scripts"            │
│ ↓ (~100 tokens in context)          │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ AI Decision Layer                   │
│ - Consults AGENTS.md rules          │
│ - Decides: "Need to create issue"   │
│ - Executes: Python(issue.py)        │
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
- ✅ **~700 tokens** for workflow rules (vs 2000+ for explicit commands)
- ✅ **Deterministic** execution of complex procedures
- ✅ **Flexible** AI decision-making
- ✅ **Automatic updates** via symlinks
- ✅ **Single source of truth**

## Cross-Agent Compatibility

| Agent | AGENTS.md Support | Hierarchical Config | Script Access | Status |
|-------|------------------|---------------------|---------------|--------|
| **Cursor** | ✅ Native | ✅ Nearest file wins | Built-in `/commands` (markdown wrappers → `.agents/commands/`) | Fully supported |
| **GitHub Copilot** | ✅ Native (Aug 2025) | ✅ Nearest file wins | Terminal or tasks (`.agents/commands/`) | Fully supported |
| **Claude Code** | ✅ Via CLAUDE.md | ✅ Hierarchical | Terminal (`.agents/commands/`), VS Code tasks, aliases | Fully supported |
| **Jules** | ✅ Native | ✅ Repo root | Terminal (`.agents/commands/`) | Fully supported |
| **Aider** | ✅ Recommended | ✅ Standard | Terminal (`.agents/commands/`) | Fully supported |

The toolkit creates a standalone `CLAUDE.md` file with explicit workflow enforcement for Claude Code compatibility.

## Windows Support

AgentsToolkit now has full Windows support via Python 3.8+ scripts.

### Installation on Windows

1. **Install Python 3.8+** from [python.org](https://python.org) or via `winget install Python.Python.3`
2. **Install Git for Windows** from [git-scm.com](https://git-scm.com/)
3. **Install GitHub CLI** from [cli.github.com](https://cli.github.com/) or via `winget install GitHub.cli`
4. **Run the installer:** `python install.py` (see Quick Start above)

### Symlinks on Windows

The toolkit uses a smart fallback chain for Windows compatibility:

1. **Symlinks** (preferred) - Requires Developer Mode or Administrator privileges
2. **Junctions** (directories only) - Works without special permissions
3. **Hard links** (files only) - Same volume required
4. **Copy** (last resort) - Manual updates needed via `agentsdotmd-init --update`

**To enable symlinks without admin:**
- Windows 10/11: Settings → Update & Security → For Developers → Developer Mode

If symlinks are unavailable, the installer will use junctions for directories and copy files, displaying appropriate warnings.

### Running Scripts on Windows

**Via Python directly:**
```powershell
python .agents\commands\status.py
python .agents\commands\branch.py feat "add authentication"
python .agents\commands\issue.py "Bug title" "Description"
python .agents\commands\pr.py
```

**Via Cursor commands:** `/status`, `/branch`, `/issue`, `/pr` work automatically (Cursor wrappers call Python)

**Via VS Code tasks:** Cmd+Shift+P → "Tasks: Run Task" → "Agents: Status" etc.

## VS Code + Claude Code Setup

Claude Code reads `CLAUDE.md` (symlinked to the toolkit template) which contains explicit workflow enforcement rules with "STOP" language at the top. Keep the symlink intact so updates flow automatically.

**Running workflow scripts:**

1. **Direct terminal:** `python3 .agents/commands/status.py` (or `python` on Windows)
2. **VS Code tasks:** Cmd+Shift+P → "Tasks: Run Task" → "Agents: Status" (optional `.vscode/tasks.json` installed by `agentsdotmd-init` when you opt in)
3. **Shell aliases:** add shortcuts such as `alias agents-status='python3 .agents/commands/status.py'`

When prompting Claude Code, explicitly reference the repo-local script path (for example, "run python3 .agents/commands/status.py from the repo root") so it executes the workflow scripts.

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

## Testing

Unit tests verify all deterministic functions:

```bash
cd ~/Projects/AgentsToolkit
./tests/test_functions.py

# 39 tests covering:
# ✓ detect_branch_type
# ✓ Branch slug generation
# ✓ Branch name format (AGENTS.md)
# ✓ Screenshot filename format
# ✓ Commit message format
# ✓ PR title format
# ✓ detect_category
```

## Customization

### Monorepo Support

For monorepos, you can:

1. **Use `--subdir` flag:**
   ```bash
   agentsdotmd-init --subdir backend
   ```

2. **Create nested AGENTS.md files** (matches GitHub Copilot/Cursor behavior):
   ```
   monorepo/
   ├── AGENTS.md               # Root (symlinked)
   ├── backend/
   │   └── AGENTS.md           # Backend-specific (created manually, not symlinked)
   └── frontend/
       └── AGENTS.md           # Frontend-specific
   ```

AI tools use "nearest file in directory tree wins" pattern.

## Updating the Toolkit

To get toolkit updates in all your repos:

```bash
# Pull latest toolkit changes
cd ~/Projects/AgentsToolkit
git pull

# Re-run global installer (if install.py changed)
python3 install.py

# Refresh copied files in an existing repo
cd /path/to/your/repo
agentsdotmd-init --update
```

Symlinked files (AGENTS.md, CLAUDE.md, `.agents/commands/`) update automatically. Copied files refresh when you run `--update`:
- `.cursor/commands/*.md` (Cursor command wrappers; prompt before overwrite)
- `.cursor/rules/agents-workflow/RULE.md` (prompt before overwrite)
- Existing `.github/ISSUE_TEMPLATE.md` and `PULL_REQUEST_TEMPLATE.md` (prompt; not installed if absent)

## Architecture Details

### Global Installation Location

```
~/.agents_toolkit/
├── AGENTS.md              # Base constitution
├── bin/
│   ├── agentsdotmd-init.py  # Python script (cross-platform)
│   └── agentsdotmd-init     # Symlink to .py (Unix only)
├── scripts/              # Symlinked to repos
│   ├── issue.py
│   ├── branch.py
│   ├── pr.py
│   ├── status.py
│   ├── link.py
│   └── followup.py
├── cursor-rules/
│   └── agents-workflow/
│       └── RULE.md.template
├── templates/
│   ├── CLAUDE.md
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
└── install.py
```

### Why Symlinks?

**Symlinked files:**
- Single source of truth
- Automatic updates (fix once, all repos benefit)
- Transparent to team (symlinks visible in git)
- Easy to audit (`ls -la` shows link targets)

**Copied files:**
- Customizable per-repo
- Safe to modify
- Won't be overwritten by updates

## Troubleshooting

### Command Not Found: agentsdotmd-init

```bash
# Verify PATH was updated
echo $PATH | grep agents_toolkit

# Re-source shell config
source ~/.zshrc  # or ~/.bashrc

# Manually verify
ls -l ~/.agents_toolkit/bin/agentsdotmd-init
```

### Cursor Not Loading Rules

1. Restart Cursor
2. Check `.cursor/rules/agents-workflow/RULE.md` exists
3. Verify frontmatter has `alwaysApply: true`

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

### Symlinks Not Working

If your platform doesn't support symlinks:
- Modify `agentsdotmd-init` to copy instead of symlink
- Update manually when toolkit changes

## Uninstallation

### Remove from a Repository

```bash
# From repository root
rm AGENTS.md CLAUDE.md
rm -rf .agents/commands .cursor/commands .cursor/rules/agents-workflow
rm -rf .issue_screenshots
```

### Remove Global Installation

```bash
rm -rf ~/.agents_toolkit

# Remove from shell config
# Edit ~/.zshrc or ~/.bashrc and delete:
# # Agents Toolkit
# export PATH="$HOME/.agents_toolkit/bin:$PATH"
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
├── install.py                 # Global installer (cross-platform)
├── uninstall.sh              # Uninstaller
│
├── bin/
│   ├── agentsdotmd-init.py  # Repo initialization command (Python)
│   └── agentsdotmd-init    # Symlink to .py (Unix only)
│
├── scripts/                  # Workflow commands
│   ├── issue.py
│   ├── branch.py
│   ├── pr.py
│   ├── status.py
│   ├── link.py
│   └── followup.py
│
├── cursor-rules/             # Cursor-specific enforcement
│   └── agents-workflow/
│       └── RULE.md.template
│
├── templates/                # Templates for repo initialization
│   ├── CLAUDE.md
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── tests/                    # Unit tests
│   └── test_functions.py
│
└── docs/                     # Additional documentation
```

## License

MIT License - feel free to use and modify as needed.

## Credits

Created to enforce consistent, traceable, issue-first development workflows across AI coding agents.

Inspired by the need for deterministic execution of complex Git workflows while maintaining AI flexibility in decision-making.

Built on the AGENTS.md standard that emerged in July 2025, now supported by 60+ AI development tools.

---

## Appendix: AGENTS.md Word Budget

```
AGENTS.md Word Budget (target: 1,000 words)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
██████████████████████████████░░░░░░░░░░  754/1000 (75%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Buffer remaining: 246 words for future additions
```

Per [AGENTS.md best practices](https://agents.md), top-level files should be ~300–1,200 words. Shorter files reduce token cost, latency, and instruction dilution.
