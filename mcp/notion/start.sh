#!/usr/bin/env bash
# Launcher for the bundled Notion MCP server (Bun, official MCP SDK, full Notion API at 2026-03-11).
#
# Registered by the repo-root .mcp.json as the `notion` stdio server. Secrets are NEVER committed.
# Load order (last source wins — .env.local overrides the stable file):
#   1. ${MACCING_NOTION_ENV:-$HOME/.config/maccing/notion.env}  — stable per-user secrets file,
#      outside the repo and cache; survives plugin version bumps. Create once, chmod 600.
#   2. plugin-local .env.local  (gitignored, beside this script — dev override; copy .env -> .env.local)
#   3. whatever is already exported in the environment  (forwarded by .mcp.json `env`)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
for envfile in "${MACCING_NOTION_ENV:-$HOME/.config/maccing/notion.env}" "$DIR/.env.local"; do
  if [ -f "$envfile" ]; then
    set -a
    . "$envfile"
    set +a
  fi
done

export NOTION_VERSION="${NOTION_VERSION:-2026-03-11}"

# Bun is self-contained on a stable path; prefer it from PATH, fall back to ~/.bun/bin.
BUN="$HOME/.bun/bin/bun"
command -v bun >/dev/null 2>&1 && BUN="$(command -v bun)"

# Runtime deps (the MCP SDK + zod) live in node_modules, which is gitignored and so absent from a
# freshly-installed plugin. Install them once per plugin version. stdout is the JSON-RPC channel,
# so route all install output to stderr — it must never reach the client.
if [ ! -d "$DIR/node_modules" ]; then
  (cd "$DIR" && "$BUN" install) 1>&2
fi

exec "$BUN" "$DIR/src/server.ts"
