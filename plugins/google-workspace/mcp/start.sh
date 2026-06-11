#!/usr/bin/env bash
# Launcher for the bundled Google Workspace MCP server (single-user, stdio).
#
# Registered by ../.mcp.json as the `workspace` stdio server. Secrets are NEVER committed:
#   1. plugin-local .env.local  (gitignored, beside this script — copy .env -> .env.local and fill in)
#   2. otherwise whatever is already exported in the environment  (forwarded by .mcp.json `env`)
#
# Runs in STDIO single-user mode and deliberately does NOT set MCP_ENABLE_OAUTH21 —
# that legacy mode authenticates to Google directly (creds cached locally, refreshed
# against Google) with no FastMCP refresh-token rotation, which is what caused the
# daily re-authorization in the previous streamable-http / OAuth-2.1 daemon.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
[ -f "$DIR/.env.local" ] && source "$DIR/.env.local"

export OAUTHLIB_INSECURE_TRANSPORT=1  # required: the OAuth callback is localhost HTTP
export WORKSPACE_MCP_TOOL_TIER="${WORKSPACE_MCP_TOOL_TIER:-complete}"

# uv/uvx self-install to ~/.local/bin; prepend it so the launcher finds them.
export PATH="$HOME/.local/bin:$PATH"

exec uvx --from "workspace-mcp==1.21.2" python "$DIR/launch.py" --transport stdio
