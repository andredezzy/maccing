#!/usr/bin/env bash
# Injects the maccing doctrine dispatcher at session start (superpowers pattern).
# The engineering skill list is read from the tree at runtime, so a newly added
# skill registers here with zero edits to this script.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

doctrine="dx"
if [ -d "$ROOT/skills/engineering" ]; then
  doctrine="$(ls "$ROOT/skills/engineering" 2>/dev/null | paste -sd, - | sed 's/,/, /g')"
fi

context="maccing doctrine: the engineering skills (${doctrine}) and the reasoning skill are STANDING RULES, not suggestions. Before ANY code work — including small or quick edits; that this is just a small change is the exact trap — invoke the matching skill: adding a branch, case, or flag to existing code → dx; creating or splitting files, defining error classes, writing catch blocks, adding helpers or wrappers, structuring tests → organizing-code; designing types, schemas, config or payload shapes → modeling-domains; naming anything, or choosing boolean vs union vs enum for states → naming; touching any external library, API, or SDK, or fixing any error → researching-before-coding; creating UI components, adding props, or building forms → composing-ui. For hard problems, diagnoses, or verdicts → reasoning."

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$context"
