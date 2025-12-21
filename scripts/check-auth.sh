#!/bin/bash

# Quick GitHub CLI auth verification for AI agents
# Runs in the user's shell (outside sandbox) when executed with elevation.

set -e

if gh auth status &> /dev/null; then
    USERNAME=$(gh api user -q .login 2>/dev/null || echo "unknown")
    echo "✅ GitHub CLI authenticated as: ${USERNAME}"
    echo "✅ Ready to run workflow commands"
    exit 0
else
    echo "❌ Not authenticated. Run: gh auth login"
    exit 1
fi

