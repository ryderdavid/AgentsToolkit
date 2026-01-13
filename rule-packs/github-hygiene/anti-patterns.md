# Anti-Patterns (GitHub-Specific)

| Anti-Pattern | Why Prohibited | Severity |
|--------------|----------------|----------|
| Coding before issue approval | Violates issue-first; scope ambiguity | ⛔ BLOCKER |
| File changes on main/master | Bypasses PR review; breaks workflow | ⛔ BLOCKER |
| Non-clickable GitHub URLs | Poor UX; harder to navigate | ⛔ BLOCKER |
| Weak anchor text in links | Non-descriptive; use meaningful text | ⛔ BLOCKER |
| Missing end-of-round artifact links | No audit trail | ⛔ BLOCKER |
| Branches off branches | Complicates history; one branch per issue | 🔴 HIGH |
| Expanding scope silently | Leads to bloated PRs; scope creep | 🔴 HIGH |
| Vague PR descriptions | Unreviewable; no audit trail | 🔴 HIGH |
| Closing issues before merge | Premature closure | 🔴 HIGH |
| Screenshots before commit | Broken image links | 🟡 MEDIUM |
| Manually closing issues | Auto-close on PR merge | 🟡 MEDIUM |
