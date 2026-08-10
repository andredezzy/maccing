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
#   1. Observe. Invoking a skill, or touching a file inside a skill's own
#      directory, marks that skill loaded for the rest of the session.
#   2. Gate. An edit or write under a governed tree whose skill is not marked
#      loaded is denied, and stays denied until that skill is marked loaded.
#
# The gate does not step aside after one reminder. A hook cannot verify that an
# agent read anything, but it does not need to: the observe path is the way
# through, and it is deliberately generous about what counts as reaching for
# the skill. An agent that engages with the skill is never denied twice. An
# agent that ignores the reminder and retries is the case the gate exists for.
#
# The escape is MACCING_SKILL_GATE=off, for a host that gives an agent no
# observable way to load a skill at all. It is one environment variable a human
# sets on purpose, which is a different thing from the hook quietly giving up
# on its own the second time it is asked.
#
# Every unexpected path exits 0 with no output: unreadable input, no jq, a tool
# shape this script does not know, a temp directory it cannot create. A hook
# that cannot read its own input must step aside, because blocking all work is
# a worse failure than skipping one reminder.
set -euo pipefail

STDIN_TIMEOUT_SECONDS=5
STATE_ROOT="${TMPDIR:-/tmp}/maccing-hooks"

# Where the skills live, derived from this script rather than from the
# environment or the caller's working directory. The deny message names a file
# for the agent to open, and the agent's cwd is the governed project, not this
# checkout — a relative path would name nothing there. Empty if the directory
# cannot be resolved, which the deny path treats as "no path to offer".
PLUGIN_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd -P)" || PLUGIN_ROOT=""

# Only these tools are gated, spelled exactly as the hosts that offer them
# spell them. The observe side matches tool names case-insensitively and over a
# wider list, because the two directions have different costs: observing too
# much skips a reminder, gating too much blocks work.
EDIT_TOOLS='^(Edit|MultiEdit|Write|NotebookEdit)$'
# Tools whose whole purpose is to load a skill, so a bare skill name in their
# arguments is signal rather than coincidence.
SKILL_TOOLS='^(skill|skills|slashcommand|loadskill|useskill)$'
# Tools that write. A path one of these carries is not evidence of reading.
WRITE_TOOLS='^(edit|multiedit|write|notebookedit|patch|apply_patch|update)$'

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

# Where a skill's own SKILL.md lives, relative to PLUGIN_ROOT. This is the path
# the denial tells the agent to read, so it has to resolve: `growth` is one
# skill among six under the `skills/growth/` grouping folder, not the folder
# itself.
skill_home() {
  case "$1" in
    growth) printf 'skills/growth/growth/' ;;
    database-mapping) printf 'skills/database/mapping/' ;;
    database-ops) printf 'skills/database/ops/' ;;
  esac
}

# The tree whose files count as reaching for the skill, which is wider than the
# skill's own directory wherever the skill has siblings that route back through
# it: an agent reading skills/growth/meta/whatsapp/SKILL.md has engaged with
# growth. Defaults to the skill's own directory, so a new governed tree needs
# nothing here.
skill_family() {
  case "$1" in
    growth) printf 'skills/growth/' ;;
    *) skill_home "$1" ;;
  esac
}

# Does this text point at a skill's own files? Three shapes count: a path
# inside the skill's family tree, a path that is the tree itself, and the
# skill:// URI some hosts use to address a skill that has no path on disk.
points_at_skill() {
  local home
  home="$(skill_family "$1")"
  [ -n "$home" ] || return 1
  case "$2" in
    *"$home"* | *"${home%/}" | *"skill://$1"*) return 0 ;;
  esac
  return 1
}

# One sentence: which skill to load, and why this tree needs it.
deny_reason() {
  case "$1" in
    growth)
      printf 'Load the growth skill before editing anything under the growth tree — campaign measurement has one canonical contract, and hand-rolled arithmetic beside it is how two readings of the same campaign end up disagreeing.'
      ;;
    database-mapping)
      printf 'Load the database-mapping skill before editing the database map — it carries the fingerprint procedure and the role contract, and an edit made without it can leave the map describing a schema that has moved.'
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
tool_lc="$(printf '%s' "$tool_name" | tr 'A-Z' 'a-z')"

# A hook process cannot see the agent's context, so "loaded" is a file keyed by
# the session id. No session id means no reliable key, and no reminder.
session_key="$(printf '%s' "${session_id:-}" | tr -c 'A-Za-z0-9_-' '_')"
session_key="${session_key:0:64}"
[ -n "$session_key" ] || exit 0
STATE_DIR="$STATE_ROOT/$session_key"
mkdir -p "$STATE_DIR" 2>/dev/null || exit 0

# 1. Observe. Anything that looks like reaching for a skill marks it loaded,
# because this is the only way past the gate.
if [[ "$tool_lc" =~ $SKILL_TOOLS ]] && [ -n "$skill_arg" ]; then
  for skill in "${KNOWN_SKILLS[@]}"; do
    case "$skill_arg" in
      *"$skill"*) mark loaded "$skill" ;;
    esac
  done
fi

# A path or URI into a skill's own tree counts from any tool that is not a
# write: reading it, listing it, grepping it, or naming it in a shell command
# are the same gesture, and which tool carried the path says little. The skill
# argument is checked alongside the path, because that is where a shell
# command lands.
if ! [[ "$tool_lc" =~ $WRITE_TOOLS ]]; then
  for skill in "${KNOWN_SKILLS[@]}"; do
    if points_at_skill "$skill" "$file_path" || points_at_skill "$skill" "$skill_arg"; then
      mark loaded "$skill"
    fi
  done
fi

# 2. Gate.

# The deliberate escape. Without it, a host that gives an agent no observable
# way to load a skill would deny every governed edit for the whole session.
# The way out is a human setting this variable knowingly, once, with the gate's
# own name on it — not the hook deciding to stand down by itself.
if [ "${MACCING_SKILL_GATE:-}" = "off" ]; then
  exit 0
fi

[[ "$tool_name" =~ $EDIT_TOOLS ]] || exit 0
[ -n "$file_path" ] || exit 0

skill="$(governing_skill "$file_path")"
[ -n "$skill" ] || exit 0

if is_marked loaded "$skill"; then
  exit 0
fi

reason="$(deny_reason "$skill")"
[ -n "$reason" ] || exit 0

# Name the way through. It is the only way through, so leaving the agent to
# work it out would be the wedge arriving by a quieter route — and a path that
# does not resolve is worse than no path, because the agent follows it, finds
# nothing, and is still denied. So the file is checked before it is named, and
# where it cannot be found the denial offers only the gesture that needs no
# path at all.
home="$(skill_home "$skill")"
if [ -n "$PLUGIN_ROOT" ] && [ -n "$home" ] && [ -f "$PLUGIN_ROOT/${home}SKILL.md" ]; then
  reason="$reason Load it — invoke the $skill skill, or read $PLUGIN_ROOT/${home}SKILL.md — and the edit goes through."
else
  reason="$reason Load it — invoke the $skill skill — and the edit goes through."
fi

# jq builds the envelope rather than printf, because the reason now carries a
# filesystem path and a hand-escaped JSON string would break on the first one
# holding a quote or a backslash.
jq -cn --arg reason "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}' || exit 0
