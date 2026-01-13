Add a follow-up comment to an issue with optional screenshots.

**Issue Comment Format:**
See rule packs for documenting feedback and progress:
- Feedback documentation: [rule-packs/core/feedback-discipline.md](../../rule-packs/core/feedback-discipline.md)
- Comment format examples: [AGENTS_REFERENCE.md](../../docs/AGENTS_REFERENCE.md#add-feedback-documentation)
- Use for: feedback rounds (what was wrong, what changed, insights) and documenting failed approaches

Usage: Ask the user for issue number, comment text, and optional screenshot paths, then run:
`python3 ~/.agentsmd/scripts/followup.py <issue-num> "comment" [screenshot.png]`
