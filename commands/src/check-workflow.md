Validate workflow compliance (check branch, issue linkage, prevent main commits).

**Validates AGENTS.md Rules:**
Ensures compliance with critical workflow standards:
- [Prime Directives](../../rule-packs/core/prime-directives.md): Never commit to main/master, always use feature branches
- [Branch Management](../../rule-packs/github-hygiene/branch-management.md): Proper branch naming and issue linkage
- [Anti-Patterns](../../rule-packs/github-hygiene/anti-patterns.md): Catches common workflow violations

Run: `python3 ~/.agentsmd/scripts/check-workflow.py`
