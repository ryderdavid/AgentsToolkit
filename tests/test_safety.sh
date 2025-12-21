#!/bin/bash

# Safety test: ensure workflow scripts avoid destructive operations.
# Forbidden: deletes, force pushes, hard resets, merges, API DELETE calls.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

FORBIDDEN_PATTERNS=(
    "git push --force"
    "git reset --hard"
    "git clean -fd"
    "git branch -d"
    "git branch -D"
    "git push --delete"
    "gh issue delete"
    "gh pr merge"
    "gh repo delete"
    "gh repo archive"
    "gh api .*DELETE"
)

failures=0

echo "Running safety checks against scripts in $SCRIPTS_DIR"
for script in "$SCRIPTS_DIR"/*.sh; do
    while IFS= read -r pattern; do
        :
    done < /dev/null
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if grep -E -n "$pattern" "$script" >/dev/null 2>&1; then
            echo "❌ Forbidden pattern found in $(basename "$script"): $pattern"
            failures=$((failures + 1))
        fi
    done
done

if [ "$failures" -gt 0 ]; then
    echo "Safety test failed with $failures issue(s)."
    exit 1
fi

echo "✅ Safety test passed: no forbidden patterns found."

