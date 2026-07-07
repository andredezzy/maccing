#!/usr/bin/env bash
# Injects the maccing doctrine dispatcher at session start (superpowers pattern).
# The engineering skill list is read from the tree at runtime, so a newly added
# skill registers here with zero edits to this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

doctrine="dx"
if [ -d "$ROOT/skills/engineering" ]; then
  doctrine="$(ls "$ROOT/skills/engineering" 2>/dev/null | paste -sd ', ' -)"
fi

context="maccing doctrine: the engineering skills (${doctrine}) and the reasoning skill are STANDING RULES, not suggestions. Before designing, structuring, naming, or EXTENDING any code — including small or quick edits; that this is just a small change is the exact trap — check whether one of them applies and invoke it (adding a branch, case, or flag to existing code → dx). For hard problems, diagnoses, or verdicts → reasoning."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$context"
