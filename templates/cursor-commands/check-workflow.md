Validate workflow compliance (check branch, issue linkage, prevent main commits).

**Validates AGENTS.md Rules:**
Ensures compliance with critical workflow standards:
- [Prime Directives](../../AGENTS.md#prime-directives): Never commit to main/master, always use feature branches
- [Branch Management](../../AGENTS.md#branch-management): Proper branch naming and issue linkage
- [Anti-Patterns](../../AGENTS.md#anti-patterns-prohibited-behaviors): Catches common workflow violations

Run: `python3 .agents/commands/check-workflow.py`


