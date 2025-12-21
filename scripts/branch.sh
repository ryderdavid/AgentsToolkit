#!/bin/bash

# /branch command - Smart branch creation with chat context
# Usage:
#   /branch [category] "description"
#   /branch "description"
#   /branch  (uses chat context)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Check if gh CLI is installed and authenticated (for issue detection)
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}Warning: GitHub CLI (gh) not installed - issue detection disabled${NC}"
    GH_AVAILABLE=false
else
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}Warning: Not authenticated with GitHub - issue detection disabled${NC}"
        GH_AVAILABLE=false
    else
        GH_AVAILABLE=true
    fi
fi

# Get repository info (for issue verification)
if [ "$GH_AVAILABLE" = true ]; then
    REPO_OWNER=$(gh repo view --json owner -q .owner.login 2>/dev/null || echo "")
    REPO_NAME=$(gh repo view --json name -q .name 2>/dev/null || echo "")
fi

# Get current branch (where we'll create the new branch from)
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    echo -e "${RED}Error: No current branch found${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Current branch: ${CURRENT_BRANCH}${NC}"

# Function to analyze chat context from stdin
analyze_chat_context() {
    local chat_content=""

    # Try to read from stdin (Cursor AI provides recent messages)
    if [ -t 0 ]; then
        # No stdin input, check for environment variable
        if [ -n "$CHAT_CONTEXT" ]; then
            chat_content="$CHAT_CONTEXT"
        fi
    else
        # Read from stdin
        chat_content=$(cat)
    fi

    # Extract meaningful information from chat
    local topic=""
    local category=""
    local issue_num=""

    if [ -n "$chat_content" ]; then
        echo -e "${PURPLE}🧠 Analyzing recent conversation...${NC}"

        # Look for keywords indicating category
        if echo "$chat_content" | grep -qi "fix\|bug\|error\|broken\|issue.*with"; then
            category="fix"
        elif echo "$chat_content" | grep -qi "add\|new\|implement\|create\|feature"; then
            category="feature"
        elif echo "$chat_content" | grep -qi "refactor\|cleanup\|optimize\|restructure"; then
            category="refactor"
        elif echo "$chat_content" | grep -qi "update\|upgrade\|bump\|deps\|dependency"; then
            category="chore"
        elif echo "$chat_content" | grep -qi "test\|spec\|testing"; then
            category="test"
        elif echo "$chat_content" | grep -qi "docs\|documentation\|readme"; then
            category="docs"
        fi

        # Extract topic (look for common patterns)
        # Look for quoted strings, or common tech terms
        if echo "$chat_content" | grep -o '"[^"]*"' | head -1; then
            topic=$(echo "$chat_content" | grep -o '"[^"]*"' | head -1 | tr -d '"')
        elif echo "$chat_content" | grep -o "'[^']*'" | head -1; then
            topic=$(echo "$chat_content" | grep -o "'[^']*'" | head -1 | tr -d "'")
        else
            # Look for common tech patterns: auth, login, validation, api, etc.
            for term in "auth" "login" "validation" "api" "user" "database" "config" "error" "bug" "performance"; do
                if echo "$chat_content" | grep -qi "$term"; then
                    topic="$term"
                    break
                fi
            done
        fi

        # Detect issue numbers
        if [ "$GH_AVAILABLE" = true ]; then
            issue_num=$(detect_issue_from_chat "$chat_content")
        fi

        echo -e "${BLUE}📋 Topic: ${topic:-'general work'}${NC}"
        if [ -n "$category" ]; then
            echo -e "${BLUE}📋 Detected category: ${category}${NC}"
        fi
        if [ -n "$issue_num" ]; then
            echo -e "${BLUE}🔗 Found issue: #${issue_num}${NC}"
        fi
    fi

    # Return values (this is bash, so we'll use global variables)
    CHAT_TOPIC="$topic"
    CHAT_CATEGORY="$category"
    CHAT_ISSUE="$issue_num"
}

# Function to detect issue number from chat context
detect_issue_from_chat() {
    local chat_context="$1"
    local issue_num=""

    # Search for issue patterns
    # Look for: "issue #42", "for #42", "fixes #42", "#42", "issue 42"
    issue_num=$(echo "$chat_context" | \
        grep -oP '(?:issue|fixes|closes|resolves)\s*#?\K\d+' | \
        head -1)

    # Also check for standalone #42 pattern
    if [ -z "$issue_num" ]; then
        issue_num=$(echo "$chat_context" | \
            grep -oP '(?:^|\s)#\K\d+(?=\s|$)' | \
            head -1)
    fi

    # Verify issue exists on GitHub
    if [ -n "$issue_num" ] && [ "$GH_AVAILABLE" = true ]; then
        if gh issue view "$issue_num" &>/dev/null; then
            echo "$issue_num"
            return 0
        else
            echo -e "${YELLOW}Warning: Issue #$issue_num not found, ignoring${NC}" >&2
            return 1
        fi
    fi

    [ -n "$issue_num" ] && echo "$issue_num"
}

# Function to detect category from description
detect_category() {
    local description="$1"
    local chat_category="$2"

    # First priority: explicit category from chat context
    if [ -n "$chat_category" ]; then
        echo "$chat_category"
        return 0
    fi

    # Second priority: detect from description keywords
    # Order matters: check specific patterns before general ones
    local desc_lower=$(echo "$description" | tr '[:upper:]' '[:lower:]')

    if echo "$desc_lower" | grep -q "fix\|bug\|error\|broken\|issue"; then
        echo "fix"
    elif echo "$desc_lower" | grep -q "test\|spec\|testing"; then
        echo "test"
    elif echo "$desc_lower" | grep -q "docs\|documentation"; then
        echo "docs"
    elif echo "$desc_lower" | grep -q "add\|new\|implement\|create"; then
        echo "feature"
    elif echo "$desc_lower" | grep -q "refactor\|cleanup\|optimize"; then
        echo "refactor"
    elif echo "$desc_lower" | grep -q "update\|upgrade\|bump\|deps"; then
        echo "chore"
    else
        # Default to feature for new work
        echo "feature"
    fi
}

