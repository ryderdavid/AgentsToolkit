Create or update a walkthrough document for the current implementation round.

**Purpose:**
Document what was implemented so far to ensure knowledge transfer, auditability, and alignment with [Walkthrough Documentation](../../rule-packs/github-hygiene/walkthrough-docs.md).

**Location:** `docs/walkthroughs/{issue-num}-{issue-slug}_W{N}.md`
- `{issue-num}` = GitHub issue number (e.g., `57`)
- `{issue-slug}` = Issue title converted to URL-friendly format (lowercase, hyphens, e.g., `add-walkthrough-command`)
- `{N}` = Sequential walkthrough number for that issue (W1, W2, W3…)

**Example:** `docs/walkthroughs/57-add-walkthrough-command_W1.md`

**Walkthrough Template:**
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

**Workflow:**
1. Detect the current issue number from branch name (per AGENTS.md branch rules).
2. Fetch the issue title from GitHub using `gh issue view {issue-num} --json title`.
3. Convert issue title to slug format:
   - Lowercase
   - Replace spaces and special characters with hyphens
   - Remove leading/trailing hyphens
   - Limit to reasonable length (e.g., 50 chars)
4. Ensure `docs/walkthroughs/` exists (create if missing).
5. Count existing walkthroughs for this issue (`{issue-num}-{issue-slug}_W*.md`) to determine the next `{N}` (starting at 1).
6. Create `docs/walkthroughs/{issue-num}-{issue-slug}_W{N}.md` with the template above and populate details for this implementation round.
7. Commit and push the walkthrough alongside the code changes for this round.

**When to Create:**
- After each substantial implementation round (MANDATORY per AGENTS.md).
- When the user invokes `/walkthrough`.
- Before marking a PR ready for review.

**Retention on Issue Close:**
- When the issue is closed, prompt the user whether to keep or archive/remove the walkthroughs for that issue.
