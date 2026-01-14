#!/bin/bash
# PreCompact hook: Re-inject full rules after context compression

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

if [ -n "$RULES_PATH" ] && [ "$RULES_PATH" != "null" ] && [ -f "$RULES_PATH" ]; then
    RULES_CONTENT=$(cat "$RULES_PATH")
fi

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

# Append rules to post-compaction context
APPEND_CONTEXT="「RULES RE-INJECTED AFTER COMPACTION」

$RULES_CONTENT

「These rules were preserved through context compaction. Continue following ALL rules.」"

jq -n \
    --arg context "$APPEND_CONTEXT" \
    '{
        "hookSpecificOutput": {
            "hookEventName": "PreCompact",
            "additionalContext": $context
        }
    }'

exit 0
