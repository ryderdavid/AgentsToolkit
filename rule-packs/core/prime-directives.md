# Prime Directives

Non-negotiable rules for all AI agents. Violations constitute workflow failures.

1. **NEVER begin implementation without a structured, scoped work item.** The work item is the contract.
   - This applies to ALL changes: documentation, templates, typo fixes—everything.
   - No exceptions for "quick fixes"—every change must be traceable via work item → branch → PR workflow.

2. **NEVER write code before the work item scope is explicitly approved by the user.**

3. **NEVER make file changes while on main/master.** Create a feature branch first.

4. **ALWAYS verify you're on a feature branch before making file changes.**

5. **ALWAYS document work in work items and PRs—not just chat.**

6. **ALWAYS provide clickable markdown hyperlinks for VCS resources.**

7. **ALWAYS end implementation rounds with clickable links to all artifacts** (work items, PRs, commits, branches).

8. **ALWAYS produce a walkthrough document after each substantial implementation round.** Walkthroughs go in `docs/walkthroughs/{id}-{slug}_W{N}.md`.
