Enable branch protection and PR-to-issue link enforcement.

**Enforces AGENTS.md Standards:**
Applies GitHub branch protections per AGENTS.md workflow requirements:
- Prevents direct commits to main/master ([Prime Directives](../../rule-packs/core/prime-directives.md))
- Requires PRs to contain issue links `Closes #N` ([PR Protocol](../../rule-packs/github-hygiene/pr-protocol.md))
- Installs PR issue check GitHub Action
- Prevents [Anti-Patterns](../../rule-packs/github-hygiene/anti-patterns.md): "File changes on main/master" and "Closing issues before merge"

Requires admin access to repository.

Run: `python3 ~/.agentsmd/scripts/protect.py`

Options:
- `--branch BRANCH` - Specify branch to protect (default: auto-detect main/master)
- `--skip-action` - Skip installing GitHub Action workflow
