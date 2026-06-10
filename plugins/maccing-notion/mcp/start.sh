#!/usr/bin/env bash
# Launcher for the bundled Notion MCP server (Bun, zero-dependency, full Notion API at 2026-03-11).
#
# Registered by ../.mcp.json as the `notion` stdio server. Resolves the NOTION_TOKEN secret
# in this order — first hit wins, and the token is NEVER committed:
#   1. plugin-local secrets.env  (gitignored, beside this script)
#   2. legacy ~/.claude/mcp/notion/secrets.env  (back-compat with a pre-plugin setup)
#   3. NOTION_TOKEN already in the environment  (forwarded by .mcp.json `env`)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for secret in "$DIR/secrets.env" "$HOME/.claude/mcp/notion/secrets.env"; do
  if [ -f "$secret" ]; then
    # shellcheck source=/dev/null
    source "$secret"
    break
  fi
done

export NOTION_VERSION="${NOTION_VERSION:-2026-03-11}"

# Bun is self-contained on a stable path; prefer it from PATH, fall back to ~/.bun/bin.
BUN="$HOME/.bun/bin/bun"
command -v bun >/dev/null 2>&1 && BUN="$(command -v bun)"

exec "$BUN" "$DIR/server.ts"
