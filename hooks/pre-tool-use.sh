#!/usr/bin/env bash
# PreToolUse adapter: reminds the agent to load a skill before it edits the tree
# that skill governs.
#
# This hook is NOT the enforcement. The skill description and the skill body
# carry the requirement, and they carry it on every host. This file is host
# wiring: where a host offers a pre-tool gate it gets used, and where it does
# not, nothing about the skills changes. No SKILL.md refers to this file.
#
# Two jobs, both driven by the tool invocation that arrives on stdin as JSON:
#   1. Observe. Invoking a skill, or reading a file inside a skill's own
#      directory, marks that skill loaded for the rest of the session.
#   2. Gate. An edit or write under a governed tree whose skill is not marked
#      loaded is denied once, with a reason that names the skill.
#
# Every unexpected path exits 0 with no output: unreadable input, no jq, a tool
# shape this script does not know, a temp directory it cannot create. A hook
# that cannot read its own input must step aside, because blocking all work is
# a worse failure than skipping one reminder.
set -euo pipefail

STDIN_TIMEOUT_SECONDS=5
STATE_ROOT="${TMPDIR:-/tmp}/maccing-hooks"

# Only these tools are gated. Every other tool is observed and never blocked.
EDIT_TOOLS='^(Edit|MultiEdit|Write|NotebookEdit)$'
READ_TOOLS='^(Read|NotebookRead)$'
SKILL_TOOLS='^(Skill|SlashCommand)$'

KNOWN_SKILLS=(growth database-mapping database-ops)

# The skill that governs a path, or nothing when the path is ungoverned.
# Order matters: the map is a single file inside the database tree and belongs
# to the mapping skill, not to the ops skill that surrounds it.
governing_skill() {
  case "/$1" in
    */.maccing/database/MAPPING.md) printf 'database-mapping' ;;
    */.maccing/database/* | */database-ops/*) printf 'database-ops' ;;
    */.maccing/growth/*) printf 'growth' ;;
  esac
}

# Where a skill lives, so that reading its own files counts as loading it.
skill_home() {
  case "$1" in
    growth) printf 'skills/growth/' ;;
    database-mapping) printf 'skills/database/mapping/' ;;
    database-ops) printf 'skills/database/ops/' ;;
  esac
}

# One sentence: which skill to load, and why this tree needs it.
deny_reason() {
  case "$1" in
    growth)
      printf 'Load the growth skill before editing anything under the growth tree — campaign measurement has one canonical contract, and hand-rolled arithmetic beside it is how two readings of the same campaign end up disagreeing.'
      ;;
    database-mapping)
      printf 'Load the database-mapping skill before editing the database map — every downstream reader fingerprints this file, so an edit made without the skill silently invalidates all of them.'
      ;;
    database-ops)
      printf 'Load the database-ops skill before editing anything under the database ops tree — it carries the investigation discipline and the query conventions these cases are written against.'
      ;;
  esac
}

# Read stdin with a per-line timeout, so a host that opens the pipe and never
# writes cannot wedge this process. Joining lines is safe: a valid JSON string
# escapes its newlines, so no significant character is lost.
read_stdin() {
  local line="" payload=""
  while IFS= read -r -t "$STDIN_TIMEOUT_SECONDS" line || [ -n "$line" ]; do
    payload+="$line"
    line=""
  done
  printf '%s' "$payload"
}

mark() { : >"$STATE_DIR/$1.$2" 2>/dev/null || true; }
is_marked() { [ -e "$STATE_DIR/$1.$2" ]; }

command -v jq >/dev/null 2>&1 || exit 0
if [ -t 0 ]; then
  exit 0
fi

payload="$(read_stdin)"
[ -n "$payload" ] || exit 0

# One jq pass for every field. The separator is the ASCII unit separator rather
# than a tab, because bash collapses runs of IFS whitespace and would silently
# shift every field left whenever one of them came back empty.
fields="$(
  printf '%s' "$payload" | jq -r '
    [ (.session_id? // ""),
      (.tool_name? // ""),
      (.tool_input?.file_path? // .tool_input?.path? // .tool_input?.notebook_path? // ""),
      ( [.tool_input?.command?, .tool_input?.skill?, .tool_input?.name?, .tool_input?.skill_name?]
        | map(select(type == "string")) | join(" ") )
    ] | join("\u001f")
  ' 2>/dev/null
)" || exit 0

IFS=$'\037' read -r session_id tool_name file_path skill_arg <<<"$fields" || true
tool_name="${tool_name:-}"
file_path="${file_path:-}"
skill_arg="${skill_arg:-}"
[ -n "$tool_name" ] || exit 0

# A hook process cannot see the agent's context, so "loaded" is a file keyed by
# the session id. No session id means no reliable key, and no reminder.
session_key="$(printf '%s' "${session_id:-}" | tr -c 'A-Za-z0-9_-' '_')"
session_key="${session_key:0:64}"
[ -n "$session_key" ] || exit 0
STATE_DIR="$STATE_ROOT/$session_key"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0

# 1. Observe.
if [[ "$tool_name" =~ $SKILL_TOOLS ]] && [ -n "$skill_arg" ]; then
  for skill in "${KNOWN_SKILLS[@]}"; do
    case "$skill_arg" in
      *"$skill"*) mark loaded "$skill" ;;
    esac
  done
fi

if [[ "$tool_name" =~ $READ_TOOLS ]] && [ -n "$file_path" ]; then
  for skill in "${KNOWN_SKILLS[@]}"; do
    home="$(skill_home "$skill")"
    [ -n "$home" ] || continue
    case "$file_path" in
      *"$home"*) mark loaded "$skill" ;;
    esac
  done
fi

# 2. Gate.
[[ "$tool_name" =~ $EDIT_TOOLS ]] || exit 0
[ -n "$file_path" ] || exit 0

skill="$(governing_skill "$file_path")"
[ -n "$skill" ] || exit 0

if is_marked loaded "$skill"; then
  exit 0
fi

# Remind once per skill per session. A second denial would only wedge the work,
# because a hook cannot verify that the agent actually read anything.
if is_marked reminded "$skill"; then
  exit 0
fi

reason="$(deny_reason "$skill")"
[ -n "$reason" ] || exit 0
mark reminded "$skill"

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
