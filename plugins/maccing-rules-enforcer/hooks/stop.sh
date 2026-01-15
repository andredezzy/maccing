#!/bin/bash
# Stop hook: Require verification against project rules before stopping (once per session)
# Uses a short message since rules are already in context from other hooks

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

# Detect rules to check if project has any
DETECTION=$("$DETECT_SCRIPT" "$CWD")
RULES_PATH=$(echo "$DETECTION" | jq -r '.rules_path // empty')
RULES_DIR=$(echo "$DETECTION" | jq -r '.rules_dir // empty')

# If no rules found, allow stop
if [ -z "$RULES_PATH" ] && [ -z "$RULES_DIR" ]; then
    exit 0
fi

if [ "$RULES_PATH" = "null" ] && [ "$RULES_DIR" = "null" ]; then
    exit 0
fi

if [ ! -f "$RULES_PATH" ] && [ ! -d "$RULES_DIR" ]; then
    exit 0
fi

# Create marker file to indicate verification was requested
touch "$MARKER_FILE"

# Block with a short message (rules are already in context from other hooks)
jq -n '{
    "decision": "block",
    "reason": "Verify your work against project rules before completing. Run required quality checks (lint, typecheck, etc.) and confirm no rule violations. Acknowledge with: All rules verified."
}'

exit 0
