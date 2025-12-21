#!/bin/bash

# /followup command for Cursor
# Adds a comment to an existing GitHub issue
# Usage: /followup <issue_number> "Comment body" [screenshot1.png] [screenshot2.png] ...

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

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Parse arguments
ISSUE_NUMBER=""
COMMENT_TEXT=""
SCREENSHOTS=()

# Check if input is coming from stdin (Cursor command)
if [ -t 0 ]; then
    # Interactive mode - get input from arguments
    if [ $# -lt 2 ]; then
        echo -e "${YELLOW}Usage: /followup <issue_number> \"Your feedback comment\" [screenshot1.png] [screenshot2.png] ...${NC}"
        exit 1
    fi
    
    ISSUE_NUMBER="$1"
    COMMENT_TEXT="$2"
    shift 2
    
    # Remaining arguments are screenshots
    SCREENSHOTS=("$@")
else
    # Non-interactive mode - read from stdin
    # First line should be issue number
    ISSUE_NUMBER=$(head -n 1)
    COMMENT_TEXT=$(tail -n +2)
    
    # Check for attached files in current directory
    shopt -s nullglob
    for file in *.png *.jpg *.jpeg *.gif *.webp; do
        if [ -f "$file" ]; then
            SCREENSHOTS+=("$file")
        fi
    done
    shopt -u nullglob
fi

# Validate issue number
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error: Invalid issue number: ${ISSUE_NUMBER}${NC}"
    exit 1
fi

# Verify issue exists
if ! gh issue view "$ISSUE_NUMBER" &> /dev/null; then
    echo -e "${RED}Error: Issue #${ISSUE_NUMBER} not found${NC}"
    exit 1
fi

echo -e "${GREEN}Adding comment to issue #${ISSUE_NUMBER}...${NC}"

# Get the branch associated with this issue (if any)
# Try to find branch name from issue body or comments
ISSUE_BRANCH=$(gh issue view "$ISSUE_NUMBER" --json body -q '.body' | \
    grep -oP 'Branch[:\s]*`\K[^`]+' | head -n 1)

# If no branch found in issue, use current branch
if [ -z "$ISSUE_BRANCH" ]; then
    ISSUE_BRANCH="$CURRENT_BRANCH"
fi

# Create .issue_screenshots directory if it doesn't exist (per AGENTS.md)
ASSETS_DIR=".issue_screenshots"
mkdir -p "$ASSETS_DIR"

# Process screenshots
IMAGE_MARKDOWN=""
if [ ${#SCREENSHOTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Processing ${#SCREENSHOTS[@]} screenshot(s)...${NC}"
    
    # Make sure we're on the right branch
    if git rev-parse --verify "origin/${ISSUE_BRANCH}" &> /dev/null; then
        git checkout "$ISSUE_BRANCH" 2>/dev/null || true
    fi
    
    for screenshot in "${SCREENSHOTS[@]}"; do
        if [ ! -f "$screenshot" ]; then
            echo -e "${YELLOW}Warning: Screenshot not found: $screenshot${NC}"
            continue
        fi
        
        # Generate filename per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
        FILENAME=$(basename "$screenshot")
        EXTENSION="${FILENAME##*.}"
        DATE_PREFIX=$(date +%Y%m%d)

        # Extract branch slug for filename
        BRANCH_SLUG=$(echo "$ISSUE_BRANCH" | sed 's|.*/||' | \
            tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9]/-/g' | \
            sed 's/--*/-/g' | \
            cut -c1-30)

        # Extract short descriptive name (remove extension, clean up, limit length)
        DESCRIPTIVE_NAME=$(echo "$FILENAME" | sed "s/\.[^.]*$//" | \
            tr '[:upper:]' '[:lower:]' | \
            sed 's/[^a-z0-9]/-/g' | \
            sed 's/--*/-/g' | \
            sed 's/^-\|-$//g' | \
            cut -c1-30)

        # Per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.ext
        UNIQUE_NAME="${DATE_PREFIX}_${ISSUE_NUMBER}_${BRANCH_SLUG}_${DESCRIPTIVE_NAME}.${EXTENSION}"
        DEST_PATH="${ASSETS_DIR}/${UNIQUE_NAME}"
        
        # Copy screenshot to assets directory
        cp "$screenshot" "$DEST_PATH"
        
        # Add to git
        git add "$DEST_PATH"
        
        # Generate GitHub raw URL
        IMAGE_URL="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${ISSUE_BRANCH}/${DEST_PATH}"
        IMAGE_MARKDOWN="${IMAGE_MARKDOWN}\n\n![Screenshot](${IMAGE_URL})"
        
        echo -e "${GREEN}  Added: $screenshot -> $DEST_PATH${NC}"
    done
    
    # Commit screenshots if any were added (per AGENTS.md commit format: #N: description)
    if git diff --cached --quiet; then
        echo -e "${YELLOW}No changes to commit${NC}"
    else
        echo -e "${YELLOW}Committing screenshots...${NC}"
        git commit -m "#${ISSUE_NUMBER}: Add follow-up screenshot evidence" || true

        # Push to remote
        echo -e "${YELLOW}Pushing screenshots...${NC}"
        git push origin "$ISSUE_BRANCH" 2>/dev/null || true
    fi
fi

# Build comment body with screenshots
FULL_COMMENT="${COMMENT_TEXT}${IMAGE_MARKDOWN}"

# Add comment to issue
echo -e "${YELLOW}Adding comment to issue...${NC}"
COMMENT_URL=$(gh issue comment "$ISSUE_NUMBER" --body "$FULL_COMMENT" --json url -q '.url')

# Output results
echo -e "${GREEN}✓ Comment added successfully!${NC}"
echo -e "${GREEN}  Comment URL: ${COMMENT_URL}${NC}"
echo -e "${GREEN}  Issue #${ISSUE_NUMBER}: https://github.com/${REPO_FULL}/issues/${ISSUE_NUMBER}${NC}"

exit 0
