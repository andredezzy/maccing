#!/usr/bin/env bash
# Closes a session started by repl-start.sh, which launches it, when the
# session sits idle or its REPL ends. Agents that crash or forget repl-stop.sh
# then leave nothing running.
#
# Usage: bash repl-watchdog.sh <session dir> <idle minutes> <aside repl pid>
#
# Idle means no step sent (cmds.txt) and no output (out.log) for the whole
# window. A step whose end marker has not printed yet counts as running, even
# when it prints nothing.

set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
dir=$1
minutes=$2
repl=$3

while sleep 10; do
  if ! ps -p "$repl" -o command= 2>/dev/null | grep -q 'aside repl'; then
    exec bash "$here/repl-stop.sh" "$dir" "the aside repl process ended"
  fi
  marker=$(grep -o '__END_[0-9]*__' "$dir/cmds.txt" | tail -n 1)
  if [ -n "$marker" ] && ! grep -q "$marker" "$dir/out.log"; then
    continue
  fi
  last=$(stat -f %m "$dir/cmds.txt" "$dir/out.log" | sort -n | tail -n 1)
  if [ $(($(date +%s) - last)) -ge $((minutes * 60)) ]; then
    exec bash "$here/repl-stop.sh" "$dir" "idle for $minutes min, closed by the watchdog"
  fi
done
