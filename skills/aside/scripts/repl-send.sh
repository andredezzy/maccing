#!/usr/bin/env bash
# Runs one JavaScript file in a long-lived `aside repl` session, waits for it,
# and prints only its output. Start the session first: references/terminal.md,
# "A session that outlives the call".
#
# Usage: bash repl-send.sh <session dir> <file.js> [timeout seconds, default 130]
#
# The file runs inside an async function, so its const and let names stay
# local to the step. Keep anything the next step needs on globalThis.
#
# Needs: bash, tail, grep, sed, cp, date. No other helper.

set -euo pipefail

dir=$1
file=$2
timeout=${3:-130}
log="$dir/out.log"

strip() { sed 's/\x1b\[[0-9;]*m//g'; }

session=$(grep -m1 '^sessionDir: ' <(strip <"$log") | sed 's/^sessionDir: //')
if [ -z "$session" ]; then
  echo "No sessionDir line in $log: is the session running?" >&2
  exit 1
fi

id=$(date +%s)$RANDOM
cp "$file" "$session/step-$id.js"
start=$(wc -c <"$log")
# One line per step: a line that arrives while the REPL is busy can be lost.
echo "try { await (new (Object.getPrototypeOf(async function(){}).constructor)(await fs.readFile('$session/step-$id.js','utf8')))() } finally { console.log('__END_${id}__') }" >>"$dir/cmds.txt"

for _ in $(seq 1 $((timeout * 2))); do
  if tail -c +$((start + 1)) "$log" | grep -q "__END_${id}__"; then
    break
  fi
  sleep 0.5
done

tail -c +$((start + 1)) "$log" | strip | grep -v "__END_${id}__" || true
if ! tail -c +$((start + 1)) "$log" | grep -q "__END_${id}__"; then
  echo "No end marker after ${timeout} s: the step may still be running." >&2
  exit 1
fi
