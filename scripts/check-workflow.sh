#!/bin/bash

# Pre-flight workflow check before making file changes
# Ensures you're on a feature branch, not main/master

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: Not in a git repository${NC}"
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
    echo -e "${RED}❌ ERROR: You are on ${CURRENT_BRANCH}${NC}"
    echo -e "${RED}❌ Do not make changes directly to main/master${NC}"
    echo ""
    echo -e "${YELLOW}Per AGENTS.md, create a feature branch first:${NC}"
    echo "  git checkout -b {type}/{issue-num}-{description}"
    echo ""
    echo -e "${YELLOW}Example:${NC}"
    echo "  git checkout -b feat/42-add-user-export"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ On feature branch: ${CURRENT_BRANCH}${NC}"
echo -e "${GREEN}✅ Safe to make file changes${NC}"
exit 0

