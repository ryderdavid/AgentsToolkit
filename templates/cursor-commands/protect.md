Enable branch protection and PR-to-issue link enforcement.

**Enforces AGENTS.md Standards:**
Applies GitHub branch protections per AGENTS.md workflow requirements:
- Prevents direct commits to main/master ([Prime Directives](../../AGENTS.md#prime-directives))
- Requires PRs to contain issue links `Closes #N` ([Pull Request Protocol](../../AGENTS.md#pull-request-protocol))
- Installs PR issue check GitHub Action
- Prevents [Anti-Patterns](../../AGENTS.md#anti-patterns-prohibited-behaviors): "File changes on main/master" and "Closing issues before merge"

Requires admin access to repository.

Run: `python3 .agents/commands/protect.py`

Options:
- `--branch BRANCH` - Specify branch to protect (default: auto-detect main/master)
- `--skip-action` - Skip installing GitHub Action workflow








