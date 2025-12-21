#!/bin/bash

# /issue command for Cursor
# Creates a GitHub issue with optional screenshots and a corresponding branch
# Usage: 
#   /issue "Issue title" "Issue body" [screenshot1.png] [screenshot2.png] ...
#   /issue "Issue title and description" [screenshot1.png] ... (legacy: first line = title, rest = body)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Get current branch (we'll create a new branch from it)
CURRENT_BRANCH=$(git branch --show-current)
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)

# Warn if trying to work on main/master
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo -e "${GREEN}Creating issue with new branch (not on main)${NC}"
fi

# Parse arguments
ISSUE_TITLE=""
ISSUE_BODY=""
SCREENSHOTS=()
BRANCH_NAME=""

# Check if input is coming from stdin (Cursor command)
if [ -t 0 ]; then
    # Interactive mode - get input from arguments
    if [ $# -eq 0 ]; then
        echo -e "${YELLOW}Usage:${NC}"
        echo -e "${YELLOW}  /issue \"Issue title\" \"Issue body\" [screenshot1.png] [screenshot2.png] ...${NC}"
        echo -e "${YELLOW}  /issue \"Issue title and description\" [screenshot1.png] ... (legacy: first line = title, rest = body)${NC}"
        exit 1
    fi
    
    # Check if we have 2+ arguments and the second doesn't look like an image file
    if [ $# -ge 2 ] && [[ ! "$2" =~ \.(png|jpg|jpeg|gif|webp)$ ]]; then
        # New format: explicit title and body
        ISSUE_TITLE="$1"
        ISSUE_BODY="$2"
        shift 2
        SCREENSHOTS=("$@")
    else
        # Legacy format: first argument contains both title and body (first line = title, rest = body)
        ISSUE_CONTENT="$1"
        shift
        SCREENSHOTS=("$@")
        
        # Extract title (first line) and body (rest)
        ISSUE_TITLE=$(echo "$ISSUE_CONTENT" | head -n 1 | sed 's/^# *//' | sed 's/^"//' | sed 's/"$//')
        ISSUE_BODY=$(echo "$ISSUE_CONTENT" | tail -n +2)
        
        # If title is empty, use a default
        if [ -z "$ISSUE_TITLE" ]; then
            ISSUE_TITLE="New Issue"
            ISSUE_BODY="$ISSUE_CONTENT"
        fi
    fi
else
    # Non-interactive mode - read from stdin (Cursor will pipe content)
    # Read the issue content from stdin
    ISSUE_CONTENT=$(cat)
    
    # Check for attached files in current directory (Cursor might place them here)
    # Look for common image extensions
    shopt -s nullglob
    for file in *.png *.jpg *.jpeg *.gif *.webp; do
        if [ -f "$file" ]; then
            SCREENSHOTS+=("$file")
        fi
    done
    shopt -u nullglob
    
    # Extract title (first line) and body (rest) from stdin
    ISSUE_TITLE=$(echo "$ISSUE_CONTENT" | head -n 1 | sed 's/^# *//' | sed 's/^"//' | sed 's/"$//')
    ISSUE_BODY=$(echo "$ISSUE_CONTENT" | tail -n +2)
    
    # If title is empty, use a default
    if [ -z "$ISSUE_TITLE" ]; then
        ISSUE_TITLE="New Issue"
        ISSUE_BODY="$ISSUE_CONTENT"
    fi
fi

# Detect branch type from title keywords (per AGENTS.md)
detect_branch_type() {
    local title="$1"
    local title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')

    if echo "$title_lower" | grep -q "fix\|bug\|error\|broken\|issue"; then
        echo "fix"
    elif echo "$title_lower" | grep -q "refactor\|cleanup\|optimize\|restructure"; then
        echo "refactor"
    elif echo "$title_lower" | grep -q "docs\|documentation\|readme"; then
        echo "docs"
    elif echo "$title_lower" | grep -q "chore\|update\|upgrade\|bump\|deps"; then
        echo "chore"
    else
        echo "feat"
    fi
}

# Generate branch name per AGENTS.md: {type}/pending-{short-description}
BRANCH_TYPE=$(detect_branch_type "$ISSUE_TITLE")
BRANCH_SLUG=$(echo "$ISSUE_TITLE" | \
    tr '[:upper:]' '[:lower:]' | \
    sed 's/[^a-z0-9]/-/g' | \
    sed 's/--*/-/g' | \
    sed 's/^-\|-$//g' | \
    cut -c1-50)

# Use pending- prefix initially (will rename after issue creation)
BRANCH_NAME="${BRANCH_TYPE}/pending-${BRANCH_SLUG}"

echo -e "${GREEN}Creating issue: ${ISSUE_TITLE}${NC}"
echo -e "${GREEN}Branch name: ${BRANCH_NAME}${NC}"

# Create and checkout new branch
echo -e "${YELLOW}Creating branch...${NC}"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

# Create .issue_screenshots directory if it doesn't exist (per AGENTS.md)
ASSETS_DIR=".issue_screenshots"
mkdir -p "$ASSETS_DIR"

# Process screenshots (we'll rename them after issue creation with the issue number)
IMAGE_MARKDOWN=""
SCREENSHOT_PATHS=()
if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Processing ${#SCREENSHOTS[@]} screenshot(s)...${NC}"
    
    DATE_PREFIX=$(date +%Y%m%d)
    
    for screenshot in "${SCREENSHOTS[@]}"; do
        if [ ! -f "$screenshot" ]; then
            echo -e "${YELLOW}Warning: Screenshot not found: $screenshot${NC}"
            continue
        fi
        
        # Generate filename per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
        # Temporary format: YYYYMMDD_pending_{branch-slug}_{description}.{ext}
        FILENAME=$(basename "$screenshot")
        EXTENSION="${FILENAME##*.}"

        # Extract short descriptive name (remove extension, clean up, limit length)
        DESCRIPTIVE_NAME=$(echo "$FILENAME" | sed "s/\.[^.]*$//" | \
            tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9]/-/g' | \
            sed 's/--*/-/g' | \
            sed 's/^-\|-$//g' | \
            cut -c1-30)

        # Temporary name with pending (will be renamed after issue creation)
        # Format: YYYYMMDD_pending_{branch-slug}_{description}.ext
        TEMP_NAME="${DATE_PREFIX}_pending_${BRANCH_SLUG}_${DESCRIPTIVE_NAME}.${EXTENSION}"
        DEST_PATH="${ASSETS_DIR}/${TEMP_NAME}"
        
        # Copy screenshot to assets directory
        cp "$screenshot" "$DEST_PATH"
        SCREENSHOT_PATHS+=("$DEST_PATH")
        
        # Add to git
        git add "$DEST_PATH"
        
        # Generate GitHub raw URL (will be updated after issue creation)
        IMAGE_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH_NAME}/${DEST_PATH}"
        IMAGE_MARKDOWN="${IMAGE_MARKDOWN}\n\n![Screenshot](${IMAGE_URL})"
        
        echo -e "${GREEN}  Added: $screenshot -> $DEST_PATH${NC}"
    done
fi

# Commit screenshots if any were added (commit message will be updated after issue creation)
if [ ${#SCREENSHOTS[@]} -gt 0 ] && ! git diff --cached --quiet; then
    echo -e "${YELLOW}Committing screenshots...${NC}"
    git commit -m "Add screenshot evidence for pending issue" || true
fi

# Push branch to remote
echo -e "${YELLOW}Pushing branch...${NC}"
git push -u origin "$BRANCH_NAME" 2>/dev/null || {
    echo -e "${YELLOW}Note: Branch push will happen after issue creation${NC}"
}

# Build issue body with screenshots
FULL_BODY="${ISSUE_BODY}${IMAGE_MARKDOWN}"

# Add branch reference
if [ -n "$BRANCH_NAME" ]; then
    FULL_BODY="${FULL_BODY}\n\n---\n\n**Branch:** \`${BRANCH_NAME}\`"
fi

# Create GitHub issue
echo -e "${YELLOW}Creating GitHub issue...${NC}"
ISSUE_OUTPUT=$(gh issue create \
    --title "$ISSUE_TITLE" \
    --body "$FULL_BODY" \
    --json number,url,title)

ISSUE_NUMBER=$(echo "$ISSUE_OUTPUT" | jq -r '.number')
ISSUE_URL=$(echo "$ISSUE_OUTPUT" | jq -r '.url')

# Rename branch from pending to include issue number per AGENTS.md
# Format: {type}/{issue-num}-{description}
NEW_BRANCH_NAME="${BRANCH_TYPE}/${ISSUE_NUMBER}-${BRANCH_SLUG}"
echo -e "${YELLOW}Renaming branch to include issue number...${NC}"

# Rename local branch
git branch -m "$NEW_BRANCH_NAME"

# Delete old remote branch and push new one
git push origin --delete "$BRANCH_NAME" 2>/dev/null || true
git push -u origin "$NEW_BRANCH_NAME" 2>/dev/null || true

OLD_BRANCH_NAME="$BRANCH_NAME"
BRANCH_NAME="$NEW_BRANCH_NAME"

echo -e "${GREEN}✓ Branch renamed: ${OLD_BRANCH_NAME} → ${BRANCH_NAME}${NC}"

# Rename screenshot files per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
if [ ${#SCREENSHOT_PATHS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Renaming screenshots with issue number...${NC}"

    DATE_PREFIX=$(date +%Y%m%d)
    NEW_IMAGE_MARKDOWN=""

    for old_path in "${SCREENSHOT_PATHS[@]}"; do
        if [ ! -f "$old_path" ]; then
            continue
        fi

        OLD_FILENAME=$(basename "$old_path")
        EXTENSION="${OLD_FILENAME##*.}"

        # Extract descriptive name from old filename (remove date and pending prefix)
        DESCRIPTIVE_NAME=$(echo "$OLD_FILENAME" | sed "s/^${DATE_PREFIX}_pending_${BRANCH_SLUG}_//" | sed "s/\.[^.]*$//")

        # Create new filename per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.ext
        NEW_FILENAME="${DATE_PREFIX}_${ISSUE_NUMBER}_${BRANCH_TYPE}-${BRANCH_SLUG}_${DESCRIPTIVE_NAME}.${EXTENSION}"
        NEW_PATH="${ASSETS_DIR}/${NEW_FILENAME}"

        # Rename the file
        if [ "$old_path" != "$NEW_PATH" ]; then
            git mv "$old_path" "$NEW_PATH" 2>/dev/null || mv "$old_path" "$NEW_PATH"
            git add "$NEW_PATH"

            # Update the image URL with new branch name
            NEW_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH_NAME}/${NEW_PATH}"
            NEW_IMAGE_MARKDOWN="${NEW_IMAGE_MARKDOWN}\n\n![Screenshot](${NEW_URL})"
        else
            NEW_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH_NAME}/${NEW_PATH}"
            NEW_IMAGE_MARKDOWN="${NEW_IMAGE_MARKDOWN}\n\n![Screenshot](${NEW_URL})"
        fi
    done

    # Commit the rename with proper issue-prefixed message per AGENTS.md
    if ! git diff --cached --quiet; then
        git commit -m "#${ISSUE_NUMBER}: Rename screenshots with issue number" || true
    fi

    # Update issue body with correct image URLs
    if [ -n "$NEW_IMAGE_MARKDOWN" ]; then
        UPDATED_BODY="${ISSUE_BODY}${NEW_IMAGE_MARKDOWN}"
        if [ -n "$BRANCH_NAME" ]; then
            UPDATED_BODY="${UPDATED_BODY}\n\n---\n\n**Branch:** \`${BRANCH_NAME}\`"
        fi
        gh issue edit "$ISSUE_NUMBER" --body "$UPDATED_BODY" > /dev/null 2>&1 || true
    fi
fi

# Push branch (in case it wasn't pushed earlier or after rename)
echo -e "${YELLOW}Ensuring branch is pushed...${NC}"
git push -u origin "$BRANCH_NAME" 2>/dev/null || true

# Store issue-branch association
git config branch.$BRANCH_NAME.issue "$ISSUE_NUMBER"
git config branch.$BRANCH_NAME.issueUrl "$ISSUE_URL"

echo -e "${GREEN}✓ Stored issue-branch association in git config${NC}"
echo -e "${BLUE}📋 Workflow: Make your changes → commit → git push → /pr${NC}"

# Store issue-branch association in git config
git config branch.$BRANCH_NAME.issue "$ISSUE_NUMBER"
git config branch.$BRANCH_NAME.issueUrl "$ISSUE_URL"

echo -e "${GREEN}  Stored issue-branch association in git config${NC}"

# Output results
echo -e "${GREEN}✓ Issue created successfully!${NC}"
echo -e "${GREEN}  Issue #${ISSUE_NUMBER}: ${ISSUE_URL}${NC}"
echo -e "${GREEN}  Branch: ${BRANCH_NAME}${NC}"

# Return to original branch (optional - comment out if you want to stay on new branch)
# git checkout "$CURRENT_BRANCH" 2>/dev/null || true

exit 0
