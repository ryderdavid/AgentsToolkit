# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

Non-negotiable rules for all AI agents. Violations constitute workflow failures.

**Scope:** Workflow standards - issue-first development, Git conventions, documentation.  
**Extensibility:** Create `AGENTS.local.md` for project-specific guidance. See `templates/AGENTS.local.md.example`.  
**Precedence:** `AGENTS.local.md` overrides this file.  
**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

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

---

## Safety & Execution

| Tier | Commands | Action |
|------|----------|--------|
| **1** | `gh issue/pr create/edit/comment/view/list`, `git add/commit/push/checkout/branch/status` | Execute |
| **2** | `gh issue/pr close` | Confirm first |
| **3** | `delete`, `merge`, `--force`, `reset --hard` | Only on explicit request |

Run `gh`/`git` commands with elevation. Don't claim sandbox limitations.

**Before changes:** Issue exists? On feature branch? Branch name correct? Tier identified?

---

## Anti-Patterns (Prohibited Behaviors)

| Anti-Pattern | Why Prohibited |
|--------------|----------------|
| Coding before issue approval | Violates issue-first; scope ambiguity |
| File changes on main/master | Bypasses PR review; breaks workflow |
| Branches off branches | Complicates history; one branch per issue |
| Expanding scope silently | Leads to bloated PRs; scope creep |
| Undocumented failed approaches | Wastes future effort; loses knowledge |
| Vague PR descriptions | Unreviewable; no audit trail |
| Closing issues before merge | Premature closure; broken workflow |
| Screenshots before commit | Broken image links |
| Manually closing issues | Issues close automatically on PR merge |
| Non-clickable GitHub URLs | Poor UX; harder to navigate |
| Weak anchor text in links | Non-descriptive; use meaningful text |
| Missing end-of-round summary | Missing documentation; poor traceability |
| Accepting sandbox limitations | Elevate and execute instead |

---

## Enforcement

Follow this workflow. Self-check against anti-patterns. Prioritize documentation. Seek approval at checkpoints.

**The issue is the contract. The PR is the delivery. Documentation is the proof.**
