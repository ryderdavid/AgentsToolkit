Commit and push current changes to the PR branch.

**Workflow:**
1. Check current branch (must not be main/master)
2. Detect issue number from branch name or git config
3. Stage all changes
4. Commit with AGENTS.md format: `#{issue-num}: {message}`
5. Push to remote branch
6. Show PR link if available

**Usage:**
```bash
# With commit message
python3 .agents/commands/push.py "your commit message"

# Interactive (will prompt for message)
python3 .agents/commands/push.py
```

**What it does:**
- ✅ Validates you're on a feature branch (not main/master)
- ✅ Auto-detects issue number from branch name (e.g., `feat/123-description` → #123)
- ✅ Formats commit message per AGENTS.md: `#{issue-num}: {message}`
- ✅ Stages all changes
- ✅ Commits and pushes to origin
- ✅ Shows PR link if PR exists

**Safety:**
- ❌ Blocks pushing to main/master
- ❌ No force push (safety)
- ⚠️ Warns if no issue number detected

**Example:**
Branch: `feat/37-add-push-command`
Message: "Add push.py script"
→ Commits: `#37: Add push.py script`
→ Pushes to `origin/feat/37-add-push-command`

See AGENTS.md Commit Standards section for format requirements.

