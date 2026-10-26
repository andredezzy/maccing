#!/usr/bin/env bash
# Starts a long-lived `aside repl` session fed by <dir>/cmds.txt, with a
# watchdog that closes it once it sits idle. See references/terminal.md,
# "A session that outlives the call".
#
# Usage: bash repl-start.sh <session dir> <account> [idle minutes, default 10]
#
# A session already running from the same folder is stopped first. The script
# waits for the REPL to answer and prints its account: and sessionDir: lines.
#
# Needs: repl-stop.sh and repl-watchdog.sh beside it.

set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
mkdir -p "$1"
dir=$(cd "$1" && pwd -P)
account=$2
minutes=${3:-10}

bash "$here/repl-stop.sh" "$dir" >/dev/null

: >"$dir/cmds.txt"
tail -n +1 -f "$dir/cmds.txt" | aside repl --account "$account" >"$dir/out.log" 2>&1 &
repl=$!
echo "$repl" >"$dir/repl.pid"
nohup bash "$here/repl-watchdog.sh" "$dir" "$minutes" "$repl" >/dev/null 2>&1 &

for _ in $(seq 1 60); do
  if grep -q 'sessionDir: ' "$dir/out.log"; then
    sed 's/\x1b\[[0-9;]*m//g' "$dir/out.log" | grep -E '^(account|sessionDir): '
    echo "Started in $dir. The watchdog closes it after $minutes min idle; end it with repl-stop.sh."
    exit 0
  fi
  if ! kill -0 "$repl" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

cat "$dir/out.log" >&2
echo "The session did not start in $dir." >&2
bash "$here/repl-stop.sh" "$dir" >/dev/null
exit 1
