# google-workspace plugin — design

**Date:** 2026-06-11
**Status:** Approved (brainstorm), pending spec review
**Repo:** `~/www/Andre-Dezzy/maccing` · branch `google-workspace-plugin`

## Goal

Package André's self-hosted Google Workspace MCP setup (Calendar, Gmail, Drive, Docs,
Sheets, Slides, Forms, Tasks, Chat, Contacts for `andrevcv1@gmail.com`) as a publishable
plugin in the `maccing` marketplace — mirroring `maccing-notion` — and migrate off the
current launchd HTTP daemon, eliminating the daily re-authorization problem.

## Background — why this design

The current setup runs `uvx workspace-mcp --transport streamable-http` as a launchd
daemon (`com.workspacemcp.server`) on `:8000` in **OAuth 2.1 mode**
(`MCP_ENABLE_OAUTH21=true`). Investigation traced the **daily re-auth** to FastMCP's
OAuth-proxy: it rotates its client refresh token on *every* refresh and deletes the old
one immediately with **no reuse grace window**, while issuing a **1-hour** access token.
Claude Code's concurrent refreshes race the rotation → `invalid_grant` → forced re-login.
None of: server restarts, token-store churn, refresh-token expiry (1 year), or Google's
7-day testing expiry were the cause.

**Key realization:** that whole bug class only exists in the OAuth-proxy / streamable-http
mode. Running workspace-mcp in **stdio single-user mode** uses Google OAuth directly
(creds cached locally, refreshed against Google) with **no FastMCP token rotation** — so
the daily re-auth simply cannot occur. The TTL patch / fork that would be needed for the
HTTP mode becomes unnecessary.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Transport / auth | **stdio, single-user** (no FastMCP OAuth proxy) |
| Plugin contents | **MCP server + companion skill** |
| Cutover | **Full**: retire launchd daemon, reuse existing Google client creds, rewrite global `CLAUDE.md` |
| Plugin name | **`google-workspace`** (drops the `maccing-` prefix used by siblings — accepted) |
| Skill scope | **Both setup/ops + usage**, one skill, split via `references/` |
| Version pin | **Pin** `workspace-mcp==1.21.2` (current PyPI latest) for reproducible publishing |
| Credentials dir | **Default** `~/.google_workspace_mcp/credentials/` |

## Architecture

