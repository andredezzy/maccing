#!/usr/bin/env bash
# Launcher for the bundled Google Workspace MCP server (single-user, stdio).
#
# Registered by ../.mcp.json as the `workspace` stdio server. Secrets are resolved
# first-hit-wins, and are NEVER committed:
#   1. plugin-local secrets.env  (gitignored, beside this script)
#   2. legacy ~/.claude/mcp/workspace-mcp/secrets.env  (reuse pre-plugin Google client creds)
#   3. env already in the environment  (forwarded by .mcp.json `env`)
#
# Runs in STDIO single-user mode and deliberately does NOT set MCP_ENABLE_OAUTH21 —
# that legacy mode authenticates to Google directly (creds cached locally, refreshed
# against Google) with no FastMCP refresh-token rotation, which is what caused the
# daily re-authorization in the previous streamable-http / OAuth-2.1 daemon.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for secret in "$DIR/secrets.env" "$HOME/.claude/mcp/workspace-mcp/secrets.env"; do
  if [ -f "$secret" ]; then
    # shellcheck source=/dev/null
    source "$secret"
    break
  fi
done

export OAUTHLIB_INSECURE_TRANSPORT=1  # required: the OAuth callback is localhost HTTP
export WORKSPACE_MCP_TOOL_TIER="${WORKSPACE_MCP_TOOL_TIER:-complete}"

# uv/uvx self-install to ~/.local/bin; prepend it so the launcher finds them.
export PATH="$HOME/.local/bin:$PATH"

exec uvx --from "workspace-mcp==1.21.2" python "$DIR/launch.py" --transport stdio
