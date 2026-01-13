# Azure DevOps Output

ALL URLs as markdown links: `[#123: Fix upload](link)` not bare URLs.

End-of-round summaries must include clickable links with descriptive anchor text.

**URL Format:**
- Work Item: `https://dev.azure.com/{org}/{project}/_workitems/edit/{id}`
- PR: `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`
- Commit: `https://dev.azure.com/{org}/{project}/_git/{repo}/commit/{hash}`

**Format:** `### 🔗 Azure DevOps Artifacts` section with:
- Work Item: `[#N: Title](url)`
- PR: `[PR #N: Title](url)`
- Commits: `[hash: msg](url)`
