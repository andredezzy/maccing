#!/usr/bin/env bash
# Stops the `aside repl` session started from <dir> by repl-start.sh: its
# watchdog, its tail feeder and the REPL. Safe to run when nothing runs.
#
# Usage: bash repl-stop.sh <session dir> [reason, written to out.log]
#
# Matches processes on the folder's full path, so other folders' sessions
# stay up. In the patterns, [+] is a literal plus: pgrep reads + as a regex
# quantifier.

set -uo pipefail

dir=$(cd "$1" 2>/dev/null && pwd -P) || {
  echo "No session folder $1."
  exit 0
}
reason=${2:-stopped by repl-stop.sh}
repl=$(cat "$dir/repl.pid" 2>/dev/null)

alive() { [ -n "$repl" ] && ps -p "$repl" -o command= 2>/dev/null | grep -q 'aside repl'; }

pkill -f "repl-watchdog[.]sh $dir " 2>/dev/null
feeder="tail -n [+]1 -f $dir/cmds.txt"
stopped=false
if alive || pgrep -f "$feeder" >/dev/null; then
  stopped=true
  echo exit >>"$dir/cmds.txt"
fi
pkill -f "$feeder" 2>/dev/null
for _ in 1 2 3 4 5 6; do
  alive || break
  sleep 0.5
done
alive && kill "$repl"
rm -f "$dir/repl.pid"

if $stopped; then
  # The REPL's prompt ends without a newline, so start a line of our own.
  printf '\n[session closed %s] %s. Start a new one with repl-start.sh.\n' "$(date '+%F %T')" "$reason" >>"$dir/out.log"
  echo "Stopped the session in $dir: $reason."
else
  echo "No session running in $dir."
fi
