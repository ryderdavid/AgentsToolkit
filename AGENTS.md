# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

Non-negotiable rules for all AI agents. Violations constitute workflow failures.

**Scope:** Workflow standards - issue-first development, Git conventions, documentation.  
**Extensibility:** Create `AGENTS.local.md` for project-specific guidance. See `templates/AGENTS.local.md.example`.  
**Precedence:** `AGENTS.local.md` overrides this file.  
**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

---

## 🚨 Critical Response Rule

**EVERY response that includes implementation work MUST end with GitHub artifact links:**

1. **Use markdown links** (NOT bare URLs)
2. **Use descriptive anchor text** (NOT "here" or bare URLs)
3. **Include complete artifact inventory** (issue, PR, branch, commits)

### ✅ CORRECT Format
```markdown
### 🔗 GitHub Artifacts
- **Issue:** [#42: Add dark mode support](https://github.com/owner/repo/issues/42)
- **PR:** [#43: Implement dark mode](https://github.com/owner/repo/pull/43)
- **Branch:** [`feat/42-dark-mode`](https://github.com/owner/repo/tree/feat/42-dark-mode)
- **Commits:**
  - [a1b2c3d: Add theme toggle component](https://github.com/owner/repo/commit/a1b2c3d)
  - [e4f5g6h: Update CSS variables for dark mode](https://github.com/owner/repo/commit/e4f5g6h)
```

### ❌ WRONG Formats
```markdown
❌ See PR 43                                    (no link)
❌ https://github.com/owner/repo/pull/43        (bare URL)
❌ Check it out [here](url)                     (weak anchor text)
❌ [PR](url)                                    (non-descriptive)
```

**⛔ Missing artifact links = BLOCKER violation**

---

## Prime Directives

1. **NEVER begin implementation without a structured, scoped GitHub issue.** The issue is the contract.
2. **NEVER write code before the issue scope is explicitly approved by the user.**
3. **NEVER make file changes while on main/master.** Create a feature branch first.
4. **ALWAYS verify you're on a feature branch before making file changes.**
5. **ALWAYS document work in GitHub issues and PRs—not just chat.**
6. **ALWAYS provide clickable markdown hyperlinks for GitHub resources.**
7. **ALWAYS end implementation rounds with clickable links to all artifacts** (issues, PRs, commits, branches).

---

## Issue-First Development

