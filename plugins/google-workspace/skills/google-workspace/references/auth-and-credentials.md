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

The launcher does not set `MCP_ENABLE_OAUTH21`. In stdio single-user mode tokens refresh directly against Google's token endpoint — there is no FastMCP OAuth-proxy refresh-token rotation, so no daily re-authorization.

## Reset credentials

To force full re-authorization (e.g. after changing scopes, switching accounts, or if tokens become corrupt):

```bash
rm -rf ~/.google_workspace_mcp/credentials/
```

The next tool call will trigger the browser consent flow again.

7-day re-auth cycle? The OAuth consent screen is still in "Testing" mode — see setup.md → "Publish the OAuth consent screen".

**Account isolation:** act only as `andrevcv1@gmail.com` through the `workspace` tools — never the `mcp__claude_ai_*` Google connectors (different account). Full rule: see SKILL.md.
