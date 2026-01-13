# AGENTS.md Reference Guide

This document provides command examples, templates, and detailed examples referenced in [AGENTS.md](../AGENTS.md). Use this as a quick reference during development.

---

## Table of Contents

1. [Rule Packs System](#rule-packs-system)
2. [Command Cheat Sheet](#command-cheat-sheet)
3. [Issue Template](#issue-template)
4. [PR Template](#pr-template)
5. [GitHub Output Examples](#github-output-examples)
6. [CLI Formatting Guidance](#cli-formatting-guidance)
7. [Anti-Patterns Reference](#anti-patterns-reference)

---

## Rule Packs System

AgentsToolkit v2.0 introduces modular rule packs. Instead of a monolithic AGENTS.md, rules are organized into composable packs.

### Available Packs

| Pack | Description | Dependencies |
|------|-------------|--------------|
| `core` | Universal VCS-agnostic workflow rules | None |
| `github-hygiene` | GitHub-specific standards | `core` |
| `azure-devops` | Azure DevOps-specific standards | `core` |

### Pack Structure

```
rule-packs/
├── core/
│   ├── pack.json
│   ├── prime-directives.md
│   ├── scope-management.md
│   ├── feedback-discipline.md
│   └── safety-execution.md
├── github-hygiene/
│   └── ... (8 files)
└── azure-devops/
    └── ... (6 files)
```

### Character Budget

| Composition | Words | Characters | Copilot Safe? |
|-------------|-------|------------|---------------|
| Core only | ~450 | ~2,800 | ✅ Yes |
| Core + GitHub | ~1,100 | ~7,000 | ⚠️ 87% |
| Core + Azure | ~1,000 | ~6,400 | ⚠️ 80% |

### Customization

To use Azure DevOps instead of GitHub, edit `AGENTS.md` and replace:
```
@rule-packs/github-hygiene/...
```
with:
```
@rule-packs/azure-devops/...
```

See [Rule Packs Guide](rule-packs-guide.md) for detailed documentation.

---

## Command Cheat Sheet

### Create Branch

```bash
git checkout -b fix/42-short-description
```

### Commit and Push Screenshots

```bash
git add .issue_screenshots/
git commit -m "#42: Add screenshot evidence"
git push -u origin fix/42-short-description
```

### Create Issue

```bash
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
```

### Create Draft PR Linked to Issue

```bash
gh pr create --draft \
  --title "[WIP] #42: Fix null reference on upload" \
  --body "Closes #42"
```

### Add Feedback Documentation

```bash
gh issue comment 42 --body "**Feedback:** Error still occurs for files exactly 10MB

**Resolution:** Changed comparison from > to >=

**Understanding:** Boundary condition was not handled"
```

### Document Failed Approach

```bash
gh issue comment 42 --body "❌ **Attempted:** Increase memory allocation

**Why it failed:** Issue is null reference, not memory

**Next approach:** Add null check before size validation"
```

### Mark PR Ready for Review

```bash
gh pr ready
```

### Create Backlog Issue

```bash
gh issue create \
  --title "Optimize large file upload performance" \
  --label "backlog" \
  --body "Related to #42

## Summary
Large file uploads are slow; chunked upload could improve UX.

## Context
Discovered while fixing #42; out of scope for that fix."
```

### Rename Branch After Issue Creation

```bash
git branch -m fix/42-null-reference-upload
git push origin -u fix/42-null-reference-upload
git push origin --delete fix/pending-null-reference
```

---

## Issue Template

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

---

## PR Template

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

## Walkthrough Template

Use this for `docs/walkthroughs/{issue-num}-{issue-slug}_W{N}.md` (e.g., `57-add-walkthrough-command_W1.md`).

**Filename Format:**
- `{issue-num}` = GitHub issue number
- `{issue-slug}` = Issue title converted to URL-friendly format (lowercase, hyphens)
- `{N}` = Sequential number (W1, W2, W3... for that issue)

```markdown
# Walkthrough: #{issue} - W{N}

**Issue:** [#{issue}: Title](link)
**Branch:** `{branch-name}`
**Date:** YYYY-MM-DD

## Summary
[1-2 sentences: what was implemented in this round]

## Files Changed
| File | Change Type | Description |
|------|-------------|-------------|
| `path/to/file` | Created/Modified/Deleted | Brief description |

## Implementation Details
[Key technical decisions, patterns used, rationale]

## How to Verify
1. [Step to test the changes]
2. [Expected result]

## Known Limitations
- [Any caveats or edge cases not handled]

## Next Steps
- [ ] [Remaining work for this issue, if any]

## Commits
- [`abc1234`: Message](commit-link)
```

**Retention:** When an issue is closed, prompt whether to keep or archive/remove the walkthroughs.

---

## GitHub Output Examples

### Good End-of-Round Summary

```markdown
Completed agent-agnostic commands refactor on [feat/2-vscode-claude-setup branch](https://github.com/owner/repo/tree/feat/2-vscode-claude-setup):

- Refactored to [.agents/commands architecture (commit abc123)](https://github.com/owner/repo/commit/abc123)
- Created [8 Cursor markdown wrappers (commit def456)](https://github.com/owner/repo/commit/def456)
- Updated [README with new architecture (commit ghi789)](https://github.com/owner/repo/commit/ghi789)
- Posted [implementation plan to Issue #2](https://github.com/owner/repo/issues/2#issuecomment-123)

View all changes: [Pull Request #5: Add VS Code + Claude Code setup](https://github.com/owner/repo/pull/5)
```

### Bad End-of-Round Summary

```markdown
Completed refactor. See branch and PR.
```

**Why it's bad:** No clickable links, no context, no specific artifacts listed.

### Good Link Format

```markdown
Created issue [#42: Fix null reference on upload](https://github.com/owner/repo/issues/42)
Opened PR [#43: Implement CSV export](https://github.com/owner/repo/pull/43)
```

### Bad Link Formats

```markdown
Created issue https://github.com/owner/repo/issues/42
Created issue #42
Posted [comment](https://github.com/owner/repo/issues/2#issuecomment-123) to issue.
```

**Why they're bad:**
- First two: Not clickable markdown links
- Third: Weak anchor text (should describe what the link points to)

### Good Anchor Text Examples

- ✅ `Posted [implementation plan to Issue #2](link)`
- ✅ `Created [#42: Fix null reference on upload](link)`
- ✅ `View [feat/2-vscode-claude-setup branch](link)`

### Bad Anchor Text Examples

- ❌ `Posted [comment](link)` - Not descriptive
- ❌ `See [PR](link)` - Too vague
- ❌ `Click [here](link)` - Generic

---

## CLI Formatting Guidance

### Multiline Issue/PR Comments

Avoid literal `\n` in `gh issue comment` bodies; GitHub will render them as text.

**Good - Use heredoc:**

```bash
gh issue comment 2 --body "$(cat <<'EOF'
Implementing agent-agnostic commands refactor:
- .agents/commands symlink (agent-agnostic)
- Cursor markdown wrappers in .cursor/commands
EOF
)"
```

**Bad - Literal newlines:**

```bash
gh issue comment 2 --body "Line 1\nLine 2"
```

### Branch Naming Examples

| Type | Example |
|------|---------|
| Bug fix | `fix/42-null-reference-upload` |
| Feature | `feat/57-user-export-csv` |
| Refactor | `refactor/63-auth-module-cleanup` |
| Documentation | `docs/84-api-usage-guide` |
| Maintenance | `chore/91-update-dependencies` |

### Screenshot Naming Pattern

```
YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
```

**Examples:**
- `20250618_42_fix-null-ref_error-dialog.png`
- `20250620_57_feat-export_csv-preview.png`

### Screenshot Reference in Issues

```markdown
![Error dialog](https://raw.githubusercontent.com/{owner}/{repo}/{branch}/.issue_screenshots/{filename})
```

---

## Quick Tips

- **Before making any file changes:** Verify you're on a feature branch with `git branch --show-current`
- **One branch per issue:** All work for an issue stays on its designated branch
- **Atomic commits:** Each commit should represent one logical change
- **Link everything:** Issues link to PRs, PRs link to issues, commits reference issue numbers
- **Document as you go:** Add issue comments for feedback, failed approaches, and learnings

---

## Anti-Patterns Reference

The following behaviors are **explicitly prohibited**. Self-check against this list before each action.

| Anti-Pattern | Why It's Prohibited |
|--------------|---------------------|
| Starting to code before issue is created and confirmed | Violates issue-first principle; leads to scope ambiguity |
| Making file changes while on main/master | Bypasses PR review; breaks workflow; direct commits to main |
| Committing directly to main/master | No PR review; no issue linkage; violates traceable development |
| Creating branches off branches for iterations | Complicates history; one branch per issue |
| Expanding scope silently without user approval | Leads to bloated PRs; scope creep |
| Leaving failed approaches undocumented | Wastes future effort; loses institutional knowledge |
| PRs with vague descriptions like "fixes stuff" | Unreviewable; no audit trail |
| Closing issues before code is in main | Premature closure; broken workflow |
| Referencing screenshots before committing them | Broken image links; unprofessional |
| Manually closing issues | Issues close automatically when PR merges |
| Providing non-clickable GitHub URLs | Poor UX; harder to navigate |
| Weak anchor text in links | Non-descriptive; should explain what the link points to |
| Ending implementation round without GitHub artifact summary | Missing documentation; poor traceability |
| Accepting sandbox network restrictions for GitHub operations | Unnecessary limitation; elevate and execute |
