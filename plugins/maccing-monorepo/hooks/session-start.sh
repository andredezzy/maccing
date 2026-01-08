#!/bin/bash
# SessionStart hook: Detects monorepo and injects context
# Receives JSON on stdin with cwd field

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-monorepo.sh"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
    exit 0
fi

# Run detection
DETECTION=$("$DETECT_SCRIPT" "$CWD")
TOOL=$(echo "$DETECTION" | jq -r '.tool // empty')

if [ -z "$TOOL" ] || [ "$TOOL" = "null" ]; then
    exit 0
fi

ROOT=$(echo "$DETECTION" | jq -r '.root')
FILTER_SYNTAX=$(echo "$DETECTION" | jq -r '.filter_syntax')
PACKAGES=$(echo "$DETECTION" | jq -r '.packages')

# Format package list
PACKAGE_LIST=$(echo "$PACKAGES" | jq -r '.[] | "  - \(.name) (\(.path)): \(.scripts)"' 2>/dev/null || echo "  (no packages found)")

# Capitalize tool name (portable, works with Bash 3.x)
TOOL_CAP=$(echo "$TOOL" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')

# Build context message
CONTEXT="This is a ${TOOL_CAP} monorepo.
Root: $ROOT
Packages:
$PACKAGE_LIST

Run scripts from root using: $FILTER_SYNTAX"

# Output JSON for context injection
jq -n \
    --arg context "$CONTEXT" \
    '{
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": $context
        }
    }'

exit 0
