#!/bin/bash
# Agents Toolkit Global Installer
# Installs toolkit to ~/.agents_toolkit and adds bin/ to PATH
# Note: Workflow scripts expect GitHub CLI (`gh`) to be installed and authenticated in your shell (used with elevation outside sandboxes).

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

INSTALL_DIR="$HOME/.agents_toolkit"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Agents Toolkit - Global Installer${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check if already installed
if [ -d "$INSTALL_DIR" ] && [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Toolkit already installed at $INSTALL_DIR${NC}"
    read -p "Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled"
        exit 0
    fi
    rm -rf "$INSTALL_DIR"
fi

# 1. Copy toolkit to ~/.agents_toolkit
echo -e "${YELLOW}[1/3] Installing toolkit to $INSTALL_DIR...${NC}"
if [ "$SCRIPT_DIR" = "$INSTALL_DIR" ]; then
    echo -e "${GREEN}✓ Already installed in correct location${NC}"
else
    mkdir -p "$INSTALL_DIR"
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
    echo -e "${GREEN}✓ Copied toolkit files${NC}"
fi
echo ""

# 2. Make scripts executable
echo -e "${YELLOW}[2/3] Making scripts executable...${NC}"
chmod +x "$INSTALL_DIR"/scripts/*.sh
chmod +x "$INSTALL_DIR"/bin/*
chmod +x "$INSTALL_DIR"/*.sh
echo -e "${GREEN}✓ Scripts are executable${NC}"
echo ""

# 3. Add to PATH
echo -e "${YELLOW}[3/3] Adding $INSTALL_DIR/bin to PATH...${NC}"

# Detect shell config file
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
fi

if [ -z "$SHELL_CONFIG" ]; then
    echo -e "${YELLOW}⚠️  Could not detect shell config file${NC}"
    echo -e "${YELLOW}Manually add to your shell config:${NC}"
    echo -e "${BLUE}export PATH=\"\$HOME/.agents_toolkit/bin:\$PATH\"${NC}"
else
    # Check if already in PATH
    if grep -q ".agents_toolkit/bin" "$SHELL_CONFIG"; then
        echo -e "${GREEN}✓ Already in PATH ($SHELL_CONFIG)${NC}"
    else
        echo "" >> "$SHELL_CONFIG"
        echo "# Agents Toolkit" >> "$SHELL_CONFIG"
        echo "export PATH=\"\$HOME/.agents_toolkit/bin:\$PATH\"" >> "$SHELL_CONFIG"
        echo -e "${GREEN}✓ Added to $SHELL_CONFIG${NC}"
        echo -e "${YELLOW}Run: source $SHELL_CONFIG${NC}"
    fi
fi
echo ""

# Summary
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   Global Installation Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Installed:${NC}"
echo "  ✓ Toolkit at: ~/.agents_toolkit/"
echo "  ✓ Command: agentsdotmd-init (added to PATH)"
echo "  ✓ Scripts: ~/.agents_toolkit/scripts/"
echo "  ✓ Base AGENTS.md: ~/.agents_toolkit/AGENTS.md"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Restart your terminal (or run: source $SHELL_CONFIG)"
echo "  2. cd to any git repository"
echo "  3. Run: agentsdotmd-init"
echo ""
echo -e "${BLUE}Usage:${NC}"
echo "  cd ~/my-project"
echo "  agentsdotmd-init              # Initialize repo with toolkit"
echo "  agentsdotmd-init --subdir backend  # For monorepo subdirectories"
echo ""
echo -e "${YELLOW}What agentsdotmd-init does:${NC}"
echo "  • Symlinks AGENTS.md (global constitution)"
echo "  • Creates AGENTS.local.md (repo-specific overrides)"
echo "  • Symlinks .cursor/commands/ (workflow scripts)"
echo "  • Installs .cursor/rules/ (Cursor enforcement)"
echo "  • Creates .issue_screenshots/ directory"
echo ""

exit 0
