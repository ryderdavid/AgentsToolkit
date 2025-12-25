Create a draft pull request linked to the current issue.

**GitHub PR Format:**
See AGENTS.md for proper PR formatting:
- PR protocol and naming: [Pull Request Protocol section](../../AGENTS.md#pull-request-protocol)
- Full PR template with examples: [AGENTS_REFERENCE.md PR Template](../../docs/AGENTS_REFERENCE.md#pr-template)
- Required format: Title `[WIP] #{num}: {description}`, Body must include `Closes #{num}`

Run: `python3 ~/.agentsmd/scripts/pr.py`

This detects the linked issue from git config and generates a proper PR.


