#!/bin/bash
# Stop hook: Require verification against all rules before stopping (once per session)

set -e

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DETECT_SCRIPT="$PLUGIN_ROOT/scripts/detect-rules.sh"

# Read hook input
INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
    exit 0
fi

# Use a marker file to track if verification was already requested this session
# The marker includes the CWD hash to be unique per project
if command -v md5sum &>/dev/null; then
    CWD_HASH=$(echo "$CWD" | md5sum | cut -d' ' -f1)
elif command -v md5 &>/dev/null; then
    CWD_HASH=$(echo "$CWD" | md5 -q)
elif command -v shasum &>/dev/null; then
    CWD_HASH=$(echo "$CWD" | shasum | cut -d' ' -f1)
else
    # Fallback: sanitize CWD to alphanumeric
    CWD_HASH=$(echo "$CWD" | tr -cd '[:alnum:]' | head -c32)
fi
MARKER_FILE="/tmp/maccing-rules-enforcer-stop-$CWD_HASH"

# If marker exists, verification was already requested: allow stop
if [ -f "$MARKER_FILE" ]; then
    # Clean up marker for next session
    rm -f "$MARKER_FILE"
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

# Create marker file to indicate verification was requested
touch "$MARKER_FILE"

# Build verification reason
REASON="「STOP BLOCKED: Rule Verification Required」

Before stopping, verify your work against ALL project rules:

$RULES_CONTENT

「VERIFICATION CHECKLIST」
1. Review each rule section above
2. Confirm no violations in your changes
3. If any rule was violated, fix it now
4. Run required quality checks (lint, typecheck, etc.)
5. Only then may you complete the task

If all rules pass, acknowledge with: \"All rules verified. Task complete.\""

# Block stopping until verification
jq -n \
    --arg reason "$REASON" \
    '{
        "decision": "block",
        "reason": $reason
    }'

exit 0
