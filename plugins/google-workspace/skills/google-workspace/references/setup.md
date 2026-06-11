# Setup reference

Part of the `google-workspace` skill — loaded on demand from `SKILL.md`.

## Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse one).
2. Navigate to **APIs & Services → Library** and enable each API you need:
   - Google Calendar API
   - Gmail API
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Google Forms API
   - Google Tasks API
   - Google Chat API
   - People API (for Contacts)

## OAuth client ID

1. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Choose **Desktop app** (simplest — no redirect URI needed) or **Web application**.
   - Web app requires the redirect URI: `http://localhost:8000/oauth2callback`
3. Copy the **Client ID** and **Client Secret**.

## Publishing the OAuth consent screen

**This step is critical.** Go to **APIs & Services → OAuth consent screen** and:

1. Fill in app name, support email, and developer contact.
2. Add the scopes for the APIs you enabled.
3. Click **Publish App** (move from "Testing" to "Production").

> Apps left in "Testing" status have refresh tokens that expire after **7 days**, requiring weekly re-authorization. Publishing removes this limitation — credentials stay valid indefinitely unless explicitly revoked.

## Secrets

Secrets live in `plugins/google-workspace/mcp/.env.local` (gitignored), or already-exported env vars; never committed.

```bash
cp plugins/google-workspace/mcp/.env plugins/google-workspace/mcp/.env.local
# then edit .env.local and fill in:
export GOOGLE_OAUTH_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
export GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-<your-secret>
export USER_GOOGLE_EMAIL=andrevcv1@gmail.com
```

`.env.local` is gitignored by the repo's `.gitignore` pattern `**/.env.local`; `mcp/.env` is the committed template.

## Tool tier

Select which tools are exposed via the `WORKSPACE_MCP_TOOL_TIER` env var (set in `.env.local` or exported):

| Tier | Description |
|---|---|
| `core` | Essential read/write tools only (smallest surface) |
| `extended` | Core + additional management tools |
| `complete` | All 121 tools across all services (default in `start.sh`) |

The launcher (`mcp/start.sh`) defaults to `complete` if the variable is unset.

## Pinned package

The launcher runs `uvx "workspace-mcp==1.21.2" --transport stdio`. Requires [`uv`](https://github.com/astral-sh/uv):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

(Skip if `uv` is already installed — check with `which uv`.)
