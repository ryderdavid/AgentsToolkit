#!/bin/bash

# /status command - Show current workflow status
# Shows: branch, linked issue, commits, PR status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if gh CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub. Run 'gh auth login'${NC}"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
ISSUE_NUM=$(git config branch.$CURRENT_BRANCH.issue 2>/dev/null)

echo -e "${BLUE}📋 Current Workflow Status${NC}"
echo "─────────────────────────────"
echo -e "${BLUE}Branch:${NC} $CURRENT_BRANCH"

if [ -n "$ISSUE_NUM" ]; then
    echo -e "${BLUE}Linked Issue:${NC} #$ISSUE_NUM"
    ISSUE_STATE=$(gh issue view "$ISSUE_NUM" --json state -q .state 2>/dev/null || echo "unknown")
    echo -e "${BLUE}Issue State:${NC} $ISSUE_STATE"
else
    echo -e "${BLUE}Linked Issue:${NC} None (standalone branch)"
fi

# Check for commits ahead of main
COMMITS_AHEAD=$(git rev-list --count main..$CURRENT_BRANCH 2>/dev/null || echo "0")
echo -e "${BLUE}Commits ahead:${NC} $COMMITS_AHEAD"

# Check if pushed
if git ls-remote --exit-code --heads origin "$CURRENT_BRANCH" >/dev/null 2>&1; then
    echo -e "${BLUE}Pushed:${NC} ✅ Yes"
else
    echo -e "${BLUE}Pushed:${NC} ❌ No - run 'git push'"
fi

# Check for existing PR
PR_NUM=$(gh pr list --head "$CURRENT_BRANCH" --json number -q '.[0].number' 2>/dev/null || echo "")
if [ -n "$PR_NUM" ]; then
    echo -e "${BLUE}PR:${NC} #$PR_NUM"
    echo -e "${GREEN}✅ Ready to merge!${NC}"
else
    if [ "$COMMITS_AHEAD" -gt 0 ]; then
        echo -e "${BLUE}PR:${NC} None - run '/pr' to create"
        echo -e "${BLUE}📋 Next step: /pr${NC}"
    else
        echo -e "${BLUE}PR:${NC} None (no commits yet)"
        echo -e "${BLUE}📋 Next step: Make changes and commit${NC}"
    fi
fi

exit 0