1. **STOP.** Do not write code.
2. **Clarify** the request. Ask questions if scope is ambiguous.
3. **Draft issue** with Summary, Context, Acceptance Criteria, Out of Scope (see [Issue Template](docs/AGENTS_REFERENCE.md#issue-template)).
4. **Get explicit approval** before proceeding.

Use `gh issue create`. Reference screenshots using raw GitHub URLs after committing them.

---

## Branch Management

**Create feature branch BEFORE any file changes.** Check with `git branch --show-current`.

**Naming:** `{type}/{issue-num}-{short-description}`  
Types: `fix/`, `feat/`, `refactor/`, `docs/`, `chore/`  
If issue pending: `{type}/pending-{desc}`, rename after issue creation.

**Rules:** One branch per issue. Never commit to main/master.

---

## Screenshot Handling

**Directory:** `.issue_screenshots/` (committed)  
**Naming:** `YYYYMMDD_{issue-num}_{branch}_{desc}.{ext}`

Commit and push screenshots before referencing in issues.

---

## Pull Request Protocol

Create draft PR immediately: `gh pr create --draft --title "[WIP] #{num}: {desc}" --body "Closes #{num}"`

Before marking ready: all acceptance criteria checked, journey documented, commits squashed if noisy.

See [PR Template](docs/AGENTS_REFERENCE.md#pr-template).

---

## Commit Standards

**Format:** `#{issue-num}: {imperative description}`  
**Requirements:** Atomic, compilable, meaningful (what/why not how).

---

## Scope Management

| Situation | Action |
|-----------|--------|
| **Scope creep detected** | STOP, assess, propose split or backlog issue |
| **Close to done** | Complete, merge, open follow-up |
| **Not close** | Create backlog issue, don't implement here |
| **Would break main** | Continue but document expanded scope |

**Three-Iteration Rule:** After 3 feedback rounds, reassess scope with user.

---

## Feedback Discipline

Document each feedback round in issue comments: what was wrong, what changed, insights gained.  
Document failed approaches before trying alternatives.

---

## GitHub Output

ALL URLs as markdown links: `[#42: Fix upload](link)` not bare URLs.  
End-of-round summaries must include clickable links to all artifacts with descriptive anchor text.

### End-of-Round Response Template (MANDATORY)

**Use this template after every implementation round:**

```markdown
## ✅ Summary

[Brief description of what was accomplished]

### 🔗 GitHub Artifacts
- **Issue:** [#N: Title](https://github.com/owner/repo/issues/N)
- **PR:** [#N: Title](https://github.com/owner/repo/pull/N)
- **Branch:** [`branch-name`](https://github.com/owner/repo/tree/branch-name)
- **Commits:**
  - [hash: Description](https://github.com/owner/repo/commit/hash)
  - [hash: Description](https://github.com/owner/repo/commit/hash)

### 📋 Next Steps
[What comes next, if applicable]
```

### Pre-Response Checklist

**Before responding to user after implementation, verify:**

- [ ] All changes committed with proper `#{issue-num}: description` format?
- [ ] All changes pushed to remote?
- [ ] Issue link ready in markdown format `[#N: Title](url)`?
- [ ] PR link ready in markdown format `[#N: Title](url)`?
- [ ] Branch link ready in markdown format `` [`name`](url) ``?
- [ ] All commit links collected with descriptions?
- [ ] Response uses End-of-Round template format?

⚠️ **If ANY checkbox is NO, complete it before responding to user.**

---

## Safety & Execution

| Tier | Commands | Action |
|------|----------|--------|
| **1** | `gh issue/pr create/edit/comment/view/list`, `git add/commit/push/checkout/branch/status` | Execute |
| **2** | `gh issue/pr close` | Confirm first |
| **3** | `delete`, `merge`, `--force`, `reset --hard` | Only on explicit request |

**For Tier 1 operations:** Run `gh`/`git` commands with elevation outside sandbox. Don't claim sandbox limitations for pre-approved safe operations—elevate and execute. See [README](README.md#safety-guarantees) for rationale.

**Before changes:** Issue exists? On feature branch? Branch name correct? Tier identified?

---

## Anti-Patterns (Prohibited Behaviors)

| Anti-Pattern | Why Prohibited | Severity |
|--------------|----------------|----------|
| Coding before issue approval | Violates issue-first; scope ambiguity | ⛔ BLOCKER |
| File changes on main/master | Bypasses PR review; breaks workflow | ⛔ BLOCKER |
| Branches off branches | Complicates history; one branch per issue | 🔴 HIGH |
| Expanding scope silently | Leads to bloated PRs; scope creep | 🔴 HIGH |
| Undocumented failed approaches | Wastes future effort; loses knowledge | 🟡 MEDIUM |
| Vague PR descriptions | Unreviewable; no audit trail | 🔴 HIGH |
| Closing issues before merge | Premature closure; broken workflow | 🔴 HIGH |
| Screenshots before commit | Broken image links | 🟡 MEDIUM |
| Manually closing issues | Issues close automatically on PR merge | 🟡 MEDIUM |
| **Non-clickable GitHub URLs** | **Poor UX; harder to navigate** | **⛔ BLOCKER** |
| **Weak anchor text in links** | **Non-descriptive; use meaningful text** | **⛔ BLOCKER** |
| **Missing end-of-round artifact links** | **No audit trail; violates documentation standard** | **⛔ BLOCKER** |
| Accepting sandbox limits for Tier 1 ops | Pre-approved safe operations should elevate and execute | 🟡 MEDIUM |

---

## Enforcement

Follow this workflow. Self-check against anti-patterns. Prioritize documentation. Seek approval at checkpoints.

**The issue is the contract. The PR is the delivery. Documentation is the proof.**
