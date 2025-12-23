Create a GitHub issue with proper branch and screenshot handling per AGENTS.md standards.

**IMPORTANT:** Before running the script, ensure you understand:
- Branch naming: `{type}/{issue-num}-{short-description}` per AGENTS.md
- The script creates `{type}/pending-{desc}` first, then renames after issue creation
- Types: fix/, feat/, refactor/, docs/, chore/

**Workflow:**
1. Ask user for: title, body (markdown), optional screenshot paths
2. Detect branch type from title (or ask user to specify)
3. Run: `python3 .agents/commands/issue.py "title" "body" [screenshot.png]`

**The script automatically:**
- Creates branch: `{type}/pending-{short-desc}` (derived from title)
- Creates GitHub issue
- Renames branch to: `{type}/{issue-num}-{short-desc}` using actual issue number
- Links branch to issue in git config
- Commits and references screenshots if provided

**Example:**
Title: "Fix login button alignment"
→ Creates branch: `fix/pending-fix-login-button`
→ Gets issue #74
→ Renames to: `fix/74-fix-login-button`

See AGENTS.md Branch Management section for full naming standards.

