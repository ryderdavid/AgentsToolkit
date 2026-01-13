# Safety & Execution

| Tier | Operations | Action |
|------|------------|--------|
| **1** | Create/edit work items, PRs, comments; normal git ops (`add`, `commit`, `push`, `checkout`, `branch`, `status`) | Execute |
| **2** | Close work items/PRs | Confirm first |
| **3** | `delete`, `merge`, `--force`, `reset --hard` | Only on explicit request |

**For Tier 1 operations:** Execute directly. Don't claim sandbox limitations for pre-approved safe operations.

**Before changes:** Work item exists? On feature branch? Branch name correct? Tier identified?