Claude Code spawns the plugin's `mcp/start.sh` as a **stdio subprocess** per session
(exactly like `maccing-notion`'s Bun server, but here `start.sh` execs `uvx workspace-mcp`).
The server authenticates to Google directly and caches encrypted credentials on disk; later
sessions reuse + silently refresh them. No background daemon, no HTTP port held open during
normal use (port 8000 is used only transiently for the one-time OAuth callback).

### File layout — `plugins/google-workspace/`

```
plugins/google-workspace/
├── .claude-plugin/plugin.json          # manifest (name, version, description, author, keywords)
├── .mcp.json                           # registers stdio server "workspace"
├── README.md                           # install + Google Cloud OAuth setup + publish-consent-screen note
├── mcp/
│   ├── start.sh                        # launcher: resolve secrets, exec uvx workspace-mcp --transport stdio
│   └── secrets.env.example             # GOOGLE_OAUTH_CLIENT_ID / _SECRET / USER_GOOGLE_EMAIL
└── skills/google-workspace/
    ├── SKILL.md                        # thin overview + when-to-use + routing to references
    └── references/
        ├── setup.md                    # Cloud OAuth client; single-user stdio; PUBLISH consent screen (avoid 7-day reauth)
        ├── auth-and-credentials.md     # first-time flow; creds dir + encryption; account-isolation guardrail
        └── tools.md                    # tool inventory by service; workflows; gotchas; SP-timezone + single-user-email defaults
```

Plus: a marketplace entry appended to `.claude-plugin/marketplace.json`. No `.gitignore`
change needed — `plugins/*/mcp/secrets.env` is already ignored.

### `.mcp.json`

Server name **`workspace`** (avoids the redundant `google-workspace_google-workspace`).
Resulting tool surface: `mcp__plugin_google-workspace_workspace__*`.

```json
{
  "mcpServers": {
    "workspace": {
      "command": "${CLAUDE_PLUGIN_ROOT}/mcp/start.sh",
      "env": {
        "GOOGLE_OAUTH_CLIENT_ID": "${GOOGLE_OAUTH_CLIENT_ID}",
        "GOOGLE_OAUTH_CLIENT_SECRET": "${GOOGLE_OAUTH_CLIENT_SECRET}",
        "USER_GOOGLE_EMAIL": "${USER_GOOGLE_EMAIL}"
      }
    }
  }
}
```

### `mcp/start.sh` (sketch)

First-hit-wins secret resolution, identical pattern to `maccing-notion`:

```bash
#!/usr/bin/env bash
# Launcher for the bundled Google Workspace MCP server (single-user, stdio).
# Registered by ../.mcp.json. Secrets resolved first-hit-wins, never committed:
#   1. plugin-local secrets.env (gitignored, beside this script)
#   2. legacy ~/.claude/mcp/workspace-mcp/secrets.env  (reuse existing Google client creds)
#   3. env already set (forwarded by .mcp.json `env`)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for secret in "$DIR/secrets.env" "$HOME/.claude/mcp/workspace-mcp/secrets.env"; do
  if [ -f "$secret" ]; then
    # shellcheck source=/dev/null
    source "$secret"
    break
  fi
done

export OAUTHLIB_INSECURE_TRANSPORT="${OAUTHLIB_INSECURE_TRANSPORT:-1}"
export WORKSPACE_MCP_TOOL_TIER="${WORKSPACE_MCP_TOOL_TIER:-complete}"
# NOTE: deliberately does NOT set MCP_ENABLE_OAUTH21 — stdio single-user mode avoids
# the FastMCP OAuth-proxy refresh-token rotation that caused daily re-auth.

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
exec uvx "workspace-mcp==1.21.2" --transport stdio
```

Pinned to `1.21.2` (current PyPI latest); bump deliberately on upgrade.

### `mcp/secrets.env.example`

```bash
# Copy to `secrets.env` (gitignored) and fill in, OR export these in your shell —
# .mcp.json forwards them. Create the OAuth client at console.cloud.google.com
# (APIs & Services → Credentials → OAuth client ID, type "Desktop app" or "Web app").
export GOOGLE_OAUTH_CLIENT_ID=xxxxxxx.apps.googleusercontent.com
export GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
export USER_GOOGLE_EMAIL=you@gmail.com   # single-user default; streamlines consent
```

## Auth / data flow

1. Claude Code launches `start.sh` (stdio).
2. First Google tool call with no cached creds → server starts a local callback listener,
   opens the browser to Google consent; if it can't open, the tool result returns the URL.
3. User authorizes; callback hits `http://localhost:8000/oauth2callback` (already registered
   in the existing OAuth client). Creds written encrypted, `0o600`, to
   `~/.google_workspace_mcp/credentials/`.
4. Retry the tool with `user_google_email`. Subsequent sessions reuse + refresh against
   Google directly. **No FastMCP rotation → no daily re-auth.**
5. Residual re-auth trigger: Google expires refresh tokens after 7 days for apps in
   **Testing** publishing status. Fix = publish the OAuth consent screen (documented in
   `setup.md` / README), not a code change.

## Companion skill — `google-workspace:google-workspace`

Thin `SKILL.md` (overview, when-to-use, routing) over three references:

- **`setup.md`** — create the Google Cloud OAuth client; enable the Workspace APIs;
  single-user stdio configuration; **publish the consent screen** to avoid the 7-day
  test-mode re-auth; plugin install/secrets.
- **`auth-and-credentials.md`** — first-run browser flow; credential storage location +
  encryption; troubleshooting; the **account-isolation guardrail** (never use the
  `mcp__claude_ai_Google_*` / `mcp__claude_ai_Gmail__*` connector tools — they point at a
  different, unrelated Google account; always use the plugin's `workspace` tools).
- **`tools.md`** — tool inventory grouped by service (Calendar, Gmail, Drive, Docs, Sheets,
  Slides, Forms, Tasks, Chat, Contacts); common workflows; parameter gotchas;
  `America/Sao_Paulo` timezone + pt-BR + single-user-email defaults.

Authored via `superpowers:writing-skills`.

## Cutover (full)

1. **Stop the daemon:** `launchctl bootout gui/$(id -u)/com.workspacemcp.server` (fallback
   `launchctl unload ~/Library/LaunchAgents/com.workspacemcp.server.plist`); remove/relocate
   the plist so it no longer loads at login. Confirm `:8000` is free.
2. **Remove the old HTTP MCP registration:** delete the `mcpServers."workspace-mcp"` block
   in `~/.claude.json` (`{"type":"http","url":"http://localhost:8000/mcp"}`, ~lines 776–778)
   and clear its stale entry in `~/.claude/mcp-needs-auth-cache.json`, so the old HTTP server
   (behind `mcp__workspace-mcp__authenticate`) does not shadow the plugin's tools.
3. **Keep** `~/.claude/mcp/workspace-mcp/secrets.env` (the legacy fallback `start.sh` reads
   for the Google client creds). The rest of that dir can be archived.
4. **Rewrite global `CLAUDE.md`** "My Accounts" section (see below).

### CLAUDE.md rewrite (the "My Google Workspace" portion)

- Point at the plugin's stdio server; reference the new tool prefix
  `mcp__plugin_google-workspace_workspace__*`.
- **Keep** the connector guardrail (never use `mcp__claude_ai_*` Google tools — different
  account `nicolas1120201@gmail.com`).
- **Drop** the HTTP `mcp__workspace-mcp__authenticate` / `complete_authentication` flow and
  the "Known issue — daily re-auth" blockquote (both obsolete in stdio mode).
- Add: first use triggers a one-time browser consent (single-user); if re-auth recurs ~weekly,
  publish the OAuth consent screen.

## Testing / verification

- `bash plugins/google-workspace/mcp/start.sh </dev/null` boots into stdio without error
  (server waits on stdin); `uvx "workspace-mcp==1.21.2"` resolves.
- Daemon retired: `:8000` free; no `mcp__workspace-mcp__*` tools remain in a fresh session.
- After the one-time browser auth, a live `list calendars` / list-events for
  `andrevcv1@gmail.com` succeeds through `mcp__plugin_google-workspace_workspace__*`.
- `plugin.json` + `marketplace.json` validate (loadable plugin); skill discoverable as
  `google-workspace:google-workspace`.

## Error handling

- `start.sh`: `set -euo pipefail`; missing `uvx` → clear failure (not silent). Missing
  secrets → server errors on first auth; README explains.
- No swallowed errors anywhere.

## Out of scope (YAGNI)

- The `fastmcp_access_token_expiry_seconds` TTL patch and a workspace-mcp fork — unnecessary
  in stdio mode.
- Hosted / multi-tenant remote deployment.
- An upstream FastMCP grace-window PR (the genuinely-correct fix for the HTTP mode) — noted
  for reference only; not part of this plugin.

## Assumptions

- The existing Google OAuth client already has `http://localhost:8000/oauth2callback`
  registered (true — used by the current daemon).
- Single user (`andrevcv1@gmail.com`); no multi-account requirement.
- `uvx`/`uv` remains on `~/.local/bin` (current `start.sh` path).
