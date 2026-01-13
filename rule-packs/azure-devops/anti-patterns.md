# Anti-Patterns (Azure DevOps-Specific)

| Anti-Pattern | Why Prohibited | Severity |
|--------------|----------------|----------|
| Coding before work item creation | Violates work-item-first; scope ambiguity | ⛔ BLOCKER |
| File changes on main without PR | Bypasses branch policies; breaks workflow | ⛔ BLOCKER |
| Non-clickable Azure DevOps URLs | Poor UX; harder to navigate | ⛔ BLOCKER |
| Weak anchor text in links | Non-descriptive; use meaningful text | ⛔ BLOCKER |
| Missing end-of-round artifact links | No audit trail | ⛔ BLOCKER |
| Bypassing branch policies | Circumvents review process | 🔴 HIGH |
| Branches off branches | Complicates history; one branch per item | 🔴 HIGH |
| Expanding scope silently | Leads to bloated PRs; scope creep | 🔴 HIGH |
| Vague PR descriptions | Unreviewable; no audit trail | 🔴 HIGH |
| Manually completing work items | Should auto-complete on PR merge | 🟡 MEDIUM |
| Work items without acceptance criteria | Unclear definition of done | 🟡 MEDIUM |
