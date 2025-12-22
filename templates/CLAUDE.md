# CLAUDE.md — Claude Code Workflow Rules

## ⛔ STOP — READ BEFORE ANY ACTION

**YOU MUST follow these rules for ALL code changes:**

1. **NEVER write code without a GitHub issue first.** Create the issue, get user approval, THEN implement.
2. **NEVER commit to main/master.** Create a feature branch: `{type}/{issue-num}-{desc}`
3. **ALWAYS create a draft PR immediately** after creating the branch and linking it to the issue.
4. **ALWAYS end implementation rounds** with clickable links to all GitHub artifacts created.

**If the user asks you to write code or make changes:**
- STOP and ask: "Should I create a GitHub issue first, or is there an existing issue for this work?"
- Verify you are NOT on main/master before making any file changes
- Create feature branch before any edits

---

## Quick Reference

| Action | Command |
|--------|---------|
| Create issue | `gh issue create --title "..." --body "..."` |
| Create branch | `git checkout -b {type}/{issue-num}-{desc}` |
| Create draft PR | `gh pr create --draft --title "[WIP] #{num}: {desc}" --body "Closes #{num}"` |
| Check branch | `git branch --show-current` |

**Branch types:** `fix/`, `feat/`, `refactor/`, `docs/`, `chore/`

---

## Full Workflow Details

For complete workflow rules, see **AGENTS.md** in this repository. Key sections:

- **Prime Directives** — Non-negotiable rules
- **Issue-First Development** — Issue template and approval process
- **Branch Management** — Naming conventions and rules
- **Pull Request Protocol** — PR requirements
- **GitHub Output Requirements** — Clickable links and end-of-round summaries

---

## Why This Matters

This workflow ensures:
- ✅ All work is traceable to issues
- ✅ Code review happens via PRs
- ✅ No direct commits to main/master
- ✅ Clear documentation trail

**The issue is the contract. The PR is the delivery. Documentation is the proof.**

