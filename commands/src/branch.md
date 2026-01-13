Create an issue-first branch using naming conventions.

**Branch Naming Format:**
See rule packs for branch naming standards:
- Naming convention: [rule-packs/github-hygiene/branch-management.md](../../rule-packs/github-hygiene/branch-management.md)
- Format: `{type}/{issue-num}-{short-description}`
- Types: `fix/`, `feat/`, `refactor/`, `docs/`, `chore/`
- Full reference: [AGENTS_REFERENCE.md Branch Naming](../../docs/AGENTS_REFERENCE.md#branch-naming-examples)

Usage: Ask the user for branch type and description, then run:
`python3 ~/.agentsmd/scripts/branch.py [type] "description"`

Types: fix, feat, refactor, docs, chore
