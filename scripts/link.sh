#!/bin/bash

# /link command for Cursor
# Manually link an existing PR to an issue
# Usage: /link <pr_number> <issue_number>

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

# Get repository info
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)
REPO_FULL="${REPO_OWNER}/${REPO_NAME}"

# Parse arguments
if [ $# -ne 2 ]; then
    echo -e "${YELLOW}Usage: /link <pr_number> <issue_number>${NC}"
    echo -e "${YELLOW}Example: /link 123 456${NC}"
    exit 1
fi

PR_NUMBER="$1"
ISSUE_NUMBER="$2"

# Validate PR number
if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid PR number: $PR_NUMBER${NC}"
    exit 1
fi

# Validate issue number
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid issue number: $ISSUE_NUMBER${NC}"
    exit 1
fi

echo -e "${BLUE}Linking PR #$PR_NUMBER to issue #$ISSUE_NUMBER${NC}"
echo -e "${BLUE}Repository: ${REPO_FULL}${NC}"

# Verify PR exists and get current body
echo -e "${YELLOW}Fetching PR details...${NC}"
PR_EXISTS=$(gh pr view "$PR_NUMBER" --json number,title -q .number 2>/dev/null || echo "")
if [ -z "$PR_EXISTS" ]; then
    echo -e "${RED}Error: PR #$PR_NUMBER not found${NC}"
    exit 1
fi

PR_TITLE=$(gh pr view "$PR_NUMBER" --json title -q .title)
echo -e "${GREEN}✓ Found PR: $PR_TITLE${NC}"

# Verify issue exists
echo -e "${YELLOW}Verifying issue...${NC}"
ISSUE_EXISTS=$(gh issue view "$ISSUE_NUMBER" --json number,title -q .number 2>/dev/null || echo "")
if [ -z "$ISSUE_EXISTS" ]; then
    echo -e "${RED}Error: Issue #$ISSUE_NUMBER not found${NC}"
    exit 1
fi

ISSUE_TITLE=$(gh issue view "$ISSUE_NUMBER" --json title -q .title)
echo -e "${GREEN}✓ Found issue: $ISSUE_TITLE${NC}"

# Get current PR body
CURRENT_BODY=$(gh pr view "$PR_NUMBER" --json body -q .body)

# Check if already linked
if echo "$CURRENT_BODY" | grep -q "Fixes #$ISSUE_NUMBER\|Closes #$ISSUE_NUMBER\|Resolves #$ISSUE_NUMBER"; then
    echo -e "${YELLOW}PR #$PR_NUMBER is already linked to issue #$ISSUE_NUMBER${NC}"
    echo -e "${GREEN}No changes needed${NC}"
    exit 0
fi

# Check if linked to a different issue
if echo "$CURRENT_BODY" | grep -q "Fixes #[0-9]\+\|Closes #[0-9]\+\|Resolves #[0-9]\+"; then
    echo -e "${YELLOW}⚠️  PR #$PR_NUMBER is already linked to a different issue${NC}"
    echo -e "${YELLOW}Current body contains linking syntax for another issue${NC}"
    read -p "Overwrite existing link? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Link cancelled${NC}"
        exit 0
    fi
fi

# Prepare new PR body (per AGENTS.md uses "Closes #N")
NEW_BODY="Closes #$ISSUE_NUMBER

$CURRENT_BODY"

# Update the PR
echo -e "${YELLOW}Updating PR body...${NC}"
gh pr edit "$PR_NUMBER" --body "$NEW_BODY" > /dev/null

# Verify the update
UPDATED_BODY=$(gh pr view "$PR_NUMBER" --json body -q .body)
if echo "$UPDATED_BODY" | grep -q "Closes #$ISSUE_NUMBER"; then
    echo -e "${GREEN}✓ Successfully linked PR #$PR_NUMBER to issue #$ISSUE_NUMBER${NC}"
    echo -e "${GREEN}✓ PR will now appear in issue's Development section${NC}"

    PR_URL="https://github.com/${REPO_FULL}/pull/${PR_NUMBER}"
    ISSUE_URL="https://github.com/${REPO_FULL}/issues/${ISSUE_NUMBER}"

    echo -e "${GREEN}  PR: $PR_URL${NC}"
    echo -e "${GREEN}  Issue: $ISSUE_URL${NC}"
else
    echo -e "${RED}Error: Failed to update PR body${NC}"
    exit 1
fi

exit 0


