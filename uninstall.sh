#!/bin/bash
# Agents Toolkit Uninstaller

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Agents Toolkit Uninstaller${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)

echo -e "${YELLOW}This will remove:${NC}"
echo "  • .agents/commands (symlink)"
echo "  • .cursor/rules/agents-workflow/"
echo "  • .cursor/commands/*.md"
echo "  • .issue_screenshots/ (if empty)"
echo ""
echo -e "${RED}AGENTS.md, CLAUDE.md, .github/ templates will NOT be removed${NC}"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

# Remove Cursor rules
if [ -d "$REPO_ROOT/.cursor/rules/agents-workflow" ]; then
    rm -rf "$REPO_ROOT/.cursor/rules/agents-workflow"
    echo -e "${GREEN}✓ Removed .cursor/rules/agents-workflow/${NC}"
fi

# Remove .agents/commands symlink (if present)
if [ -L "$REPO_ROOT/.agents/commands" ] || [ -e "$REPO_ROOT/.agents/commands" ]; then
    rm -f "$REPO_ROOT/.agents/commands"
    if [ -d "$REPO_ROOT/.agents" ] && [ -z "$(ls -A "$REPO_ROOT/.agents")" ]; then
        rmdir "$REPO_ROOT/.agents"
    fi
    echo -e "${GREEN}✓ Removed .agents/commands${NC}"
fi

# Remove cursor command wrappers
if [ -d "$REPO_ROOT/.cursor/commands" ]; then
    rm -f "$REPO_ROOT/.cursor/commands"/*.md
    echo -e "${GREEN}✓ Removed .cursor/commands/*.md${NC}"

    # Remove commands directory if empty
    if [ -z "$(ls -A "$REPO_ROOT/.cursor/commands")" ]; then
        rmdir "$REPO_ROOT/.cursor/commands"
        echo -e "${GREEN}✓ Removed empty .cursor/commands/${NC}"
    fi
fi

# Remove .issue_screenshots if empty
if [ -d "$REPO_ROOT/.issue_screenshots" ]; then
    if [ -z "$(ls -A "$REPO_ROOT/.issue_screenshots")" ] || [ "$(ls -A "$REPO_ROOT/.issue_screenshots")" = ".gitkeep" ]; then
        rm -rf "$REPO_ROOT/.issue_screenshots"
        echo -e "${GREEN}✓ Removed .issue_screenshots/ (was empty)${NC}"
    else
        echo -e "${YELLOW}⊘ Kept .issue_screenshots/ (contains files)${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Uninstallation complete${NC}"
echo ""
echo -e "${YELLOW}Note: AGENTS.md, CLAUDE.md, and .github/ templates were not removed${NC}"
echo "Remove them manually if needed"
echo ""

exit 0
