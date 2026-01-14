#!/bin/bash
# SessionStart hook: Inject full rules at session start

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-rules.sh"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
    exit 0
fi

# Detect rules
DETECTION=$("$DETECT_SCRIPT" "$CWD")
RULES_PATH=$(echo "$DETECTION" | jq -r '.rules_path // empty')
RULES_DIR=$(echo "$DETECTION" | jq -r '.rules_dir // empty')

# Build rules content
RULES_CONTENT=""

# Add main rules file
if [ -n "$RULES_PATH" ] && [ "$RULES_PATH" != "null" ] && [ -f "$RULES_PATH" ]; then
    RULES_CONTENT=$(cat "$RULES_PATH")
fi

# Add .claude/rules/*.md files
if [ -n "$RULES_DIR" ] && [ "$RULES_DIR" != "null" ] && [ -d "$RULES_DIR" ]; then
    for rule_file in "$RULES_DIR"/*.md; do
        if [ -f "$rule_file" ]; then
            FILENAME=$(basename "$rule_file")
            RULES_CONTENT="$RULES_CONTENT

<!-- $FILENAME -->
$(cat "$rule_file")"
        fi
    done
fi

if [ -z "$RULES_CONTENT" ]; then
    exit 0
fi

# Build context message
CONTEXT="「PROJECT RULES ACTIVE」

$RULES_CONTENT

「YOU MUST follow ALL rules above throughout this session. No exceptions.」"

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
