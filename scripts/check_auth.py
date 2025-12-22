#!/usr/bin/env python3
"""check_auth.py - Quick GitHub CLI auth verification for AI agents.

Runs to verify GitHub CLI authentication status.
"""

import sys
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.common import check_gh_auth


def main():
    """Check GitHub CLI authentication."""
    is_auth, username = check_gh_auth()
    
    if is_auth:
        print(f"✅ GitHub CLI authenticated as: {username or 'unknown'}")
        print("✅ Ready to run workflow commands")
        sys.exit(0)
    else:
        print("❌ Not authenticated. Run: gh auth login")
        sys.exit(1)


if __name__ == '__main__':
    main()

