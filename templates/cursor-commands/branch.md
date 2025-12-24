Create an issue-first branch using naming conventions.

**Branch Naming Format:**
See AGENTS.md for branch naming standards:
- Naming convention: [Branch Management section](../../AGENTS.md#branch-management)
- Format: `{type}/{issue-num}-{short-description}`
- Types: `fix/`, `feat/`, `refactor/`, `docs/`, `chore/`
- Examples: [AGENTS_REFERENCE.md Branch Naming](../../docs/AGENTS_REFERENCE.md#branch-naming-examples)

Usage: Ask the user for branch type and description, then run:
`python3 .agents/commands/branch.py [type] "description"`

Types: fix, feat, refactor, docs, chore


