# AGENTS.md — Mandatory Agent Behavior & Workflow Standards

Non-negotiable rules for all AI agents. Violations constitute workflow failures.

**Version:** 2.0.0 (Modular Rule Packs)  
**Reference:** Command examples at [AGENTS_REFERENCE.md](docs/AGENTS_REFERENCE.md).

---

## Active Rule Packs

This configuration loads the following rule packs:

- **Core Workflow Standards** (`rule-packs/core/`) — Universal rules
- **GitHub Workflow Hygiene** (`rule-packs/github-hygiene/`) — GitHub-specific rules

To use Azure DevOps instead, replace `github-hygiene` with `azure-devops` in your configuration.

---

<!-- BEGIN PACK IMPORTS -->

@rule-packs/core/prime-directives.md
@rule-packs/core/scope-management.md
@rule-packs/core/feedback-discipline.md
@rule-packs/core/safety-execution.md

@rule-packs/github-hygiene/issue-first.md
@rule-packs/github-hygiene/branch-management.md
@rule-packs/github-hygiene/screenshot-handling.md
@rule-packs/github-hygiene/pr-protocol.md
@rule-packs/github-hygiene/commit-standards.md
@rule-packs/github-hygiene/walkthrough-docs.md
@rule-packs/github-hygiene/github-output.md
@rule-packs/github-hygiene/anti-patterns.md

<!-- END PACK IMPORTS -->

---

## Configuration

To customize which packs are loaded, edit the imports above or use the AgentsToolkit GUI (coming soon).

**Character Budget:**
- Core: ~450 words (~2,800 chars)
- GitHub Hygiene: ~650 words (~4,200 chars)
- Azure DevOps: ~550 words (~3,600 chars)
- **Total (Core + GitHub):** ~1,100 words (~7,000 chars)

This leaves room for custom rules within most agent limits.
