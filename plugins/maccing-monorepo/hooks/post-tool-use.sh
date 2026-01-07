#!/bin/bash
# PostToolUse hook: Reminds to run scripts from root with filters
# Matches: Bash tool only
# Receives JSON on stdin with tool_input.command and cwd

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-monorepo.sh"

# Script patterns that should run from root
SCRIPT_PATTERNS="^(npm run|npm exec|npx|yarn|pnpm|turbo|nx|jest|vitest|eslint|prettier|tsc)"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$CWD" ] || [ -z "$COMMAND" ]; then
    exit 0
fi

# Check if command matches script patterns
if ! echo "$COMMAND" | grep -qE "$SCRIPT_PATTERNS"; then
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

# Check if already at root
if [ "$CWD" = "$ROOT" ]; then
    exit 0
fi

# Calculate relative path from root
REL_PATH="${CWD#$ROOT/}"

# Try to find package name for current directory
PACKAGE_NAME=""
if [ -f "$CWD/package.json" ]; then
    PACKAGE_NAME=$(jq -r '.name // empty' "$CWD/package.json" 2>/dev/null)
fi

# Extract task from command
TASK=""
case "$COMMAND" in
    npm\ run\ *) TASK=$(echo "$COMMAND" | sed 's/npm run //' | awk '{print $1}') ;;
    yarn\ *) TASK=$(echo "$COMMAND" | awk '{print $2}') ;;
    pnpm\ *) TASK=$(echo "$COMMAND" | awk '{print $2}') ;;
    *) TASK="<task>" ;;
esac

# Build suggestion based on tool
case "$TOOL" in
    turborepo)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="turbo run $TASK --filter=$PACKAGE_NAME"
        else
            SUGGESTION="turbo run $TASK --filter=./$REL_PATH"
        fi
        ;;
    nx)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="nx $TASK $PACKAGE_NAME"
        else
            SUGGESTION="nx $TASK <project>"
        fi
        ;;
    pnpm)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="pnpm --filter $PACKAGE_NAME $TASK"
        else
            SUGGESTION="pnpm --filter ./$REL_PATH $TASK"
        fi
        ;;
    npm)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="npm run $TASK -w $PACKAGE_NAME"
        else
            SUGGESTION="npm run $TASK -w ./$REL_PATH"
        fi
        ;;
    yarn)
        if [ -n "$PACKAGE_NAME" ]; then
            SUGGESTION="yarn workspace $PACKAGE_NAME $TASK"
        else
            SUGGESTION="yarn workspace <package> $TASK"
        fi
        ;;
esac

# Build context message
CONTEXT="You ran \`$COMMAND\` from $REL_PATH/. For better caching and consistency, run from monorepo root ($ROOT): \`$SUGGESTION\`"

# Output JSON for context injection (allow, don't block)
jq -n \
    --arg context "$CONTEXT" \
    '{
        "decision": "allow",
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": $context
        }
    }'

exit 0
