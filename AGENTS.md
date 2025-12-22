# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

This document defines non-negotiable rules for all AI agents operating in this codebase. Violations of these rules constitute workflow failures.

## About This File

**Scope:** Workflow standards - issue-first development, Git conventions, and documentation requirements.

**Extensibility:** Create `AGENTS.local.md` for project-specific guidance (build commands, tech stack, code style). See `templates/AGENTS.local.md.example`.

**Precedence:** `AGENTS.local.md` overrides this base file when conflicts exist.

**Note:** Currently GitHub-focused, but principles (traceable development, structured issues, linked PRs) are platform-agnostic. Future support for GitLab, Bitbucket, Linear, Jira planned.

**Reference:** Command examples and templates at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

---

## Prime Directives

**YOU MUST:**

1. **NEVER begin implementation without a structured, scoped GitHub issue.** The issue is the contract.
2. **NEVER write code before the issue scope is explicitly approved by the user.**
3. **NEVER make file changes while on main/master branch.** Always create a feature branch first.
4. **ALWAYS verify you are on a feature branch before making any file changes.**
5. **ALWAYS document your work in GitHub issues and PRs—not just in chat.**
6. **ALWAYS provide clickable markdown hyperlinks when referencing GitHub resources.**
7. **ALWAYS end implementation rounds with a summary containing clickable links to all GitHub artifacts created** (issues, PRs, commits, branches, comments).

---

## Issue-First Development

### Before Writing Any Code

