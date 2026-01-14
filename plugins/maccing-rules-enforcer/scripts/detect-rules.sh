#!/bin/bash
# Detects project rules file location
# Searches common patterns and returns JSON with path

set -e

CWD="${1:-.}"

# Search order (first match wins)
SEARCH_PATHS=(
    "$CWD/rules/RULES.md"
    "$CWD/RULES.md"
    "$CWD/.claude/RULES.md"
    "$CWD/CLAUDE.md"
    "$CWD/.claude/CLAUDE.md"
)

RULES_PATH=""

# Check each path
for path in "${SEARCH_PATHS[@]}"; do
    if [ -f "$path" ]; then
        RULES_PATH="$path"
        break
    fi
done

# Check .claude/rules/ directory (concatenate all .md files)
RULES_DIR="$CWD/.claude/rules"
HAS_RULES_DIR=false
if [ -d "$RULES_DIR" ]; then
    RULES_COUNT=$(find "$RULES_DIR" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RULES_COUNT" -gt 0 ]; then
        HAS_RULES_DIR=true
    fi
fi

# Output JSON
jq -n \
    --arg rules_path "$RULES_PATH" \
    --arg rules_dir "$RULES_DIR" \
    --argjson has_rules_dir "$HAS_RULES_DIR" \
    --arg cwd "$CWD" \
    '{
        "cwd": $cwd,
        "rules_path": (if $rules_path != "" then $rules_path else null end),
        "rules_dir": (if $has_rules_dir then $rules_dir else null end),
        "has_rules": ($rules_path != "" or $has_rules_dir)
    }'

exit 0
