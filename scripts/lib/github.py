#!/usr/bin/env python3
"""GitHub CLI wrapper functions for AgentsToolkit.

Provides high-level functions for common GitHub operations:
- Issue management
- Pull request management
- Repository information
- Branch/commit operations
"""

import json
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from .common import run_gh, run_git, get_repo_root


def get_issue(issue_num: int) -> Optional[Dict[str, Any]]:
    """Get issue details from GitHub.
    
    Args:
        issue_num: Issue number
        
    Returns:
        Issue dict with keys like title, body, state, url, or None if not found
    """
    result, parsed = run_gh(
        'issue', 'view', str(issue_num),
        '--json', 'number,title,body,state,url',
        json_output=True
    )
    return parsed


def create_issue(
    title: str,
    body: str,
    labels: Optional[List[str]] = None
) -> Optional[Dict[str, Any]]:
    """Create a GitHub issue.
    
    Args:
        title: Issue title
        body: Issue body (markdown)
        labels: Optional list of label names
        
    Returns:
        Created issue dict with number and url, or None on failure
    """
    import tempfile
    import os

    # Use a temporary file for the body to avoid shell argument limit/quoting issues
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md') as tmp:
        tmp.write(body)
        tmp_path = tmp.name
    
    try:
        cmd = ['issue', 'create', '--title', title, '--body-file', tmp_path]
        
        if labels:
            for label in labels:
                cmd.extend(['--label', label])
        
        # gh issue create outputs URL to stdout on success, does not support --json
        result, _ = run_gh(*cmd, json_output=False)
        
        if result.returncode == 0 and result.stdout:
            url = result.stdout.strip()
            try:
                # Extract number from URL: https://github.com/owner/repo/issues/123
                number = int(url.split('/')[-1])
                return {'number': number, 'url': url}
            except (ValueError, IndexError):
                pass
        
        return None
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def update_issue(
    issue_num: int,
    title: Optional[str] = None,
    body: Optional[str] = None,
    state: Optional[str] = None
) -> bool:
    """Update an existing issue.
    
    Args:
        issue_num: Issue number
        title: New title (optional)
        body: New body (optional)
        state: New state: 'open' or 'closed' (optional)
        
    Returns:
        True if successful, False otherwise
    """
    cmd = ['issue', 'edit', str(issue_num)]
    
    if title:
        cmd.extend(['--title', title])
    if body:
        cmd.extend(['--body', body])
    if state:
        cmd.extend(['--state', state])
    
    result, _ = run_gh(*cmd)
    return result.returncode == 0


def add_issue_comment(issue_num: int, comment: str) -> bool:
    """Add a comment to an issue.
    
    Args:
        issue_num: Issue number
        comment: Comment text (markdown)
        
    Returns:
        True if successful, False otherwise
    """
    result, _ = run_gh('issue', 'comment', str(issue_num), '--body', comment)
    return result.returncode == 0


def get_pr(pr_num: int) -> Optional[Dict[str, Any]]:
    """Get pull request details.
    
    Args:
        pr_num: PR number
        
    Returns:
        PR dict or None if not found
    """
    result, parsed = run_gh(
        'pr', 'view', str(pr_num),
        '--json', 'number,title,body,state,url,headRefName,baseRefName',
        json_output=True
    )
    return parsed


def create_pr(
    title: str,
    body: str,
    base: str = 'main',
    head: Optional[str] = None,
    draft: bool = False
) -> Optional[Dict[str, Any]]:
    """Create a pull request.
    
    Args:
        title: PR title
        body: PR body (markdown)
        base: Base branch (default: 'main')
        head: Head branch (default: current branch)
        draft: Create as draft PR
        
    Returns:
        Created PR dict with number and url, or None on failure
    """
    import tempfile
    import os
    
    # Use a temporary file for the body
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md') as tmp:
        tmp.write(body)
        tmp_path = tmp.name

    try:
        cmd = ['pr', 'create', '--title', title, '--body-file', tmp_path, '--base', base]
        
        if head:
            cmd.extend(['--head', head])
        
        if draft:
            cmd.append('--draft')
        
        # gh pr create outputs URL to stdout, does not support --json
        result, _ = run_gh(*cmd, json_output=False)
        
        if result.returncode == 0 and result.stdout:
            url = result.stdout.strip()
            try:
                # Extract number from URL: https://github.com/owner/repo/pull/123
                number = int(url.split('/')[-1])
                return {'number': number, 'url': url}
            except (ValueError, IndexError):
                pass
        
        return None
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def update_pr(
    pr_num: int,
    title: Optional[str] = None,
    body: Optional[str] = None,
    base: Optional[str] = None
) -> bool:
    """Update an existing pull request.
    
    Args:
        pr_num: PR number
        title: New title (optional)
        body: New body (optional)
        base: New base branch (optional)
        
    Returns:
        True if successful, False otherwise
    """
    cmd = ['pr', 'edit', str(pr_num)]
    
    if title:
        cmd.extend(['--title', title])
    if body:
        cmd.extend(['--body', body])
    if base:
        cmd.extend(['--base', base])
    
    result, _ = run_gh(*cmd)
    return result.returncode == 0


