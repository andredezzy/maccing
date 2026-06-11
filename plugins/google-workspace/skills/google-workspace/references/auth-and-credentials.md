# Auth and credentials reference

Part of the `google-workspace` skill — loaded on demand from `SKILL.md`.

## First-run browser flow

The first time Claude calls any Workspace tool in a new session, the MCP server:

1. Opens your default browser to the Google OAuth consent page.
2. After you grant consent, Google redirects to `http://localhost:8000/oauth2callback`.
3. The server exchanges the authorization code for tokens and saves encrypted credentials to `~/.google_workspace_mcp/credentials/` (file permissions `0600`).

If the tool call times out before you complete the browser flow, **retry the same tool call with `user_google_email` set to `andrevcv1@gmail.com`** — this re-triggers the auth prompt.

**Port 8000 conflict:** If something is already listening on port 8000 (common if a legacy `workspace-mcp` daemon is running), stop it first:

```bash
lsof -ti :8000 | xargs kill -9
```

## Credential storage

| Location | Detail |
|---|---|
| Default dir | `~/.google_workspace_mcp/credentials/` |
| File mode | `0600` (owner-read/write only, never world-readable) |
| Format | Encrypted token files, one per service/account |
| Override | Set `WORKSPACE_MCP_CREDENTIALS_DIR` env var to use a different path |

Subsequent calls reuse cached tokens. Tokens are refreshed automatically against Google — you will not be prompted again unless you explicitly revoke access or reset credentials.

## Why there is no daily re-auth in stdio mode

The launcher deliberately does **not** set `MCP_ENABLE_OAUTH21`. In stdio mode the server authenticates directly to Google using locally-cached credentials and refreshes tokens against Google's token endpoint — there is no FastMCP OAuth-proxy layer and no refresh-token rotation cycle. The previous streamable-http daemon ran behind a FastMCP OAuth 2.1 proxy whose rotation caused daily re-authorization; that architecture has been removed.

## Reset credentials

To force full re-authorization (e.g. after changing scopes, switching accounts, or if tokens become corrupt):

```bash
rm -rf ~/.google_workspace_mcp/credentials/
```

The next tool call will trigger the browser consent flow again.

## 7-day expiry on test-mode apps

If re-auth is required every ~7 days, the OAuth consent screen is still in "Testing" mode. Go to **APIs & Services → OAuth consent screen** in Google Cloud console and publish the app (see `references/setup.md`).

## Account-isolation guardrail

**Always use `mcp__plugin_google-workspace_workspace__*` tools for `andrevcv1@gmail.com`.**

Never use:
- `mcp__claude_ai_Google_Calendar__*`
- `mcp__claude_ai_Gmail__*`
- `mcp__claude_ai_Google_Drive__*`

Those connectors are wired to `nicolas1120201@gmail.com` — a completely different, unrelated Google account. Using them on André's behalf would read/write the wrong account silently.
