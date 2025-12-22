# Agents Toolkit

A global toolkit that enforces issue-first development workflows across AI coding agents (Cursor, Claude Code, GitHub Copilot, Jules, Aider, etc.).

## Features

- **🌍 Global Installation** - Install once, use everywhere
- **📋 Hierarchical Configuration** - Base constitution + repo-specific overrides
- **🔗 Symlink Architecture** - Update once, all repos benefit automatically
- **🤖 Cross-Agent Compatible** - Works with Cursor, Claude Code, GitHub Copilot, Jules, Aider
- **✅ Issue-First Workflow** - Enforces traceable development patterns
- **🚀 Zero Mental Context** - Simple `agentsdotmd-init` command

## Quick Start

### One-Time Global Installation

```bash
# Clone the repository
git clone https://github.com/YOU/AgentsToolkit.git ~/Projects/AgentsToolkit

# Run global installer
cd ~/Projects/AgentsToolkit
./install.sh

# Restart your terminal (or source your shell config)
source ~/.zshrc  # or ~/.bashrc
```

This installs the toolkit to `~/.agents_toolkit/` and adds `agentsdotmd-init` to your PATH.

### Initialize Any Repository

```bash
# Navigate to any git repository
cd ~/my-project

# Initialize with toolkit
agentsdotmd-init

# For monorepos (optional)
cd ~/my-monorepo
agentsdotmd-init --subdir backend
```

## What Gets Created

When you run `agentsdotmd-init` in a repository:

