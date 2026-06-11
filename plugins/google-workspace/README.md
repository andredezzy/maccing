# google-workspace plugin · v0.1.2

A self-hosted Google Workspace MCP server for Claude Code, built on [`taylorwilsdon/google_workspace_mcp`](https://github.com/taylorwilsdon/google_workspace_mcp) (PyPI package pinned to `workspace-mcp==1.21.2`). Runs as a per-session stdio process — no daemon, no daily re-authorization. An alternative to the official Claude Google connector that keeps you on your own OAuth client and Google account.

Supported services: **Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts.**

---

## Prerequisites

- A Google account.
- [`uv`](https://github.com/astral-sh/uv) (and its `uvx` command) installed on your machine:
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
  After installing, open a new terminal (or `source ~/.bashrc` / `source ~/.zshrc`) so `uvx` is on your PATH.

---

## Google Cloud setup

### 1. Create a project and enable APIs

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or reuse an existing one).
2. Navigate to **APIs & Services → Library** and enable each API you want to use:
   - Google Calendar API
   - Gmail API
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
   - Google Forms API
   - Google Tasks API
   - Google Chat API
   - People API (Contacts)

### 2. Create an OAuth client ID

1. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Choose **Desktop app** (simplest — no redirect URI needed) or **Web application**.
   - If you choose **Web application**, add the redirect URI: `http://localhost:8000/oauth2callback`
3. Download or copy the **Client ID** and **Client Secret** — you will need them in the next step.

### 3. Publish the OAuth consent screen

This step is critical. Go to **APIs & Services → OAuth consent screen** and:

1. Fill in the app name, support email, and developer contact.
2. Add the scopes for the APIs you enabled.
3. Click **Publish App** (move from "Testing" to "Production").

> **Why this matters:** Apps left in "Testing" status have refresh tokens that expire after **7 days**, requiring you to re-authorize every week. Publishing the consent screen removes this limitation and keeps the credentials valid indefinitely (as long as you do not revoke them).

---

## Secrets

From the plugin directory (`plugins/google-workspace/`), copy the example file and fill in your credentials:

```bash
cp mcp/secrets.env.example mcp/secrets.env
```

Then edit `secrets.env` and set:

```bash
export GOOGLE_OAUTH_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
export GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-<your-secret>
export USER_GOOGLE_EMAIL=you@gmail.com
```

The `secrets.env` file is gitignored by the repo's `.gitignore` pattern `plugins/*/mcp/secrets.env` and is never committed.

**Legacy fallback:** If `secrets.env` is absent, the launcher also checks `~/.claude/mcp/workspace-mcp/secrets.env` — useful if you previously ran the workspace-mcp daemon and already have credentials stored there.

---

## Install

This plugin ships as part of the [`maccing`](https://github.com/andredezzy/maccing) Claude Code plugin marketplace. Once the marketplace is configured in your Claude Code setup, enable the plugin. The MCP server starts automatically per session via `mcp/start.sh` (registered as the `workspace` stdio server in `.mcp.json`).

Workspace tools are exposed to Claude under the namespace:

```
mcp__plugin_google-workspace_workspace__<tool_name>
```

For example: `mcp__plugin_google-workspace_workspace__list_events`, `mcp__plugin_google-workspace_workspace__search_gmail_messages`, and so on.

### Tool tiers

The launcher exposes tools in one of three tiers, controlled by the `WORKSPACE_MCP_TOOL_TIER` env var (set in `secrets.env` or exported):

| Tier | Description |
|---|---|
| `core` | Essential read/write tools only (smallest surface) |
| `extended` | Core + additional management tools |
| `complete` | All 121 tools across all services (default) |

The launcher defaults to `complete` if the variable is unset.

---

## First-run authentication

The first time Claude calls any Workspace tool in a new session, the MCP server will:

1. Open your default browser to the Google OAuth consent page.
2. After you grant consent, Google redirects to `http://localhost:8000/oauth2callback`.
3. The server exchanges the authorization code for tokens and saves the encrypted credentials to `~/.google_workspace_mcp/credentials/` (file permissions `0600`).

The OAuth callback page is a minimalist, Midday-style design with full light/dark mode support (via `prefers-color-scheme`), WCAG AA contrast, and no external assets. It is rendered by `mcp/auth_pages.py` and patched into the upstream server at launch time by `mcp/launch.py` (a monkeypatch shim that runs before `workspace-mcp`'s server modules are imported). Preview renders live in `mcp/previews/`.

Subsequent calls in the same session — and future sessions — reuse the cached tokens. Tokens are refreshed automatically against Google; you will not be prompted again unless you explicitly revoke access.

If the tool call times out before you complete the browser flow, just retry the same tool call with the `user_google_email` parameter set to your email address.

---

## Companion skill

The plugin ships a companion skill named **`google-workspace`** (at `skills/google-workspace/`). It is the canonical reference for:

- Account-isolation rule — always use `mcp__plugin_google-workspace_workspace__*`; never the `mcp__claude_ai_*` Google connectors (they are wired to a different account).
- First-run OAuth flow, credential storage, and reset procedure (`references/auth-and-credentials.md`).
- Full tool inventory by service with common workflows and parameter gotchas (`references/tools.md`).
- Google Cloud setup, tool tiers, and secrets (`references/setup.md`).

One key rule the skill enforces: **always reuse the existing calendar color pattern.** André color-codes his calendar events; any event created by Claude must match the color used for same-type events rather than falling back to the calendar default. Fetch individual events via `get_events` with `detailed=true` to read their `Color ID`, sample more than one, treat any colored same-type event as the pattern, then pass `color_id` to `manage_event`.

---

## Troubleshooting

**Port 8000 already in use during first-run auth**
The OAuth callback server needs port 8000. If something else is already listening on it (often a leftover `workspace-mcp` daemon from a previous setup), stop that process first:

```bash
lsof -ti :8000 | xargs kill -9
```

**Re-auth required every ~7 days**
Your OAuth consent screen is still in "Testing" mode. Go to **APIs & Services → OAuth consent screen** and publish the app (see Google Cloud setup, step 3).

**Reset credentials**
To force a full re-authorization (e.g., after changing scopes or switching accounts), delete the cached credentials:

```bash
rm -rf ~/.google_workspace_mcp/credentials/
```

The next tool call will trigger the browser consent flow again.
