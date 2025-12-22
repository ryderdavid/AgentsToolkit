# AGENTS.local.md — AgentsToolkit Project Rules

Project-specific rules extending the base [AGENTS.md](AGENTS.md).

---

## Word Budget Enforcement

**When modifying `AGENTS.md`, you MUST update the word budget progress bar in `README.md`.**

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

---

## Project Structure

This is a global toolkit for enforcing issue-first workflows across AI agents.

**Tech Stack:** Bash scripts, Markdown documentation

**Key Files:**
- `AGENTS.md` — Base workflow rules (symlinked to repos)
- `docs/AGENTS_REFERENCE.md` — Command examples, templates
- `scripts/*.py` — Workflow automation scripts
- `templates/` — Templates for repo initialization

---

## Testing

Run tests before PRing changes to scripts:

```bash
./tests/test_functions.py
```

