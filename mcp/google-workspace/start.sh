#!/usr/bin/env bash
# Launcher for the bundled Google Workspace MCP server (single-user, stdio).
#
# Registered by the repo-root .mcp.json as the `workspace` stdio server. Secrets are NEVER committed.
# Load order (last source wins — .env.local overrides the stable file):
#   1. ${MACCING_WORKSPACE_ENV:-$HOME/.config/maccing/google-workspace.env}  — stable per-user
#      secrets file, outside the repo and cache; survives plugin version bumps. Create once, chmod 600.
#   2. plugin-local .env.local  (gitignored, beside this script — dev override; copy .env -> .env.local)
#   3. whatever is already exported in the environment  (forwarded by .mcp.json `env`)
#
# Runs in STDIO single-user mode and deliberately does NOT set MCP_ENABLE_OAUTH21 —
# that legacy mode authenticates to Google directly (creds cached locally, refreshed
# against Google) with no FastMCP refresh-token rotation, which is what caused the
# daily re-authorization in the previous streamable-http / OAuth-2.1 daemon.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=/dev/null
for envfile in "${MACCING_WORKSPACE_ENV:-$HOME/.config/maccing/google-workspace.env}" "$DIR/.env.local"; do
  if [ -f "$envfile" ]; then
    set -a
    . "$envfile"
    set +a
  fi
done

export OAUTHLIB_INSECURE_TRANSPORT=1  # required: the OAuth callback is localhost HTTP
export WORKSPACE_MCP_TOOL_TIER="${WORKSPACE_MCP_TOOL_TIER:-complete}"

# uv/uvx self-install to ~/.local/bin; prepend it so the launcher finds them.
export PATH="$HOME/.local/bin:$PATH"

exec uvx --from "workspace-mcp==1.21.2" python "$DIR/launch.py" --transport stdio
