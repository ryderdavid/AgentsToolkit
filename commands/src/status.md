Show current workflow status (branch, linked issue, commits, PR state).

**Purpose:**
Verifies AGENTS.md workflow compliance by showing:
- Current branch (should be feature branch, not main/master per [Prime Directives](../../rule-packs/core/prime-directives.md))
- Linked issue (required per [Issue-First Development](../../rule-packs/github-hygiene/issue-first.md))
- Commit status and PR state

Run: `python3 ~/.agentsmd/scripts/status.py`
