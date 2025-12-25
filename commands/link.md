Link an existing PR to an issue.

**Workflow Context:**
This is part of the AGENTS.md workflow when PRs are created manually:
- Standard workflow: [Pull Request Protocol section](../../AGENTS.md#pull-request-protocol)
- PRs should normally be linked via `Closes #{num}` in PR body
- This command is a fallback for manual linking

Usage: Ask the user for PR number and issue number, then run:
`python3 ~/.agentsmd/scripts/link.py <pr-num> <issue-num>`


