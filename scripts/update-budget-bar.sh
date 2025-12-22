#!/bin/bash
# Update the AGENTS.md word budget bar in README.md
# This script counts words in AGENTS.md and updates the visualization in README.md

set -e

# Configuration
TARGET_WORDS=1000
BAR_WIDTH=40
README_FILE="README.md"
AGENTS_FILE="AGENTS.md"

# Check files exist
if [[ ! -f "$AGENTS_FILE" ]]; then
    echo "Error: $AGENTS_FILE not found"
    exit 1
fi

if [[ ! -f "$README_FILE" ]]; then
    echo "Error: $README_FILE not found"
    exit 1
fi

# Count words in AGENTS.md
WORD_COUNT=$(wc -w "$AGENTS_FILE" | awk '{print $1}')
echo "AGENTS.md word count: $WORD_COUNT"

# Calculate percentage
PERCENTAGE=$((WORD_COUNT * 100 / TARGET_WORDS))

# Calculate bar fill (ensure it doesn't exceed bar width)
FILLED_CHARS=$((PERCENTAGE * BAR_WIDTH / 100))
if [[ $FILLED_CHARS -gt $BAR_WIDTH ]]; then
    FILLED_CHARS=$BAR_WIDTH
fi
EMPTY_CHARS=$((BAR_WIDTH - FILLED_CHARS))

# Generate bar visualization
FILLED=$(printf '█%.0s' $(seq 1 $FILLED_CHARS))
EMPTY=$(printf '░%.0s' $(seq 1 $EMPTY_CHARS))
BAR="${FILLED}${EMPTY}"

# Calculate buffer remaining
BUFFER=$((TARGET_WORDS - WORD_COUNT))

# Create the new budget section
NEW_BUDGET="AGENTS.md Word Budget (target: 1,000 words)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${BAR}  ${WORD_COUNT}/1000 (${PERCENTAGE}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Buffer remaining: ${BUFFER} words for future additions"

# Check if budget bar needs updating
CURRENT_BUDGET=$(sed -n '629,633p' "$README_FILE")

if [[ "$CURRENT_BUDGET" == "$NEW_BUDGET" ]]; then
    echo "Budget bar is already up to date (${WORD_COUNT}/1000, ${PERCENTAGE}%)"
    exit 0
fi

# Update README.md using sed
# macOS sed requires -i '' for in-place editing, Linux sed uses -i
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' '629,633d' "$README_FILE"
    # Insert new lines at line 629
    {
        head -n 628 "$README_FILE"
        echo "$NEW_BUDGET"
        tail -n +629 "$README_FILE"
    } > "${README_FILE}.tmp"
    mv "${README_FILE}.tmp" "$README_FILE"
else
    # Linux
    sed -i '629,633d' "$README_FILE"
    # Insert new lines at line 629
    {
        head -n 628 "$README_FILE"
        echo "$NEW_BUDGET"
        tail -n +629 "$README_FILE"
    } > "${README_FILE}.tmp"
    mv "${README_FILE}.tmp" "$README_FILE"
fi

echo "✓ Updated budget bar: ${WORD_COUNT}/1000 (${PERCENTAGE}%)"
echo "  Filled: ${FILLED_CHARS} chars, Empty: ${EMPTY_CHARS} chars"
echo "  Buffer: ${BUFFER} words"
exit 0

