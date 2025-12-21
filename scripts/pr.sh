#!/bin/bash

# /pr command for Cursor
# Smart PR creation with automatic issue detection
# Usage: /pr [issue_number]

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

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    echo -e "${RED}Error: No current branch found${NC}"
    exit 1
fi

# Get default branch (usually main/master)
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")

echo -e "${BLUE}Working on branch: ${CURRENT_BRANCH}${NC}"
echo -e "${BLUE}Repository: ${REPO_FULL}${NC}"

# Parse optional argument (explicit issue number)
EXPLICIT_ISSUE=""
if [ $# -eq 1 ]; then
    if [[ "$1" =~ ^[0-9]+$ ]]; then
        EXPLICIT_ISSUE="$1"
        echo -e "${BLUE}Explicit issue number provided: #${EXPLICIT_ISSUE}${NC}"
    else
        echo -e "${RED}Error: Invalid issue number: $1${NC}"
        exit 1
    fi
fi

# Function to detect issue number from various sources
detect_issue_number() {
    local branch="$1"
    local issue_num=""

    # Method 1: Explicit argument (highest priority)
    if [ -n "$EXPLICIT_ISSUE" ]; then
        issue_num="$EXPLICIT_ISSUE"
        if gh issue view "$issue_num" &>/dev/null; then
            echo "$issue_num"
            return 0
        else
            echo -e "${RED}Error: Explicit issue #$issue_num not found${NC}" >&2
            exit 1
        fi
    fi

    # Method 2: Git config (most reliable)
    issue_num=$(git config branch.$branch.issue 2>/dev/null)
    if [ -n "$issue_num" ]; then
        echo -e "${GREEN}✓ Detected issue #$issue_num from git config${NC}" >&2
        echo "$issue_num"
        return 0
    fi

    # Method 3: Branch name patterns
    # Matches: fix-123-, issue-45-, 67-bug-fix, feature/123-something
    if [[ $branch =~ (^|[-_/])([0-9]+)([-_/]|$) ]]; then
        issue_num="${BASH_REMATCH[2]}"
        # Verify issue exists on GitHub
        if gh issue view "$issue_num" &>/dev/null; then
            echo -e "${GREEN}✓ Detected issue #$issue_num from branch name pattern${NC}" >&2
            echo "$issue_num"
            return 0
        fi
    fi

    # Method 4: Recent commit messages (last 20 commits)
    issue_num=$(git log -20 --pretty=format:"%s %b" | \
        grep -oP '(?:Refs?|Fixes?|Closes?|Resolves?) #\K\d+' | head -1)
    if [ -n "$issue_num" ]; then
        # Verify issue exists
        if gh issue view "$issue_num" &>/dev/null; then
            echo -e "${GREEN}✓ Detected issue #$issue_num from commit messages${NC}" >&2
            echo "$issue_num"
            return 0
        fi
    fi

    # Method 5: Prompt user
    echo -e "${YELLOW}No issue detected automatically${NC}"
    read -p "Enter issue number to link (or press Enter for standalone PR): " user_issue
    if [ -n "$user_issue" ] && [[ "$user_issue" =~ ^[0-9]+$ ]]; then
        if gh issue view "$user_issue" &>/dev/null; then
            echo -e "${GREEN}✓ Using issue #$user_issue${NC}"
            echo "$user_issue"
            return 0
        else
            echo -e "${RED}Error: Issue #$user_issue not found${NC}" >&2
            exit 1
        fi
    fi

    # No issue found - standalone PR
    echo ""
    return 1
}

# Function to detect base branch
detect_base_branch() {
    local current="$1"

    # Common base branch names in priority order
    local candidates=("main" "master" "develop" "development" "dev")

    for candidate in "${candidates[@]}"; do
        if git show-ref --verify --quiet "refs/heads/$candidate" 2>/dev/null; then
            echo "$candidate"
            return 0
        fi
    done

    # Fallback: use default branch from GitHub
    echo "$DEFAULT_BRANCH"
}

# Function to check for existing PRs
check_existing_pr() {
    local branch="$1"
    local base="$2"

    # Check if there's already a PR for this branch
    local existing_pr=$(gh pr list --head "$branch" --base "$base" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -n "$existing_pr" ]; then
        local pr_url="https://github.com/${REPO_FULL}/pull/${existing_pr}"
        echo -e "${YELLOW}PR #$existing_pr already exists for this branch${NC}"
        echo -e "${YELLOW}URL: ${pr_url}${NC}"
        echo -e "${YELLOW}Use '/link $existing_pr <issue_number>' to link it to an issue${NC}"
        exit 0
    fi
}

# Function to check for unpushed commits
check_unpushed_commits() {
    local branch="$1"
    local unpushed=$(git log --branches --not --remotes --oneline | wc -l)

    if [ "$unpushed" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  You have $unpushed unpushed commit(s)${NC}"
        echo -e "${YELLOW}Push them before creating PR: git push${NC}"
        return 1
    fi
    return 0
}

# Function to validate branch readiness
validate_branch_ready() {
    local branch="$1"
    local base="$2"

    echo -e "${YELLOW}Validating branch...${NC}"

    # Check if branch is pushed to remote
    if ! git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
        echo -e "${RED}Error: Branch '$branch' is not pushed to remote${NC}"
        echo -e "${YELLOW}Run: git push -u origin $branch${NC}"
        exit 1
    fi

    # Check if branch has commits ahead of base
    local ahead_count=$(git rev-list --count "$base..$branch" 2>/dev/null || echo "0")
    if [ "$ahead_count" -eq 0 ]; then
        echo -e "${RED}Error: Branch '$branch' has no commits ahead of '$base'${NC}"
        echo -e "${YELLOW}Make some commits first${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Branch has $ahead_count commits ahead of $base${NC}"

    # Check for merge conflicts
    if git merge-tree --no-commit "$base" "$branch" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ No merge conflicts detected${NC}"
    else
        echo -e "${YELLOW}⚠️  Possible merge conflicts detected${NC}"
        echo -e "${YELLOW}Consider rebasing or merging $base first${NC}"
        # Don't exit - let user decide
    fi
}

# Function to generate PR title
generate_pr_title() {
    local issue_num="$1"
    local branch="$2"

    if [ -n "$issue_num" ]; then
        # Get issue title - use it directly without "Fix #" prefix (linking is in body)
        local issue_title=$(gh issue view "$issue_num" --json title -q .title)
        echo "#$issue_num: $issue_title"
    else
        # Use first commit message
        local first_commit=$(git log --oneline -1 --pretty=format:"%s")
        echo "$first_commit"
    fi
}

# Function to generate PR body per AGENTS.md template
generate_pr_body() {
    local issue_num="$1"
    local branch="$2"
    local base="$3"
    local pr_title="$4"

    local body=""

    # Per AGENTS.md PR template structure:
    # - Summary
    # - Changes
    # - How to Test
    # - Known Limitations
    # - Closes #N

    # Add Summary section
    body="## Summary

"
    if [ -n "$issue_num" ]; then
        # Add issue summary if available
        local issue_body=$(gh issue view "$issue_num" --json body -q .body | head -10)
        if [ -n "$issue_body" ] && [ "$issue_body" != "null" ]; then
            body="${body}$issue_body

"
        else
            body="${body}$pr_title

"
        fi
    else
        body="${body}$pr_title

"
    fi

    # Add Changes section
    body="${body}## Changes

"
    # Get commits ahead of base
    local commits=$(git log --oneline "$base..$branch" | sed 's/^/- /')
    if [ -n "$commits" ]; then
        body="${body}$commits

"
    else
        body="${body}- Implementation changes

"
    fi

    # Add How to Test section (per AGENTS.md)
    body="${body}## How to Test

- [ ] Manual testing completed
- [ ] All tests pass
- [ ] Code review approved

"

    # Add Known Limitations section (per AGENTS.md)
    body="${body}## Known Limitations

- None identified

"

    # Add Closes syntax at the end (per AGENTS.md)
    if [ -n "$issue_num" ]; then
        body="${body}Closes #$issue_num
"
    fi

    echo "$body"
}

# Main execution
echo -e "${YELLOW}Detecting base branch...${NC}"
BASE_BRANCH=$(detect_base_branch "$CURRENT_BRANCH")
echo -e "${GREEN}✓ Base branch: $BASE_BRANCH${NC}"

echo -e "${YELLOW}Checking for existing PRs...${NC}"
check_existing_pr "$CURRENT_BRANCH" "$BASE_BRANCH"

echo -e "${YELLOW}Detecting associated issue...${NC}"
ISSUE_NUMBER=$(detect_issue_number "$CURRENT_BRANCH")
if [ $? -eq 0 ] && [ -n "$ISSUE_NUMBER" ]; then
    # Verify issue is open
    issue_state=$(gh issue view "$ISSUE_NUMBER" --json state -q .state)
    if [ "$issue_state" != "OPEN" ]; then
        echo -e "${YELLOW}⚠️  Issue #$ISSUE_NUMBER is $issue_state${NC}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
elif [ -z "$ISSUE_NUMBER" ]; then
    echo -e "${YELLOW}Creating standalone PR (no issue linking)${NC}"
fi

# Validate branch
validate_branch_ready "$CURRENT_BRANCH" "$BASE_BRANCH"

# Generate PR content
echo -e "${YELLOW}Generating PR content...${NC}"
PR_TITLE=$(generate_pr_title "$ISSUE_NUMBER" "$CURRENT_BRANCH")
PR_BODY=$(generate_pr_body "$ISSUE_NUMBER" "$CURRENT_BRANCH" "$BASE_BRANCH" "$PR_TITLE")

echo -e "${GREEN}✓ PR Title: $PR_TITLE${NC}"

# Create the PR
echo -e "${YELLOW}Creating pull request...${NC}"
PR_OUTPUT=$(gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    --base "$BASE_BRANCH" \
    --head "$CURRENT_BRANCH" 2>&1)

# Extract PR number and URL from output
PR_URL=$(echo "$PR_OUTPUT" | grep -o 'https://github.com/[^/]*/[^/]*/pull/[0-9]*' | head -1)
if [ -n "$PR_URL" ]; then
    PR_NUMBER=$(echo "$PR_URL" | sed -E 's|.*/pull/([0-9]+)|\1|')
else
    # Try alternative format
    PR_NUMBER=$(echo "$PR_OUTPUT" | grep -o '#[0-9]*' | sed 's/#//' | head -1)
    if [ -n "$PR_NUMBER" ]; then
        PR_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/pull/${PR_NUMBER}"
    fi
fi

    echo -e "${GREEN}✓ Pull request created successfully!${NC}"
    echo -e "${GREEN}  PR #$PR_NUMBER: $PR_URL${NC}"

    if [ -n "$ISSUE_NUMBER" ]; then
        echo -e "${GREEN}  Linked to issue #$ISSUE_NUMBER${NC}"
        echo -e "${GREEN}  ✅ Issue will auto-close when PR merges${NC}"
    else
        echo -e "${YELLOW}  Standalone PR (not linked to any issue)${NC}"
    fi

    echo -e "${BLUE}📋 Next: Get review → Merge PR → Issue closes automatically${NC}"

    exit 0
