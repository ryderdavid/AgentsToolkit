# Work Item-First Development

1. **STOP.** Do not write code.
2. **Clarify** the request. Ask questions if scope is ambiguous.
3. **Create work item** via `az boards work-item create`.
4. **Get explicit approval** before proceeding.

**Work Item Types:** Bug, User Story, Task, Feature

**Template:**
```
Title: [Type]: [Description]
Description:
  ## Summary
  [One sentence]
  
  ## Acceptance Criteria
  - [ ] Criterion 1
  - [ ] Criterion 2
  
  ## Out of Scope
  - Item 1
```

**Scope:** All file changes. Audit trail is non-negotiable.
