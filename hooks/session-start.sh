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

# The database skills live in folders named after their subject and are invoked
# by their prefixed name, so `mapping` on disk is `database-mapping` in a skill
# list. Each gets its own line, because each guards a different subject. The
# scan drives the list: a folder added later announces itself here with no edit,
# and the loop simply produces nothing while the directory is absent.
subject_of() {
  case "$1" in
    mapping) printf 'the database map, or any script or reading derived from it' ;;
    ops) printf 'a live database investigation, or any case written against one' ;;
    *) printf 'the area it is named for' ;;
  esac
}

database_doctrine=""
for skill_dir in "$ROOT"/skills/database/*/; do
  [ -d "$skill_dir" ] || continue
  folder="$(basename "$skill_dir")"
  database_doctrine="${database_doctrine} database-${folder} is a STANDING RULE: load it before touching $(subject_of "$folder"), including a one-line change, and before deciding that this particular touch is too small to need it."
done

context="maccing doctrine: the engineering skills (${doctrine}) and the reasoning skill are STANDING RULES, not suggestions. Before ANY code work — including small or quick edits; that this is just a small change is the exact trap — invoke the matching skill: whether a structure should exist at all — adding a branch, case, or flag to existing code, or reaching for abstraction, configuration, indirection, or generality → dx; the code touch itself → writing-code, which covers creating or splitting files, defining error classes, writing catch blocks, adding helpers or wrappers, structuring tests; designing types, schemas, config or payload shapes; every variable, function, file, type, or config key an edit introduces, plus boolean vs union vs enum for states, and NEVER coin an identifier before retrieving the framework's, the domain's, or the codebase's existing word; touching any external library, API, or SDK, or fixing any error; and creating UI components, pages, or layouts, adding props, wiring data fetching for a screen, or building forms. For hard problems, diagnoses, or verdicts → reasoning."
context="${context}${database_doctrine}"

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$context"
