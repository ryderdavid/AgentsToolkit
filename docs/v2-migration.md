# AgentsToolkit v2 Migration Guide

## What's New in v2?

AgentsToolkit v2 introduces a fully global architecture that eliminates per-project setup:

- ✅ **No per-project initialization** - Cursor commands work everywhere without running `agentsdotmd-init`
- ✅ **Global command architecture** - Cursor commands reference `~/.agentsmd/scripts/` directly
- ✅ **Interactive agent configuration** - Setup wizard during installation
- ✅ **Single source of truth** - Commands live in `~/.agentsmd/commands/` and are symlinked to `~/.cursor/commands/`
- ✅ **Cleaner repositories** - No toolkit files to commit (except `.issue_screenshots/` when used)
- ✅ **Auto-created screenshots directory** - Scripts create `.issue_screenshots/` on-demand

## Breaking Changes

### Installation Directory Renamed
- **Old:** `~/.agents_toolkit/`
- **New:** `~/.agentsmd/`

### Per-Project Setup Removed
- **Old:** Run `agentsdotmd-init` in each project
- **New:** No per-project setup needed

### Command Reference Updated
- **Old:** Commands referenced `.agents/commands/status.py`
- **New:** Commands reference `~/.agentsmd/scripts/status.py`

### Files No Longer Created Per-Project
The following files are no longer created in each project:
- `AGENTS.md` (symlink to global)
- `CLAUDE.md` (symlink to global)
- `.agents/commands/` (symlink to scripts)
- `.cursor/rules/agents-workflow/` (Cursor-specific enforcement)

## Migration Steps

### 1. Backup (Optional)

```bash
cp -r ~/.agents_toolkit ~/.agents_toolkit.backup
```

### 2. Uninstall v1

```bash
# Remove old installation
rm -rf ~/.agents_toolkit

# Remove PATH entry from shell config
# Edit ~/.zshrc or ~/.bashrc and delete:
#   # Agents Toolkit
#   export PATH="$HOME/.agents_toolkit/bin:$PATH"
```

### 3. Install v2

```bash
cd ~/Projects/AgentsToolkit
git pull origin main
python3 install.py
```

The installer will:
1. Install files to `~/.agentsmd/`
2. Add to PATH
3. Prompt for agent configuration (interactive checkbox menu)
4. Symlink Cursor commands to `~/.cursor/commands/`
5. Run `cursor_setup.sh` to set up User Rule

### 4. Configure Cursor User Rule

The installer will copy the User Rule to your clipboard and prompt you to open Cursor.

**Manual steps:**
1. Open Cursor
2. Go to: Settings → Cursor Settings → Rules
3. Under "User Rules", click "+ Add Rule"
4. Paste: `Always read and follow ~/.agentsmd/AGENTS.md`
5. Done!

### 5. Clean Up Old Projects (Optional)

In each project that had v1 installed, you can remove the old toolkit files:

```bash
# Remove old symlinks (if they point to old toolkit)
rm AGENTS.md CLAUDE.md
rm -rf .agents/

# Remove old Cursor rules (replaced by global commands)
rm -rf .cursor/rules/agents-workflow/
rm -rf .cursor/commands/

# KEEP: .issue_screenshots/ (contains workflow data)
```

**Note:** This cleanup is optional. The v2 global commands will work even if old files are present.

### 6. Verify Installation

Open Cursor in any project and test:

```bash
cd ~/any-project

# In Cursor, type:
/status

# Or from terminal:
python3 ~/.agentsmd/scripts/status.py
```

If it works, you're done!

## What Stays The Same

### Workflow Commands
All workflow commands remain unchanged:
- `/status`, `/issue`, `/branch`, `/pr`, `/push`, `/followup`, `/link`
- `python3 ~/.agentsmd/scripts/*.py` (new paths, same functionality)

### AGENTS.md Standards
- Issue-first development
- Branch naming: `{type}/{issue-num}-{description}`
- Commit format: `#{issue-num}: description`
- PR linking: `Closes #{num}`

### Screenshot Handling
- Screenshots still go in `.issue_screenshots/`
- Same naming convention: `YYYYMMDD_{issue-num}_{branch}_{desc}.{ext}`
- Now auto-created on first use (no manual setup needed)

## Architecture Comparison

### v1 Architecture

```
~/.agents_toolkit/
├── AGENTS.md
├── bin/agentsdotmd-init.py
├── scripts/
└── templates/cursor-commands/

your-repo/
├── AGENTS.md -> ~/.agents_toolkit/AGENTS.md
├── CLAUDE.md -> ~/.agents_toolkit/templates/CLAUDE.md
├── .agents/commands/ -> ~/.agents_toolkit/scripts/
├── .cursor/
│   ├── commands/*.md (copied)
│   └── rules/agents-workflow/RULE.md (copied)
└── .issue_screenshots/
```

### v2 Architecture

```
~/.agentsmd/
├── AGENTS.md
├── CLAUDE.md
├── commands/ (Cursor command wrappers)
│   ├── status.md
│   ├── issue.md
│   └── ... (10 total)
└── scripts/ (Python workflow scripts)
    ├── status.py
    ├── issue.py
    └── ...

~/.cursor/
└── commands/ (symlinks to ~/.agentsmd/commands/)
    ├── status.md -> ~/.agentsmd/commands/status.md
    └── ...

your-repo/
└── .issue_screenshots/ (auto-created on first use)
```

## Benefits of v2

1. **One command setup**: Just `python3 install.py`
2. **Works everywhere**: Cursor commands available in all projects without per-project setup
3. **Cleaner repos**: No toolkit files to commit (except `.issue_screenshots/` when used)
4. **Single source of truth**: Commands in `~/.agentsmd/commands/` (symlinked to `~/.cursor/commands/`)
5. **Easy updates**: Update toolkit → changes propagate via symlinks
6. **Interactive configuration**: Choose which agents to configure during installation

## Rollback to v1

If you need to rollback to v1:

```bash
cd ~/Projects/AgentsToolkit
git checkout v1.x  # Replace with last v1 tag/commit
python3 install.py

# Then run in each project:
cd ~/my-project
agentsdotmd-init
```

## Troubleshooting

### Cursor Commands Not Working

1. Verify symlinks: `ls -la ~/.cursor/commands/`
2. Check they point to: `~/.agentsmd/commands/*.md`
3. Restart Cursor

### Scripts Not Found

Verify installation:
```bash
ls -la ~/.agentsmd/scripts/
```

Should show: `status.py`, `issue.py`, `branch.py`, `pr.py`, etc.

### User Rule Not Applied

1. Open Cursor Settings → Cursor Settings → Rules
2. Verify User Rule exists: `Always read and follow ~/.agentsmd/AGENTS.md`
3. If missing, manually add it

### PATH Not Updated

```bash
# Check current PATH
echo $PATH | grep agentsmd

# If not found, manually add to shell config:
echo 'export PATH="$HOME/.agentsmd/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/ryderdavid/AgentsToolkit/issues
- Check AGENTS.md for workflow standards
- Review docs/AGENTS_REFERENCE.md for command examples