```
your-repo/
├── AGENTS.md -> ~/.agents_toolkit/AGENTS.md          # Symlink to base constitution
├── AGENTS.local.md                                    # Repo-specific overrides (customizable)
├── CLAUDE.md -> AGENTS.md                             # Claude Code compatibility symlink
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

- **Symlinked** (automatic updates): AGENTS.md, `.agents/commands/`, CLAUDE.md
- **Copied** (customizable per-repo): AGENTS.local.md, `.cursor/commands/*.md`, `.cursor/rules/`, `.github/` templates

## Documentation Structure

The toolkit uses a multi-tier documentation system:

### 1. AGENTS.md (Base Constitution)
- Symlinked from `~/.agents_toolkit/AGENTS.md`
- Contains universal workflow standards (~1,200 words)
- Never modified per-repo
- Updated by pulling toolkit changes
- See [AGENTS.md](AGENTS.md)

### 2. AGENTS.local.md (Repo Overrides)
- Created in each repo with commented examples
- Takes precedence over base AGENTS.md
- Customize for project-specific needs
- Example: "This monorepo uses Nx for build orchestration..."

### 3. AGENTS_REFERENCE.md (Command Reference)
- Contains command examples, templates, and detailed examples
- Lives in `docs/AGENTS_REFERENCE.md`
- Referenced from AGENTS.md for complete examples
- See [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md)

**Precedence:** When conflicts exist, AGENTS.local.md overrides AGENTS.md.

AI tools (Cursor, GitHub Copilot, Claude Code) support hierarchical config using "nearest file in directory tree wins" pattern. For command examples and templates, see [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

### What Goes Where?

**AGENTS.md (Base)** - Universal workflow standards
- Issue-first development process
- Git conventions (branches, commits, PRs)
- Documentation requirements

**AGENTS.local.md (Overrides)** - Project-specific context
- Tech stack & versions
- Build/test commands
- Testing standards
- Code style
- Architecture patterns
- Security boundaries
- Performance requirements

**Why This Split?**
- Base AGENTS.md stays focused on workflow
- Project specifics don't clutter the constitution
- Updates to base workflow propagate automatically via symlinks
- Extensible for future additions (testing frameworks, deployment, etc.)

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
.agents/commands/issue.sh "Fix login button" "Button misaligned on mobile" screenshot.png

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
.agents/commands/status.sh

# Output:
# 📋 Current Workflow Status
# Branch: fix/42-fix-login-button
# Linked Issue: #42
# Issue State: OPEN
# Commits ahead: 2
# Pushed: ✅ Yes
# PR: None - run pr.sh to create
# 📋 Next step: Create PR
```

### Creating Pull Requests

```bash
.agents/commands/pr.sh

# What it does:
# 1. Detects linked issue from git config
# 2. Validates branch is pushed
# 3. Generates PR with proper template
# 4. Links with "Closes #42" syntax
```

### Other Commands

- `branch.sh [type] "description"` - Create branch (auto-detects type if omitted)
- `link.sh <pr-num> <issue-num>` - Link existing PR to issue
- `followup.sh <issue-num> "comment"` - Add comment to issue with optional screenshots

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
│ AGENTS.md + AGENTS.local.md         │
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
│ - "Read both AGENTS.md files"       │
│ - "Use workflow scripts"            │
│ ↓ (~100 tokens in context)          │
└─────────────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────┐
│ AI Decision Layer                   │
│ - Consults AGENTS.md rules          │
│ - Decides: "Need to create issue"   │
│ - Executes: Bash(issue.sh)          │
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
| **Claude Code** | ⚠️ Uses CLAUDE.md | ✅ Hierarchical | Terminal (`.agents/commands/`), VS Code tasks, aliases | Via CLAUDE.md symlink |
| **Jules** | ✅ Native | ✅ Repo root | Terminal (`.agents/commands/`) | Fully supported |
| **Aider** | ✅ Recommended | ✅ Standard | Terminal (`.agents/commands/`) | Fully supported |

The toolkit creates `CLAUDE.md -> AGENTS.md` symlink for cross-agent compatibility.

## VS Code + Claude Code Setup

Claude Code reads `CLAUDE.md -> AGENTS.md` but does not ship Cursor-style `/commands`. Use any of these access methods:

1. **Direct terminal:** `.agents/commands/status.sh` (symlink to toolkit scripts)
2. **VS Code tasks:** Cmd+Shift+P → “Tasks: Run Task” → “Agents: Status” (optional `.vscode/tasks.json` installed by `agentsdotmd-init` when you opt in; tasks call `.agents/commands/…`)
3. **Shell aliases:** add shortcuts such as `alias agents-status='.agents/commands/status.sh'`

When prompting Claude Code, explicitly reference the repo-local script path (for example, “run .agents/commands/status.sh from the repo root”) so it executes the workflow scripts.

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
./tests/test_functions.sh

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

### Repo-Specific Rules (AGENTS.local.md)

After running `agentsdotmd-init`, edit `AGENTS.local.md`:

```markdown
# AGENTS.local.md — Repository-Specific Overrides

## Project Structure
This repository uses Next.js with TypeScript:
- Frontend: `/app` directory
- API: `/app/api`
- Components: `/components`

## Build Commands
\`\`\`bash
npm run dev    # Development server
npm test       # Run tests (required before PR)
npm run build  # Production build
\`\`\`

## Testing Requirements
- Unit tests required for all new functions
- E2E tests for critical user flows
```

Cursor/Claude Code will read both files, with AGENTS.local.md taking precedence.

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
   ├── AGENTS.local.md         # Root overrides
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

# Re-run global installer (if install.sh changed)
./install.sh

# Refresh copied files in an existing repo
cd /path/to/your/repo
agentsdotmd-init --update
```

Symlinked files (AGENTS.md, CLAUDE.md, `.agents/commands/`) update automatically. Copied files refresh when you run `--update`:
- `.cursor/commands/*.md` (Cursor command wrappers; prompt before overwrite)
- `.cursor/rules/agents-workflow/RULE.md` (prompt before overwrite)
- Existing `.github/ISSUE_TEMPLATE.md` and `PULL_REQUEST_TEMPLATE.md` (prompt; not installed if absent)

`AGENTS.local.md` is never changed by `--update` so your local overrides remain intact.

## Architecture Details

### Global Installation Location

```
~/.agents_toolkit/
├── AGENTS.md              # Base constitution
├── bin/
│   └── agentsdotmd-init  # Added to PATH
├── scripts/              # Symlinked to repos
│   ├── issue.sh
│   ├── branch.sh
│   ├── pr.sh
│   ├── status.sh
│   ├── link.sh
│   └── followup.sh
├── cursor-rules/
│   └── agents-workflow/
│       └── RULE.md.template
├── templates/
│   ├── AGENTS.local.md.example
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
└── install.sh
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
rm AGENTS.md CLAUDE.md AGENTS.local.md
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
2. Run tests: `./tests/test_functions.sh`
3. Update documentation
4. Create issues before PRs

## File Structure

```
AgentsToolkit/
├── README.md                 # This file
├── AGENTS.md                 # Workflow standards (source of truth)
├── install.sh                # Global installer
├── uninstall.sh              # Uninstaller
│
├── bin/
│   └── agentsdotmd-init     # Repo initialization command
│
├── scripts/                  # Workflow commands
│   ├── issue.sh
│   ├── branch.sh
│   ├── pr.sh
│   ├── status.sh
│   ├── link.sh
│   └── followup.sh
│
├── cursor-rules/             # Cursor-specific enforcement
│   └── agents-workflow/
│       └── RULE.md.template
│
├── templates/                # Templates for repo initialization
│   ├── AGENTS.local.md.example
│   ├── ISSUE_TEMPLATE.md
│   └── PULL_REQUEST_TEMPLATE.md
│
├── tests/                    # Unit tests
│   └── test_functions.sh
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
