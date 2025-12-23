# AGENTS.local.md — AgentsToolkit Project Rules

Project-specific rules extending the base [AGENTS.md](AGENTS.md). Precedence: this file wins on conflicts. Keep AGENTS.md focused on universal workflow; add only toolkit-specific context here.

---

## Purpose & Scope
- Capture toolkit architecture, platform expectations, testing, release/tagging, and pitfalls.
- Do **not** restate AGENTS.md workflow steps; link to them when needed.

## Project Overview & Layout
- Global install lives at `~/.agents_toolkit/` (or `%USERPROFILE%\\.agents_toolkit` on Windows) with `bin/` and `scripts/`.
- `agentsdotmd-init` creates in each repo: symlinked `AGENTS.md`, symlinked `.agents/commands/`, copied `AGENTS.local.md`, `CLAUDE.md`, `.cursor/commands/`, `.cursor/rules/agents-workflow/`, optional `.github/` templates, and optional `.vscode/tasks.json`.
- Hierarchy: AGENTS.local.md overrides AGENTS.md. Nested AGENTS.md files in monorepos follow the nearest-file-wins rule.

## Symlink vs Copy Strategy
- **Symlinked (auto-update):** `AGENTS.md`, `.agents/commands/`.
- **Copied (refresh with `agentsdotmd-init --update`):** `CLAUDE.md`, `.cursor/commands/*.md`, `.cursor/rules/agents-workflow/RULE.md`, `.github/` templates.
- **Copied once (never overwritten):** `AGENTS.local.md`.
- Windows fallback chain: symlink → junction (dirs) → hard link (files) → copy; expect warnings when falling back.

## Cross-Platform Notes
- macOS/Linux: `agentsdotmd-init` is a symlink to `agentsdotmd-init.py`; available on PATH after install.
- Windows: enable Developer Mode for symlinks; otherwise the fallback chain applies. Run scripts via `python .agents\\commands\\status.py` (or other commands). Cursor wrappers `/status`, `/issue`, `/branch`, `/pr` call the Python scripts directly.
- Write scripts with `pathlib` and platform-neutral paths; avoid hard-coded separators.

## Testing & Quality Gates
- Run from toolkit root before PRs or releases:
  - `./tests/test_functions.py` (covers branch naming, screenshot naming, commit/PR formats, detection helpers).
- Treat git/gh operations as Tier 1 safe actions unless explicitly destructive (see AGENTS.md). Do not add new destructive behaviors without updating docs.

## Release Workflow (toolkit tags)
- **Nightly:** tag the latest validated `main` commit as `nightly-YYYYMMDD` (annotated), then `git push --tags`.
- **Promote to stable:** choose the last good nightly commit, tag as `vX.Y.Z` (annotated), push tags. Document changes in PR/notes if added. No automation assumed—manual tagging only.
- If tooling changes this flow, update this section and README accordingly.

## Code Style & Docs
- Python 3.8+; prefer stdlib and `pathlib`; keep scripts cross-platform.
- CLI output: concise and actionable; avoid color-only signals.
- Markdown: short headings, descriptive clickable GitHub links, keep AGENTS.md references intact; add repo-specific rules here instead of duplicating AGENTS.md.

## Common Pitfalls
- Do not edit symlinked files in-place; update toolkit source instead.
- Windows without Developer Mode falls back to copies—rerun `agentsdotmd-init --update` after toolkit changes.
- Keep `.issue_screenshots/` committed and branches pushed or issue images will break.
- AGENTS.local.md is not auto-refreshed—manually keep it aligned when workflow changes.

---

## Word Budget Enforcement

**When modifying `AGENTS.md`, you MUST update the word budget progress bar in `README.md`. Only do this when AGENTS.md changes (this file does not count).**

### Steps

1. After editing `AGENTS.md`, run: `wc -w AGENTS.md`
2. Calculate percentage: `(word_count / 1000) * 100`
3. Update the progress bar in README.md appendix:
   - Update the filled/empty blocks (█ and ░) to match percentage
   - Update the `XXX/1000 (XX%)` text
   - Update the "Buffer remaining" line: `1000 - word_count`

### Target Budget

- **Target:** 1,000 words max
- **Recommended:** 300–1,200 words per [agents.md best practices](https://agents.md)
- **Current artifacts counting against budget:** `AGENTS.md` only

### Example

If `wc -w AGENTS.md` returns 750:
```
AGENTS.md Word Budget (target: 1,000 words)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
███████████████████████████░░░  750/1000 (75%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Buffer remaining: 250 words for future additions
```