def list_prs(
    state: str = 'open',
    head: Optional[str] = None,
    base: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List pull requests.
    
    Args:
        state: PR state: 'open', 'closed', or 'all'
        head: Filter by head branch
        base: Filter by base branch
        
    Returns:
        List of PR dicts
    """
    cmd = ['pr', 'list', '--state', state, '--json', 'number,title,headRefName,baseRefName,url']
    
    if head:
        cmd.extend(['--head', head])
    if base:
        cmd.extend(['--base', base])
    
    result, parsed = run_gh(*cmd, json_output=True)
    return parsed if parsed else []


def check_pr_exists(branch: str, base: str = 'main') -> Optional[int]:
    """Check if a PR exists for the given branch.
    
    Args:
        branch: Head branch name
        base: Base branch name
        
    Returns:
        PR number if exists, None otherwise
    """
    prs = list_prs(state='all', head=branch, base=base)
    if prs and len(prs) > 0:
        return prs[0].get('number')
    return None


def get_repo_default_branch() -> str:
    """Get the default branch of the repository.
    
    Returns:
        Default branch name (e.g., 'main' or 'master')
    """
    result, parsed = run_gh('repo', 'view', '--json', 'defaultBranchRef', json_output=True)
    if parsed:
        return parsed.get('defaultBranchRef', {}).get('name', 'main')
    return 'main'


def get_issue_from_branch(branch: str) -> Optional[int]:
    """Extract issue number from branch name or git config.
    
    Checks:
    1. Git config: branch.<name>.issue
    2. Branch name patterns: feat/123-description, fix-45-bug, etc.
    
    Args:
        branch: Branch name
        
    Returns:
        Issue number if found, None otherwise
    """
    import re
    
    # Method 1: Git config
    result = run_git('config', f'branch.{branch}.issue')
    if result.returncode == 0 and result.stdout:
        try:
            return int(result.stdout.strip())
        except ValueError:
            pass
    
    # Method 2: Branch name patterns
    # Matches: fix/123-, feat-45-, 67-description, category/123-desc
    match = re.search(r'(?:^|[-_/])(\d+)(?:[-_/]|$)', branch)
    if match:
        try:
            issue_num = int(match.group(1))
            # Verify it's a real issue
            issue = get_issue(issue_num)
            if issue:
                return issue_num
        except ValueError:
            pass
    
    return None


def link_branch_to_issue(branch: str, issue_num: int) -> bool:
    """Store issue-branch association in git config.
    
    Args:
        branch: Branch name
        issue_num: Issue number
        
    Returns:
        True if successful
    """
    result = run_git('config', f'branch.{branch}.issue', str(issue_num))
    if result.returncode == 0:
        # Also store issue URL for convenience
        issue = get_issue(issue_num)
        if issue and 'url' in issue:
            run_git('config', f'branch.{branch}.issueUrl', issue['url'])
        return True
    return False


def get_commits_ahead(branch: str, base: str = 'main') -> int:
    """Get number of commits the branch is ahead of base.
    
    Args:
        branch: Branch name
        base: Base branch name
        
    Returns:
        Number of commits ahead
    """
    result = run_git('rev-list', '--count', f'{base}..{branch}')
    if result.returncode == 0 and result.stdout:
        try:
            return int(result.stdout.strip())
        except ValueError:
            return 0
    return 0


def is_branch_pushed(branch: str) -> bool:
    """Check if branch exists on remote.
    
    Args:
        branch: Branch name
        
    Returns:
        True if branch is pushed to origin
    """
    result = run_git('ls-remote', '--exit-code', '--heads', 'origin', branch)
    return result.returncode == 0


def format_pr_body(
    issue_num: Optional[int] = None,
    summary: str = "",
    changes: Optional[List[str]] = None,
    how_to_test: Optional[List[str]] = None,
    limitations: Optional[List[str]] = None
) -> str:
    """Format PR body per AGENTS.md template.
    
    Args:
        issue_num: Issue number to link (Closes #N)
        summary: Summary text
        changes: List of changes
        how_to_test: List of testing steps
        limitations: List of known limitations
        
    Returns:
        Formatted PR body (markdown)
    """
    body = "## Summary\n\n"
    body += summary or "Implementation changes"
    body += "\n\n"
    
    body += "## Changes\n\n"
    if changes:
        for change in changes:
            body += f"- {change}\n"
    else:
        body += "- Implementation changes\n"
    body += "\n"
    
    body += "## How to Test\n\n"
    if how_to_test:
        for step in how_to_test:
            body += f"- [ ] {step}\n"
    else:
        body += "- [ ] Manual testing completed\n"
        body += "- [ ] All tests pass\n"
        body += "- [ ] Code review approved\n"
    body += "\n"
    
    body += "## Known Limitations\n\n"
    if limitations:
        for limitation in limitations:
            body += f"- {limitation}\n"
    else:
        body += "- None identified\n"
    body += "\n"
    
    if issue_num:
        body += f"Closes #{issue_num}\n"
    
    return body

