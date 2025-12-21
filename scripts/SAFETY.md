# Script Safety Audit

All workflow scripts are limited to Tier 1 (safe) operations: create/edit/read actions and standard git commands (no deletion, force, or history rewrite).

## Current Scripts

- `branch.sh`: `git checkout -b`, `git branch -m`, issue detection via `gh issue view`. No deletes or force.
- `issue.sh`: `git add/commit/push`, `gh issue create/edit`, branch rename. No force push, no deletes.
- `pr.sh`: `gh pr create/view`, `gh issue view`, read-only git queries. No merge/close.
- `link.sh`: `gh pr edit`, `gh issue view`. No delete/merge.
- `status.sh`: read-only `gh` and `git`. No mutations.
- `followup.sh`: `git add/commit/push` for screenshots, `gh issue comment/view`. No force or deletes.
- `check-auth.sh`: read-only auth check.
- `check-workflow.sh`: verifies you're on a feature branch before making changes.

## Guardrails for New Scripts

- Use only Tier 1 commands by default.
- If a Tier 2 command (close issue/PR) is added, require explicit user confirmation.
- Never include Tier 3 commands (delete, force-push, merge) unless the user explicitly requests it in the chat context.
- Avoid `git push --force`, `git reset --hard`, `git clean -fd`, branch/PR/issue deletes, or `gh api` DELETE.

