#!/usr/bin/env python3
"""Unit tests for AgentsToolkit Python library modules.

Tests core functionality of common, symlinks, and github modules.
"""

import sys
import unittest
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from lib.common import (
    sanitize_branch_name, detect_branch_type, format_branch_name
)


class TestCommon(unittest.TestCase):
    """Test common module functions."""
    
    def test_sanitize_branch_name(self):
        """Test branch name sanitization."""
        self.assertEqual(
            sanitize_branch_name("Fix: Login Bug!"),
            "fix-login-bug"
        )
        self.assertEqual(
            sanitize_branch_name("Add User Authentication"),
            "add-user-authentication"
        )
        self.assertEqual(
            sanitize_branch_name("Update docs (README)"),
            "update-docs-readme"
        )
        # Test length limiting
        long_name = "a" * 100
        result = sanitize_branch_name(long_name, max_length=50)
        self.assertEqual(len(result), 50)
    
    def test_detect_branch_type(self):
        """Test branch type detection from title."""
        self.assertEqual(detect_branch_type("Fix login bug"), "fix")
        self.assertEqual(detect_branch_type("Broken authentication"), "fix")
        self.assertEqual(detect_branch_type("Error in API"), "fix")
        
        self.assertEqual(detect_branch_type("Add user profile"), "feat")
        self.assertEqual(detect_branch_type("Create new dashboard"), "feat")
        self.assertEqual(detect_branch_type("Implement feature X"), "feat")
        
        self.assertEqual(detect_branch_type("Update documentation"), "docs")
        self.assertEqual(detect_branch_type("Docs for API"), "docs")
        
        self.assertEqual(detect_branch_type("Refactor authentication"), "refactor")
        self.assertEqual(detect_branch_type("Cleanup old code"), "refactor")
        
        self.assertEqual(detect_branch_type("Update dependencies"), "chore")
        self.assertEqual(detect_branch_type("Bump version"), "chore")
        
        self.assertEqual(detect_branch_type("Add unit tests"), "test")
        self.assertEqual(detect_branch_type("Testing framework"), "test")
    
    def test_format_branch_name(self):
        """Test branch name formatting per AGENTS.md."""
        # With issue number
        self.assertEqual(
            format_branch_name("feat", "add-authentication", 42),
            "feat/42-add-authentication"
        )
        
        # Without issue number (pending)
        self.assertEqual(
            format_branch_name("fix", "login-bug", None),
            "fix/pending-login-bug"
        )
        
        # Different types
        self.assertEqual(
            format_branch_name("docs", "update-readme", 123),
            "docs/123-update-readme"
        )


class TestSymlinks(unittest.TestCase):
    """Test symlinks module functions."""
    
    def test_is_windows(self):
        """Test Windows detection."""
        from lib.symlinks import is_windows
        import platform
        
        # Should return True on Windows, False otherwise
        expected = platform.system() == 'Windows'
        self.assertEqual(is_windows(), expected)


class TestGitHub(unittest.TestCase):
    """Test github module functions."""
    
    def test_format_pr_body(self):
        """Test PR body formatting."""
        from lib.github import format_pr_body
        
        body = format_pr_body(
            issue_num=42,
            summary="Fix authentication bug",
            changes=["Added null check", "Updated tests"],
            how_to_test=["Run test suite", "Manual login test"],
            limitations=["Only works on Chrome"]
        )
        
        self.assertIn("## Summary", body)
        self.assertIn("Fix authentication bug", body)
        self.assertIn("## Changes", body)
        self.assertIn("Added null check", body)
        self.assertIn("## How to Test", body)
        self.assertIn("Run test suite", body)
        self.assertIn("## Known Limitations", body)
        self.assertIn("Only works on Chrome", body)
        self.assertIn("Closes #42", body)
    
    def test_format_pr_body_minimal(self):
        """Test PR body with minimal information."""
        from lib.github import format_pr_body
        
        body = format_pr_body()
        
        self.assertIn("## Summary", body)
        self.assertIn("## Changes", body)
        self.assertIn("## How to Test", body)
        self.assertIn("## Known Limitations", body)
        self.assertNotIn("Closes", body)  # No issue number


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)