1. **STOP. Do not write code.**
2. **Analyze and clarify** the request. Ask focused questions if scope is ambiguous.
3. **Draft a structured issue** (see [Issue Template](docs/AGENTS_REFERENCE.md#issue-template)): Summary, Context, Acceptance Criteria, Out of Scope, Screenshots/Evidence.
4. **Get explicit user approval** before proceeding.

### Issue Creation

Use `gh issue create` with all required sections. Reference screenshots using raw GitHub URLs (see Screenshot Handling).

---

## Branch Management

### CRITICAL: Branch Before Changes

**YOU MUST create and switch to a feature branch BEFORE making any file changes.**

**Pre-Change Checklist:**
1. ✅ Verify issue exists
2. ✅ Check current branch: `git branch --show-current`
3. ✅ If on `main` or `master`: **STOP and create feature branch**
4. ✅ Only proceed with file changes after confirming you're on a feature branch

**Naming Convention:** `{type}/{issue-num}-{short-description}`

| Type | Use Case |
|------|----------|
| `fix/` | Bug fixes |
| `feat/` | New features |
| `refactor/` | Code restructuring |
| `docs/` | Documentation changes |
| `chore/` | Maintenance tasks |

**When Issue Number Is Unknown:** Use `{type}/pending-{short-description}`, then rename after issue creation.

**Branch Rules:**
- ONE branch per issue
- All work for an issue stays on its designated branch
- NEVER commit directly to main/master

See [Command Cheat Sheet](docs/AGENTS_REFERENCE.md#command-cheat-sheet) for examples.

---

## Screenshot & Evidence Handling

**Directory:** `.issue_screenshots/` at repo root (MUST be committed)  
**Naming:** `YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}`

**Workflow:**
1. Create branch (use placeholder if issue not yet created)
2. Save screenshots to `.issue_screenshots/`
3. Commit and push
4. Create issue with raw GitHub URLs
5. Rename branch/files if placeholders used

**Critical:** NEVER reference screenshots before they're committed and pushed.

---

## Pull Request Protocol

**After creating branch and issue, immediately create draft PR:**

```bash
gh pr create --draft --title "[WIP] #{issue-num}: {description}" --body "Closes #{issue-num}"
```

**Linking:** Use `Closes #{issue-num}` in PR body or `gh issue develop`.

**Before marking ready:** (1) All acceptance criteria checked, (2) Issue comments document journey, (3) Squash noisy commits.

See [PR Template](docs/AGENTS_REFERENCE.md#pr-template) for description requirements.

---

## Commit Standards

**Format:** `#{issue-num}: {imperative description}`

**Examples:** `#42: Add null check`, `#57: Implement CSV export`

**Requirements:** Atomic (one logical change), compilable state, meaningful messages (what/why, not how).

---

## Scope Management

| Situation | Detect When | Action |
|-----------|-------------|--------|
| **Scope Creep** | Work touches files/modules outside original issue concern | STOP and assess |
| **Close to completion** | Could finish in 1-2 commits | Propose completing, merging, then opening follow-up issue |
| **Not close** | Would require significant additional work | Draft backlog issue for deferred work; do not implement on current branch |
| **Broken state** | Abandoning would push broken code | Continue, but explicitly note expanded scope in issue and PR |

**Three-Iteration Rule:** After 3 feedback iterations on the same issue, STOP and reassess with user (Was issue correctly scoped? Should it be split? Are we chasing symptoms vs. root cause?).

**Creating Backlog Issues:** Use `gh issue create --label "backlog"` and link to current issue.

---

## Feedback & Iteration Discipline

**On each feedback round:** Add issue comment documenting feedback, resolution, and insights gained.

**Before trying alternatives:** Document failed approaches (what was attempted, why it failed, next approach).

**Why:** Creates audit trail, prevents repeating failures, identifies patterns.

See [Command Cheat Sheet](docs/AGENTS_REFERENCE.md#command-cheat-sheet) for formatting.

---

## GitHub Output Requirements

### Clickable Links

ALL GitHub URLs MUST be markdown hyperlinks: `[Description](https://github.com/...)`

Examples: ✅ `[#42: Fix upload](link)` ❌ `https://github.com/...`

### Confirmation Messages

Include clickable links when creating issues, PRs, commits, branches, or comments.

### End-of-Round Summary

When finishing implementation, provide summary with clickable links to ALL artifacts (branch, commits, PRs, issues, comments) with descriptive anchor text and context.

See [GitHub Output Examples](docs/AGENTS_REFERENCE.md#github-output-examples) for details.

---

## Safety & Execution Rules

### Command Safety Tiers

| Tier | Commands | Action |
|------|----------|--------|
| **1 - Safe** | `gh issue/pr create/edit/comment/view/list`, `gh repo view`, `gh api` GET, `git add/commit/push/checkout/branch/pull/fetch/status/log/diff/show` | Execute immediately |
| **2 - Disruptive** | `gh issue/pr close`, manual workflow bypasses | Require confirmation |
| **3 - Destructive** | `gh issue delete`, `gh pr merge`, `gh repo delete/archive`, `gh api` DELETE, `git branch -d/-D`, `git push --delete/--force`, `git reset --hard`, `git clean -fd` | Only on explicit user request |

### Execution Environment

- All `gh`/`git` commands run outside sandbox with elevation
- Do NOT pre-check authentication or claim sandbox limitations
- Elevate and execute

### Safety Checklist

Before ANY file modifications:

1. ✅ GitHub issue exists?
2. ✅ On feature branch (NOT main/master)? Check: `git branch --show-current`
3. ✅ Branch name follows `{type}/{issue-num}-{desc}`?
4. ✅ Command tier identified?
5. ✅ Tier 1: execute; Tier 2: confirm; Tier 3: only if explicitly requested

---

## Anti-Patterns (Prohibited Behaviors)

| Anti-Pattern | Why It's Prohibited |
|--------------|---------------------|
| Starting to code before issue is created and confirmed | Violates issue-first principle; leads to scope ambiguity |
| Making file changes while on main/master | Bypasses PR review; breaks workflow; direct commits to main |
| Committing directly to main/master | No PR review; no issue linkage; violates traceable development |
| Creating branches off branches for iterations | Complicates history; one branch per issue |
| Expanding scope silently without user approval | Leads to bloated PRs; scope creep |
| Leaving failed approaches undocumented | Wastes future effort; loses institutional knowledge |
| PRs with vague descriptions like "fixes stuff" | Unreviable; no audit trail |
| Closing issues before code is in main | Premature closure; broken workflow |
| Referencing screenshots before committing them | Broken image links; unprofessional |
| Manually closing issues | Issues close automatically when PR merges |
| Providing non-clickable GitHub URLs | Poor UX; harder to navigate |
| Weak anchor text in links | Non-descriptive; should explain what the link points to |
| Ending implementation round without GitHub artifact summary | Missing documentation; poor traceability |
| Accepting sandbox network restrictions for GitHub operations | Unnecessary limitation; elevate and execute |

---

## Quick Reference

For command examples, templates, and detailed examples, see [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

---

## Enforcement

These rules are mandatory. Agents MUST:

1. Follow this workflow for all code changes
2. Self-check against anti-patterns before each action
3. Prioritize documentation and traceability
4. Seek user approval at defined checkpoints

**The issue is the contract. The PR is the delivery. Documentation is the proof.**