# Function to generate branch name per AGENTS.md
# Format: {type}/{issue-num}-{description} or {type}/pending-{description}
generate_branch_name() {
    local category="$1"
    local description="$2"
    local issue_num="$3"

    # Sanitize description for branch name
    local sanitized=$(echo "$description" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g' | \
        sed 's/^-\|-$//g' | \
        cut -c1-50)  # Limit length

    # Per AGENTS.md: use issue number if known, otherwise "pending"
    if [ -n "$issue_num" ]; then
        echo "${category}/${issue_num}-${sanitized}"
    else
        echo "${category}/pending-${sanitized}"
    fi
}

# Function to check if branch exists and create unique name
ensure_unique_branch_name() {
    local base_name="$1"
    local final_name="$base_name"
    local counter=1

    while git show-ref --verify --quiet "refs/heads/$final_name"; do
        final_name="${base_name}-${counter}"
        counter=$((counter + 1))
        if [ $counter -gt 10 ]; then
            echo -e "${RED}Error: Too many similar branches exist${NC}" >&2
            exit 1
        fi
    done

    echo "$final_name"
}

# Parse arguments
CATEGORY=""
DESCRIPTION=""
CHAT_TOPIC=""
CHAT_CATEGORY=""
CHAT_ISSUE=""

# Analyze chat context first (may be needed for empty args)
analyze_chat_context

if [ $# -eq 0 ]; then
    # No arguments - use chat context or prompt
    if [ -n "$CHAT_TOPIC" ]; then
        DESCRIPTION="$CHAT_TOPIC"
        if [ -z "$CHAT_CATEGORY" ]; then
            CHAT_CATEGORY=$(detect_category "$DESCRIPTION" "")
        fi
        CATEGORY="$CHAT_CATEGORY"
        echo -e "${PURPLE}🧠 Using topic from chat: '$DESCRIPTION'${NC}"
    else
        echo -e "${YELLOW}No description provided and no clear topic in chat${NC}"
        read -p "Enter branch description: " DESCRIPTION
        if [ -z "$DESCRIPTION" ]; then
            echo -e "${RED}Error: No description provided${NC}"
            exit 1
        fi
    fi
elif [ $# -eq 1 ]; then
    # One argument - could be category or description
    if [[ "$1" =~ ^(feature|fix|refactor|chore|test|docs)$ ]]; then
        # It's a category, ask for description
        CATEGORY="$1"
        echo -e "${BLUE}📋 Category: $CATEGORY${NC}"
        read -p "Enter branch description: " DESCRIPTION
        if [ -z "$DESCRIPTION" ]; then
            echo -e "${RED}Error: No description provided${NC}"
            exit 1
        fi
    else
        # It's a description, detect category
        DESCRIPTION="$1"
        CATEGORY=$(detect_category "$DESCRIPTION" "$CHAT_CATEGORY")
    fi
elif [ $# -eq 2 ]; then
    # Two arguments - category and description
    CATEGORY="$1"
    DESCRIPTION="$2"

    # Validate category
    if [[ ! "$CATEGORY" =~ ^(feature|fix|refactor|chore|test|docs)$ ]]; then
        echo -e "${YELLOW}Warning: '$CATEGORY' is not a standard category, using as-is${NC}"
    fi
else
    echo -e "${YELLOW}Usage: /branch [category] \"description\"${NC}"
    echo -e "${YELLOW}Or: /branch (uses chat context)${NC}"
    exit 1
fi

# Generate branch name per AGENTS.md
echo -e "${PURPLE}🧠 Analyzing: \"$DESCRIPTION\"${NC}"
echo -e "${BLUE}📋 Detected category: $CATEGORY${NC}"
if [ -n "$CHAT_ISSUE" ]; then
    echo -e "${BLUE}🔗 Using issue: #$CHAT_ISSUE${NC}"
fi

BRANCH_NAME=$(generate_branch_name "$CATEGORY" "$DESCRIPTION" "$CHAT_ISSUE")
FINAL_BRANCH_NAME=$(ensure_unique_branch_name "$BRANCH_NAME")

if [ "$BRANCH_NAME" != "$FINAL_BRANCH_NAME" ]; then
    echo -e "${YELLOW}Branch '$BRANCH_NAME' exists, using '$FINAL_BRANCH_NAME'${NC}"
fi

# Create and switch to branch
echo -e "${GREEN}✓ Creating branch: $FINAL_BRANCH_NAME${NC}"
git checkout -b "$FINAL_BRANCH_NAME" 2>/dev/null || {
    echo -e "${RED}Error: Failed to create branch${NC}"
    exit 1
}

# Store issue link if detected
if [ -n "$CHAT_ISSUE" ]; then
    git config branch.$FINAL_BRANCH_NAME.issue "$CHAT_ISSUE"
    if [ "$GH_AVAILABLE" = true ]; then
        ISSUE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/${CHAT_ISSUE}"
        git config branch.$FINAL_BRANCH_NAME.issueUrl "$ISSUE_URL"
    fi
    echo -e "${GREEN}✓ Linked to issue #$CHAT_ISSUE${NC}"
fi

# Success message
echo -e "${GREEN}✓ Switched to new branch: $FINAL_BRANCH_NAME${NC}"
echo -e "${GREEN}✓ Created from: $CURRENT_BRANCH${NC}"
echo -e "${BLUE}📋 Next: Make your changes → commit → push → /pr${NC}"

exit 0


