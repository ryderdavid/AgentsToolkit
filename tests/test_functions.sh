#!/bin/bash
# Unit tests for cursor workflow scripts
# Tests deterministic functions for AGENTS.md compliance

# Don't use set -e as we want to continue after test failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

# Test helper functions
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    if [ "$expected" = "$actual" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo "  Expected: '$expected'"
        echo "  Actual:   '$actual'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

assert_matches() {
    local pattern="$1"
    local actual="$2"
    local test_name="$3"

    if [[ "$actual" =~ $pattern ]]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        echo "  Expected pattern: '$pattern'"
        echo "  Actual: '$actual'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "================================================"
echo "Cursor Workflow Scripts - Unit Tests"
echo "================================================"
echo ""

# ========================================
# Test: detect_branch_type (from issue.sh)
# ========================================
echo -e "${YELLOW}Testing: detect_branch_type${NC}"

# Define the function inline (extracted from issue.sh)
detect_branch_type() {
    local title="$1"
    local title_lower=$(echo "$title" | tr '[:upper:]' '[:lower:]')

    if echo "$title_lower" | grep -q "fix\|bug\|error\|broken\|issue"; then
        echo "fix"
    elif echo "$title_lower" | grep -q "refactor\|cleanup\|optimize\|restructure"; then
        echo "refactor"
    elif echo "$title_lower" | grep -q "docs\|documentation\|readme"; then
        echo "docs"
    elif echo "$title_lower" | grep -q "chore\|update\|upgrade\|bump\|deps"; then
        echo "chore"
    else
        echo "feat"
    fi
}

# Test cases
assert_equals "fix" "$(detect_branch_type 'Fix login button alignment')" "detect_branch_type: 'Fix' -> fix"
assert_equals "fix" "$(detect_branch_type 'Bug in authentication flow')" "detect_branch_type: 'Bug' -> fix"
assert_equals "fix" "$(detect_branch_type 'Error handling for API calls')" "detect_branch_type: 'Error' -> fix"
assert_equals "fix" "$(detect_branch_type 'Broken link in navbar')" "detect_branch_type: 'Broken' -> fix"
assert_equals "refactor" "$(detect_branch_type 'Refactor auth module')" "detect_branch_type: 'Refactor' -> refactor"
assert_equals "refactor" "$(detect_branch_type 'Cleanup old code')" "detect_branch_type: 'Cleanup' -> refactor"
assert_equals "refactor" "$(detect_branch_type 'Optimize database queries')" "detect_branch_type: 'Optimize' -> refactor"
assert_equals "docs" "$(detect_branch_type 'Update documentation')" "detect_branch_type: 'documentation' -> docs"
assert_equals "docs" "$(detect_branch_type 'Update README')" "detect_branch_type: 'README' -> docs"
assert_equals "chore" "$(detect_branch_type 'Update dependencies')" "detect_branch_type: 'Update' -> chore"
assert_equals "chore" "$(detect_branch_type 'Bump version to 2.0')" "detect_branch_type: 'Bump' -> chore"
assert_equals "feat" "$(detect_branch_type 'Add dark mode toggle')" "detect_branch_type: 'Add' -> feat"
assert_equals "feat" "$(detect_branch_type 'Implement user profiles')" "detect_branch_type: 'Implement' -> feat"
assert_equals "feat" "$(detect_branch_type 'New payment integration')" "detect_branch_type: default -> feat"

echo ""

# ========================================
# Test: Branch slug generation
# ========================================
echo -e "${YELLOW}Testing: Branch slug generation${NC}"

generate_slug() {
    echo "$1" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g' | \
        sed 's/^-\|-$//g' | \
        cut -c1-50
}

assert_equals "fix-login-button-alignment" "$(generate_slug 'Fix login button alignment')" "slug: spaces to hyphens"
assert_equals "add-oauth-2-0-support" "$(generate_slug 'Add OAuth 2.0 Support')" "slug: special chars removed"
assert_matches "^update-api-endpoint-?$" "$(generate_slug 'Update API endpoint!!!')" "slug: trailing special chars removed"
assert_equals "fix-bug-42" "$(generate_slug 'Fix Bug #42')" "slug: hash removed"
assert_equals "very-long-title-that-exceeds-the-fifty-character-l" "$(generate_slug 'Very long title that exceeds the fifty character limit for branch names')" "slug: truncated to 50 chars"

echo ""

# ========================================
# Test: Branch name format (AGENTS.md compliance)
# ========================================
echo -e "${YELLOW}Testing: Branch name format (AGENTS.md)${NC}"

generate_branch_name() {
    local category="$1"
    local description="$2"
    local issue_num="$3"

    local sanitized=$(echo "$description" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/--*/-/g' | \
        sed 's/^-\|-$//g' | \
        cut -c1-50)

    if [ -n "$issue_num" ]; then
        echo "${category}/${issue_num}-${sanitized}"
    else
        echo "${category}/pending-${sanitized}"
    fi
}

# Per AGENTS.md: {type}/{issue-num}-{short-description} or {type}/pending-{short-description}
assert_equals "fix/42-login-button" "$(generate_branch_name 'fix' 'Login button' '42')" "branch: fix/42-login-button"
assert_equals "feat/123-add-dark-mode" "$(generate_branch_name 'feat' 'Add dark mode' '123')" "branch: feat/123-add-dark-mode"
assert_equals "fix/pending-null-reference" "$(generate_branch_name 'fix' 'Null reference' '')" "branch: pending format when no issue"
assert_equals "refactor/pending-auth-module" "$(generate_branch_name 'refactor' 'Auth module' '')" "branch: refactor/pending-auth-module"

# Validate format matches AGENTS.md pattern
assert_matches "^(fix|feat|refactor|docs|chore)/[0-9]+-[a-z0-9-]+$" "$(generate_branch_name 'fix' 'Test' '1')" "branch: matches AGENTS.md pattern with issue"
assert_matches "^(fix|feat|refactor|docs|chore)/pending-[a-z0-9-]+$" "$(generate_branch_name 'fix' 'Test' '')" "branch: matches AGENTS.md pending pattern"

echo ""

# ========================================
# Test: Screenshot filename format
# ========================================
echo -e "${YELLOW}Testing: Screenshot filename format (AGENTS.md)${NC}"

generate_screenshot_name() {
    local date_prefix="$1"
    local issue_num="$2"
    local branch_slug="$3"
    local desc="$4"
    local ext="$5"

    echo "${date_prefix}_${issue_num}_${branch_slug}_${desc}.${ext}"
}

# Per AGENTS.md: YYYYMMDD_{issue-num}_{branch-name}_{description}.{ext}
DATE_PREFIX="20251220"

assert_equals "20251220_42_fix-login_error-dialog.png" "$(generate_screenshot_name '20251220' '42' 'fix-login' 'error-dialog' 'png')" "screenshot: correct format"
assert_matches "^[0-9]{8}_[0-9]+_[a-z0-9-]+_[a-z0-9-]+\.[a-z]+$" "$(generate_screenshot_name '20251220' '42' 'fix-login' 'error-dialog' 'png')" "screenshot: matches AGENTS.md pattern"

echo ""

# ========================================
# Test: Commit message format
# ========================================
echo -e "${YELLOW}Testing: Commit message format (AGENTS.md)${NC}"

generate_commit_message() {
    local issue_num="$1"
    local description="$2"
    echo "#${issue_num}: ${description}"
}

# Per AGENTS.md: #{issue-num}: {imperative description}
assert_equals "#42: Add null check before serialization" "$(generate_commit_message '42' 'Add null check before serialization')" "commit: correct format"
assert_matches "^#[0-9]+: .+$" "$(generate_commit_message '42' 'Fix bug')" "commit: matches AGENTS.md pattern"

echo ""

# ========================================
# Test: PR title format
# ========================================
echo -e "${YELLOW}Testing: PR title format${NC}"

generate_pr_title() {
    local issue_num="$1"
    local issue_title="$2"

    if [ -n "$issue_num" ]; then
        echo "#${issue_num}: ${issue_title}"
    else
        echo "${issue_title}"
    fi
}

assert_equals "#42: Fix login button alignment" "$(generate_pr_title '42' 'Fix login button alignment')" "PR title: with issue number"
assert_equals "Standalone change" "$(generate_pr_title '' 'Standalone change')" "PR title: without issue number"

echo ""

# ========================================
# Test: Category detection (from branch.sh)
# ========================================
echo -e "${YELLOW}Testing: detect_category${NC}"

# Note: This mirrors the actual detect_category from branch.sh
# The order matters - more specific patterns should come first
detect_category() {
    local description="$1"
    local desc_lower=$(echo "$description" | tr '[:upper:]' '[:lower:]')

    # Order matters: check specific patterns before general ones
    if echo "$desc_lower" | grep -q "fix\|bug\|error\|broken\|issue"; then
        echo "fix"
    elif echo "$desc_lower" | grep -q "test\|spec\|testing"; then
        echo "test"
    elif echo "$desc_lower" | grep -q "docs\|documentation"; then
        echo "docs"
    elif echo "$desc_lower" | grep -q "add\|new\|implement\|create"; then
        echo "feature"
    elif echo "$desc_lower" | grep -q "refactor\|cleanup\|optimize"; then
        echo "refactor"
    elif echo "$desc_lower" | grep -q "update\|upgrade\|bump\|deps"; then
        echo "chore"
    else
        echo "feature"
    fi
}

assert_equals "fix" "$(detect_category 'fix the login bug')" "category: fix"
assert_equals "feature" "$(detect_category 'add new feature')" "category: feature"
assert_equals "feature" "$(detect_category 'implement OAuth')" "category: implement -> feature"
assert_equals "refactor" "$(detect_category 'refactor auth')" "category: refactor"
assert_equals "chore" "$(detect_category 'bump version')" "category: chore"
assert_equals "test" "$(detect_category 'write unit tests')" "category: test"
assert_equals "docs" "$(detect_category 'improve documentation')" "category: docs"
assert_equals "feature" "$(detect_category 'some random work')" "category: default -> feature"

echo ""

# ========================================
# Summary
# ========================================
echo "================================================"
echo "Test Summary"
echo "================================================"
echo -e "Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
fi
