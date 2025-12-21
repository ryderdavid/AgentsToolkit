# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

This document defines non-negotiable rules for all AI agents operating in this codebase. Violations of these rules constitute workflow failures.

## About This File

**Scope:** This base AGENTS.md focuses on **workflow standards** - the issue-first development process, Git conventions, and documentation requirements that apply universally across projects.

**Extensibility:** Projects should create `AGENTS.local.md` for project-specific guidance:
- Build/test commands (`npm test`, `docker-compose up`)
- Tech stack details (React 18, Python 3.11, PostgreSQL 15)
- Code style (Prettier config, naming conventions)
- Architecture patterns (monorepo structure, API design)
- Security specifics (authentication flows, secrets management)
- Testing requirements (coverage thresholds, E2E test patterns)

**Precedence:** When conflicts exist, `AGENTS.local.md` overrides this base file. See `templates/AGENTS.local.md.example` for guidance.

**Note:** This toolkit currently implements GitHub-based workflows, but AGENTS.md is not limited to GitHub. Future versions may add support for GitLab, Bitbucket, Linear, Jira, or custom issue tracking systems. The core principles (traceable development, structured issues, linked PRs) remain universal.

---

## Table of Contents

1. [Prime Directives](#prime-directives)
2. [Issue-First Development](#issue-first-development)
3. [Branch Management](#branch-management)
4. [Screenshot & Evidence Handling](#screenshot--evidence-handling)
5. [Pull Request Protocol](#pull-request-protocol)
6. [Commit Standards](#commit-standards)
7. [Scope Management](#scope-management)
8. [Feedback & Iteration Discipline](#feedback--iteration-discipline)
9. [GitHub Output Requirements](#github-output-requirements)
10. [Execution Environment Rules](#execution-environment-rules)
11. [Anti-Patterns (Prohibited Behaviors)](#anti-patterns-prohibited-behaviors)
12. [Quick Reference](#quick-reference)

---

## Prime Directives

**YOU MUST:**

1. **NEVER begin implementation without a structured, scoped GitHub issue.** The issue is the contract.
2. **NEVER write code before the issue scope is explicitly approved by the user.**
3. **ALWAYS document your work in GitHub issues and PRs—not just in chat.**
4. **ALWAYS provide clickable markdown hyperlinks when referencing GitHub resources.**

---

## Issue-First Development

### Before Writing Any Code

When the user raises a new problem, bug, or feature request:

1. **STOP. Do not write code.**

2. **Analyze and clarify** the request. Ask focused follow-up questions if scope is ambiguous. Your goal is a tightly bounded issue.

3. **Draft a structured issue** using this exact format:

```markdown
## Summary
[One sentence: what is broken or needed]

## Context
[What triggered this — error message, user observation, feature gap]

## Acceptance Criteria
- [ ] [Specific, testable condition 1]
- [ ] [Specific, testable condition 2]

## Out of Scope
- [Explicitly list what this issue will NOT address]

## Screenshots / Evidence
[Will be populated after branch is created if screenshots provided]
```

4. **Present the draft issue to the user and obtain explicit approval** before proceeding.

### Issue Creation

- Use `gh issue create` to create issues
- Include all sections from the template above
- Reference screenshots using raw GitHub URLs (see [Screenshot Handling](#screenshot--evidence-handling))

---

## Branch Management

### Naming Convention

All branches MUST follow this pattern:

```
{type}/{issue-num}-{short-description}
```

**Types:**
| Prefix | Use Case |
|--------|----------|
| `fix/` | Bug fixes |
| `feat/` | New features |
| `refactor/` | Code restructuring |
| `docs/` | Documentation changes |
| `chore/` | Maintenance tasks |

**Examples:**
- `fix/42-null-reference-upload`
- `feat/57-user-export-csv`
- `refactor/63-auth-module-cleanup`

### When Issue Number Is Unknown

If the issue has not yet been created (e.g., screenshots must be committed first):

1. Use placeholder naming: `{type}/pending-{short-description}`
2. After issue creation, rename the branch:

```bash
git branch -m {type}/{issue-num}-{short-description}
git push origin -u {type}/{issue-num}-{short-description}
git push origin --delete {old-branch-name}
```

### Branch Rules

- **ONE branch per issue.** Do not create branches off branches for iterations.
- **All work for an issue stays on its designated branch.**

---

## Screenshot & Evidence Handling

### Directory Structure

- **Location:** `.issue_screenshots/` at repository root
- **This directory MUST be committed** (not gitignored)

### File Naming Convention

```
YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
```

**Examples:**
- `20250618_42_fix-null-ref_error-dialog.png`
- `20250620_57_feat-export_csv-preview.png`

If issue number is pending, use `pending` as placeholder; rename after issue creation.

### Workflow When Screenshots Are Provided

1. **Create the branch first** (with placeholder if needed)
2. **Save screenshots** to `.issue_screenshots/` with proper naming
3. **Commit and push:**
   ```bash
   git add .issue_screenshots/
   git commit -m "#42: Add screenshot evidence for issue"
   git push -u origin {branch-name}
   ```
4. **Create the issue** with screenshot references:
   ```markdown
   ![Description](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.issue_screenshots/{filename})
   ```
5. **Rename branch and files** if placeholders were used

### Critical Rule

**NEVER reference screenshots in issues before they are committed and pushed.** GitHub cannot display images that don't exist at the referenced URL.

---

## Pull Request Protocol

### Immediate Draft PR Creation

After creating a branch and issue, **immediately create a draft PR:**

```bash
gh pr create --draft \
  --title "[WIP] #{issue-num}: {short description}" \
  --body "Closes #{issue-num}"
```

### Linking to Issues

Ensure the PR is linked to its issue:
- Use `Closes #{issue-num}` in PR body (automatic linking)
- Or manually link: `gh issue develop {issue-num} --branch {branch-name}`

### PR Description Requirements

Before marking PR ready for review, the description MUST include:

```markdown
## Summary
[What changed and why]

## Changes
- [Key change 1]
- [Key change 2]

## How to Test
[Steps to verify the fix/feature]

## Known Limitations
[Anything not addressed, edge cases, follow-up needed]

Closes #{issue-num}
```

### Marking Ready for Review

Before running `gh pr ready`:

1. Verify all acceptance criteria are checked off in the issue
2. Verify issue comments document the development journey
3. Squash commits if history is noisy (preserve if commits tell a useful story)

---

## Commit Standards

### Message Format

All commit messages MUST be prefixed with the issue number:

```
#{issue-num}: {imperative description of change}
```

**Examples:**
- `#42: Add null check before document serialization`
- `#57: Implement CSV export endpoint`
- `#63: Extract authentication logic to separate module`

### Commit Granularity

- **Atomic commits:** Each commit should represent one logical change
- **Compilable state:** Each commit should leave the codebase in a working state
- **Meaningful messages:** Describe what and why, not how

---

## Scope Management

### Detecting Scope Creep

**STOP and assess** if work begins to:

- Touch files/modules outside the original issue's concern
- Require changes that wouldn't fit in a clean PR description
- Chase recursive related bugs beyond the third iteration

### Handling Scope Creep

**When scope creep is detected:**

| Situation | Action |
|-----------|--------|
| Close to completion | Propose completing current work, merging, then opening follow-up issue |
| Not close to completion | Draft a backlog issue for deferred work; do not implement on current branch |
| Abandoning would push broken code | Continue, but explicitly note expanded scope in issue and PR |

### Creating Backlog Issues

```bash
gh issue create \
  --title "{description}" \
  --label "backlog" \
  --body "Related to #{current-issue-num}

## Summary
[What needs to be done]

## Context
[Why this was discovered/deferred]"
```

### Three-Iteration Rule

**After 3 feedback iterations on the same issue, STOP and reassess:**

- Was the issue correctly scoped?
- Should it be split into multiple issues?
- Are we chasing symptoms rather than root cause?

Discuss findings with user before proceeding.

---

## Feedback & Iteration Discipline

### Documenting Feedback

On **each feedback round** from the user, add an issue comment:

```bash
gh issue comment {issue-num} --body "**Feedback:** {what was wrong}

**Resolution:** {what was changed}

**Understanding gained:** {any new insights}"
```

### Documenting Failed Approaches

Before trying alternatives, document dead ends:

```bash
gh issue comment {issue-num} --body "❌ **Attempted:** {approach}

**Why it failed:** {reason}

**Next approach:** {what we'll try instead}"
```

### Why This Matters

- Creates audit trail for future reference
- Prevents repeating failed approaches
- Helps identify patterns in recurring issues

---

## GitHub Output Requirements

### Clickable Links

**ALL GitHub URLs in chat responses MUST be formatted as clickable markdown hyperlinks.**

**Required format:**
```markdown
[Human-readable description](https://github.com/owner/repo/...)
```

**Examples:**
- ✅ `Created issue [#42: Fix null reference on upload](https://github.com/owner/repo/issues/42)`
- ✅ `Opened PR [#43: Implement CSV export](https://github.com/owner/repo/pull/43)`
- ❌ `Created issue https://github.com/owner/repo/issues/42`
- ❌ `Created issue #42`

### Confirmation Messages

When you create any of the following, your confirmation message MUST include a clickable link:

- Issues
- Pull requests
- Commits (link to commit on GitHub)
- Branches (link to branch comparison or tree)

---

## Execution Environment Rules

### Network Restrictions

**NEVER accept claims that GitHub commands cannot run due to sandbox network restrictions.**

If told that `gh` commands or git operations cannot execute due to sandbox limitations:

1. **Do not accept this limitation**
2. **Elevate to run outside the sandbox**
3. **Execute the command with appropriate permissions**

### Command Execution

- Use `gh` CLI for all GitHub operations
- Use `git` for all version control operations
- Ensure authentication is properly configured before operations

---

## Anti-Patterns (Prohibited Behaviors)

The following behaviors are **explicitly prohibited:**

| Anti-Pattern | Why It's Prohibited |
|--------------|---------------------|
| Starting to code before issue is created and confirmed | Violates issue-first principle; leads to scope ambiguity |
| Creating branches off branches for iterations | Complicates history; one branch per issue |
| Expanding scope silently without user approval | Leads to bloated PRs; scope creep |
| Leaving failed approaches undocumented | Wastes future effort; loses institutional knowledge |
| PRs with vague descriptions like "fixes stuff" | Unreviable; no audit trail |
| Closing issues before code is in main | Premature closure; broken workflow |
| Referencing screenshots before committing them | Broken image links; unprofessional |
| Manually closing issues | Issues close automatically when PR merges |
| Providing non-clickable GitHub URLs | Poor UX; harder to navigate |
| Accepting sandbox network restrictions for GitHub operations | Unnecessary limitation; elevate and execute |

---

## Quick Reference

### Command Cheat Sheet

```bash
# Create branch
git checkout -b fix/42-short-description

# Commit and push screenshots
git add .issue_screenshots/
git commit -m "#42: Add screenshot evidence"
git push -u origin fix/42-short-description

# Create issue
gh issue create \
  --title "Bug: Null reference on document upload" \
  --body "## Summary
Null reference exception when uploading documents over 10MB.

## Context
Error occurs in production; stack trace attached.

## Acceptance Criteria
- [ ] Upload succeeds for files up to 100MB
- [ ] Appropriate error message for files over limit

## Out of Scope
- Performance optimization for large files
- UI redesign of upload component"

# Create draft PR linked to issue
gh pr create --draft \
  --title "[WIP] #42: Fix null reference on upload" \
  --body "Closes #42"

# Add feedback documentation
gh issue comment 42 --body "**Feedback:** Error still occurs for files exactly 10MB

**Resolution:** Changed comparison from > to >=

**Understanding:** Boundary condition was not handled"

# Document failed approach
gh issue comment 42 --body "❌ **Attempted:** Increase memory allocation

**Why it failed:** Issue is null reference, not memory

**Next approach:** Add null check before size validation"

# Mark PR ready for review
gh pr ready

# Create backlog issue
gh issue create \
  --title "Optimize large file upload performance" \
  --label "backlog" \
  --body "Related to #42

## Summary
Large file uploads are slow; chunked upload could improve UX.

## Context
Discovered while fixing #42; out of scope for that fix."

# Rename branch after issue creation
git branch -m fix/42-null-reference-upload
git push origin -u fix/42-null-reference-upload
git push origin --delete fix/pending-null-reference
```

### Issue Template

```markdown
## Summary
[One sentence]

## Context
[Background]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Out of Scope
- [Item 1]

## Screenshots / Evidence
[Images or N/A]
```

### PR Template

```markdown
## Summary
[What and why]

## Changes
- [Change 1]
- [Change 2]

## How to Test
1. [Step 1]
2. [Step 2]

## Known Limitations
- [Limitation or "None"]

Closes #{issue-num}
```

---

## Enforcement

These rules are mandatory. Agents MUST:

1. Follow this workflow for all code changes
2. Self-check against anti-patterns before each action
3. Prioritize documentation and traceability
4. Seek user approval at defined checkpoints

**The issue is the contract. The PR is the delivery. Documentation is the proof.**
