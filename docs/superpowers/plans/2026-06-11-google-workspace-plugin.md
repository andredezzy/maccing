# google-workspace plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Skill-authoring tasks (Task 6) MUST additionally use superpowers:writing-skills.

**Goal:** Package André's self-hosted Google Workspace MCP as a publishable `google-workspace` plugin in the `maccing` marketplace, running in stdio single-user mode (no FastMCP OAuth proxy → no daily re-auth), and fully cut over from the existing launchd HTTP daemon.

**Architecture:** Claude Code spawns `mcp/start.sh` as a stdio subprocess per session; it execs `uvx workspace-mcp==1.21.2 --transport stdio`, which authenticates to Google directly and caches encrypted creds in `~/.google_workspace_mcp/credentials/`. Mirrors the `maccing-notion` plugin shape. Cutover retires the `com.workspacemcp.server` launchd daemon and the `~/.claude.json` HTTP registration, and rewrites the global `CLAUDE.md`.

**Tech Stack:** Claude Code plugin (`.claude-plugin/plugin.json` + `.mcp.json`), Bash launcher, `uvx`/`uv` (Python), `taylorwilsdon/google_workspace_mcp` (PyPI `workspace-mcp`), launchd, Markdown skill.

**Reference spec:** `docs/superpowers/specs/2026-06-11-google-workspace-plugin-design.md`

**Working dir / branch:** `~/www/Andre-Dezzy/maccing`, branch `google-workspace-plugin` (already created). Leave the pre-existing unrelated `plugins/maccing-notion/...` working-tree edits unstaged — never `git add -A`; stage explicit paths only.

---

## File Structure

**Create (in repo):**
- `plugins/google-workspace/.claude-plugin/plugin.json` — plugin manifest
- `plugins/google-workspace/.mcp.json` — registers stdio server `workspace`
- `plugins/google-workspace/mcp/start.sh` — launcher (executable)
- `plugins/google-workspace/mcp/secrets.env.example` — secret template
- `plugins/google-workspace/README.md` — install + OAuth setup
- `plugins/google-workspace/skills/google-workspace/SKILL.md` — skill entry
- `plugins/google-workspace/skills/google-workspace/references/setup.md`
- `plugins/google-workspace/skills/google-workspace/references/auth-and-credentials.md`
- `plugins/google-workspace/skills/google-workspace/references/tools.md`

**Modify (in repo):**
- `.claude-plugin/marketplace.json` — append plugin entry

**Modify (outside repo — home dir; NOT committed):**
- `~/.claude/CLAUDE.md` — rewrite "My Google Workspace" portion
- `~/.claude.json` — remove `mcpServers."workspace-mcp"` block
- `~/.claude/mcp-needs-auth-cache.json` — clear stale `workspace-mcp` entry
- launchd: unload + remove `~/Library/LaunchAgents/com.workspacemcp.server.plist` (confirm actual plist path during Task 7)

---

## Task 1: Plugin manifest + directory scaffold

**Files:**
- Create: `plugins/google-workspace/.claude-plugin/plugin.json`

- [ ] **Step 1: Create the manifest**

```json
{
  "name": "google-workspace",
  "version": "0.1.0",
  "description": "Self-hosted Google Workspace MCP for coding agents: Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts via taylorwilsdon/google_workspace_mcp, run in stdio single-user mode (no FastMCP OAuth proxy, so no daily re-authorization). Ships a setup + usage skill. An alternative to the official Claude Google connector that keeps you on your own OAuth client and account.",
  "author": {
    "name": "André \"Dezzy\" Victor",
    "email": "contact@andredezzy.com",
    "url": "https://github.com/andredezzy"
  },
  "homepage": "https://github.com/andredezzy/maccing",
  "repository": "https://github.com/andredezzy/maccing",
  "license": "MIT",
  "keywords": ["google-workspace", "gmail", "google-calendar", "google-drive", "docs", "sheets", "tasks", "mcp", "workspace-mcp", "oauth", "stdio", "single-user"]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -m json.tool plugins/google-workspace/.claude-plugin/plugin.json >/dev/null && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/google-workspace/.claude-plugin/plugin.json
git commit -m "google-workspace plugin: add manifest"
```

---

## Task 2: MCP server wiring (.mcp.json + start.sh + secrets template)

**Files:**
- Create: `plugins/google-workspace/.mcp.json`
- Create: `plugins/google-workspace/mcp/start.sh`
- Create: `plugins/google-workspace/mcp/secrets.env.example`

- [ ] **Step 1: Create `.mcp.json`** (server name `workspace`)

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

- [ ] **Step 2: Create `mcp/start.sh`**

```bash
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

export OAUTHLIB_INSECURE_TRANSPORT="${OAUTHLIB_INSECURE_TRANSPORT:-1}"
export WORKSPACE_MCP_TOOL_TIER="${WORKSPACE_MCP_TOOL_TIER:-complete}"

export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

exec uvx "workspace-mcp==1.21.2" --transport stdio
```

- [ ] **Step 3: Make it executable**

Run: `chmod +x plugins/google-workspace/mcp/start.sh && ls -l plugins/google-workspace/mcp/start.sh`
Expected: mode shows `-rwxr-xr-x`

- [ ] **Step 4: Create `mcp/secrets.env.example`**

```bash
# Copy to `secrets.env` (gitignored — matched by repo .gitignore `plugins/*/mcp/secrets.env`),
# fill in, OR export these in your shell (.mcp.json forwards them). The launcher also
# falls back to ~/.claude/mcp/workspace-mcp/secrets.env if this file is absent.
#
# Create the OAuth client at console.cloud.google.com → APIs & Services → Credentials →
# Create credentials → OAuth client ID (type "Desktop app" or "Web app"). For "Web app",
# add the redirect URI http://localhost:8000/oauth2callback. See README.md for full setup.
export GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
export GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
export USER_GOOGLE_EMAIL=you@gmail.com   # single-user default; streamlines consent
```

- [ ] **Step 5: Verify `.mcp.json` valid + `start.sh` syntax OK**

Run:
```bash
python3 -m json.tool plugins/google-workspace/.mcp.json >/dev/null && echo JSON_OK
bash -n plugins/google-workspace/mcp/start.sh && echo BASH_OK
```
Expected: `JSON_OK` then `BASH_OK`

- [ ] **Step 6: Verify the pinned server resolves via uvx (no auth needed)**

Run: `uvx "workspace-mcp==1.21.2" --help >/dev/null 2>&1 && echo RESOLVES`
Expected: `RESOLVES` (downloads/caches the package and prints help to /dev/null). If it fails, confirm `uvx` is on PATH (`command -v uvx`).

- [ ] **Step 7: Commit**

```bash
git add plugins/google-workspace/.mcp.json plugins/google-workspace/mcp/start.sh plugins/google-workspace/mcp/secrets.env.example
git commit -m "google-workspace plugin: stdio MCP server wiring + secrets template"
```

---

## Task 3: README (install + Google Cloud OAuth setup)

**Files:**
- Create: `plugins/google-workspace/README.md`

- [ ] **Step 1: Write the README**

Content MUST include these sections (write them out concretely — no "TBD"):

1. **What it is** — bundles `taylorwilsdon/google_workspace_mcp` (PyPI `workspace-mcp`, pinned `1.21.2`) as a stdio single-user MCP server; an alternative to the official Claude Google connector that keeps you on your own OAuth client/account; runs per-session (no daemon), so there is no daily re-auth.
2. **Prerequisites** — `uv`/`uvx` installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`), a Google account.
3. **Google Cloud setup** — create a project; enable the APIs you want (Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, People); create an OAuth client ID (Desktop app simplest; for Web app add redirect `http://localhost:8000/oauth2callback`); **publish the OAuth consent screen** (Testing status expires refresh tokens after 7 days → periodic re-auth). State this explicitly.
4. **Secrets** — copy `mcp/secrets.env.example` → `mcp/secrets.env`, fill `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `USER_GOOGLE_EMAIL`. Note the legacy fallback path.
5. **Install** — the plugin is part of the `maccing` marketplace; enable it in Claude Code. Tools appear as `mcp__plugin_google-workspace_workspace__*`.
6. **First-run auth** — first Google tool call opens the browser for consent → callback to `http://localhost:8000/oauth2callback` → creds cached at `~/.google_workspace_mcp/credentials/` (encrypted, `0600`). Retry the tool with `user_google_email`.
7. **Troubleshooting** — port 8000 busy (an old daemon still running); re-auth every ~7 days (publish consent screen); reset = delete `~/.google_workspace_mcp/credentials/`.

- [ ] **Step 2: Verify it renders as valid Markdown and references the right paths**

Run: `grep -nE "oauth2callback|workspace-mcp==1.21.2|mcp__plugin_google-workspace_workspace__|secrets.env" plugins/google-workspace/README.md`
Expected: each token appears at least once.

- [ ] **Step 3: Commit**

```bash
git add plugins/google-workspace/README.md
git commit -m "google-workspace plugin: README (Google Cloud OAuth + install + first-run auth)"
```

---

## Task 4: Register the plugin in the marketplace

**Files:**
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Read the current marketplace file**

Run: `cat .claude-plugin/marketplace.json`
(Confirm the `plugins` array currently holds `maccing-growth` and `maccing-notion`.)

- [ ] **Step 2: Append this object to the `plugins` array** (after the `maccing-notion` entry; add a comma after the previous closing `}`)

```json
    {
      "name": "google-workspace",
      "source": "./plugins/google-workspace",
      "description": "Self-hosted Google Workspace MCP (Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, Contacts) via taylorwilsdon/google_workspace_mcp, run in stdio single-user mode — authenticates to Google directly, so no daily re-authorization. Ships a combined setup + usage skill. An alternative to the official Claude Google connector that keeps you on your own OAuth client and account.",
      "version": "0.1.0",
      "author": { "name": "André \"Dezzy\" Victor", "url": "https://github.com/andredezzy" },
      "keywords": ["google-workspace", "gmail", "google-calendar", "google-drive", "docs", "sheets", "tasks", "mcp", "oauth", "stdio"],
      "license": "MIT"
    }
```

- [ ] **Step 3: Verify the whole file is still valid JSON and lists 3 plugins**

Run:
```bash
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null && echo JSON_OK
python3 -c "import json;print([p['name'] for p in json.load(open('.claude-plugin/marketplace.json'))['plugins']])"
```
Expected: `JSON_OK` then `['maccing-growth', 'maccing-notion', 'google-workspace']`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "marketplace: register google-workspace plugin"
```

---

## Task 5: Companion skill scaffold (SKILL.md)

**REQUIRED SUB-SKILL:** invoke `superpowers:writing-skills` before creating/editing any of these files and follow it.

**Files:**
- Create: `plugins/google-workspace/skills/google-workspace/SKILL.md`

- [ ] **Step 1: Invoke writing-skills, then write `SKILL.md`** with YAML frontmatter and a thin body that routes to the references. Frontmatter shape (match `maccing-notion`'s skill conventions; keep `description` trigger-rich and third-person):

```markdown
---
name: google-workspace
description: Use when working with André's self-hosted Google Workspace MCP (the `google-workspace` plugin) — driving Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, or Contacts via the `mcp__plugin_google-workspace_workspace__*` tools, OR setting up / troubleshooting its OAuth (first-run consent, 7-day test-mode re-auth, credential storage). Covers the account-isolation rule (never use the `mcp__claude_ai_*` Google connectors — different account).
---
```

Body (concrete): one-paragraph overview + a "When to use" + a routing list to the three references (setup / auth-and-credentials / tools), plus the single most important inline rule: **Always use `mcp__plugin_google-workspace_workspace__*`; never the `mcp__claude_ai_Google_*` / `mcp__claude_ai_Gmail__*` connectors (different, unrelated account `nicolas1120201@gmail.com`).**

- [ ] **Step 2: Verify frontmatter parses and required keys exist**

Run:
```bash
python3 -c "import re,sys; t=open('plugins/google-workspace/skills/google-workspace/SKILL.md').read(); m=re.match(r'^---\n(.*?)\n---', t, re.S); assert m, 'no frontmatter'; b=m.group(1); assert 'name:' in b and 'description:' in b; print('FRONTMATTER_OK')"
```
Expected: `FRONTMATTER_OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/google-workspace/skills/google-workspace/SKILL.md
git commit -m "google-workspace skill: SKILL.md entry (routing + account-isolation rule)"
```

---

## Task 6: Skill references (setup / auth / tools)

**REQUIRED SUB-SKILL:** continue under `superpowers:writing-skills`.

**Files:**
- Create: `plugins/google-workspace/skills/google-workspace/references/setup.md`
- Create: `plugins/google-workspace/skills/google-workspace/references/auth-and-credentials.md`
- Create: `plugins/google-workspace/skills/google-workspace/references/tools.md`

- [ ] **Step 1: Write `setup.md`** — Google Cloud project; enabling each Workspace API; creating the OAuth client (Desktop vs Web app + the `http://localhost:8000/oauth2callback` redirect for Web app); **publishing the OAuth consent screen** to avoid the 7-day Testing-mode refresh-token expiry; where secrets go (`mcp/secrets.env` + legacy fallback); how to pick `--tool-tier` (`WORKSPACE_MCP_TOOL_TIER`).

- [ ] **Step 2: Write `auth-and-credentials.md`** — the first-run browser flow (callback port 8000, retry with `user_google_email`); credential storage at `~/.google_workspace_mcp/credentials/` (encrypted, `0600`, override via `WORKSPACE_MCP_CREDENTIALS_DIR`); why there is no daily re-auth in stdio mode (no FastMCP rotation); reset procedure (delete the creds dir); and the **account-isolation guardrail** (never use the `mcp__claude_ai_*` Google connectors — account `nicolas1120201@gmail.com`).

- [ ] **Step 3: Write `tools.md`** — tool inventory grouped by service (Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, Contacts); the `mcp__plugin_google-workspace_workspace__*` prefix; common workflows (e.g. list/create/update calendar events, search/label Gmail threads, Drive file ops); parameter gotchas (timezones must be IANA; single-user `user_google_email` default = `andrevcv1@gmail.com`); the `America/Sao_Paulo` timezone + pt-BR defaults. (Inventory the actual tool names by launching the server once: `uvx "workspace-mcp==1.21.2" --tool-tier complete --transport stdio` and sending an MCP `tools/list`, or read the upstream tool registry — do not invent tool names.)

- [ ] **Step 4: Verify all three references exist and are non-trivial**

Run:
```bash
for f in setup auth-and-credentials tools; do
  p="plugins/google-workspace/skills/google-workspace/references/$f.md"
  lines=$(wc -l < "$p"); echo "$f.md: $lines lines"; [ "$lines" -ge 15 ] || { echo "TOO SHORT: $p"; exit 1; }
done
echo ALL_OK
```
Expected: three line counts, each ≥15, then `ALL_OK`.

- [ ] **Step 5: Run the writing-skills self-check** (per that skill) and fix any issues.

- [ ] **Step 6: Commit**

```bash
git add plugins/google-workspace/skills/google-workspace/references/
git commit -m "google-workspace skill: setup, auth-and-credentials, tools references"
```

---

## Task 7: Cutover — retire the old daemon + HTTP registration

These changes are OUTSIDE the repo (no git commit). Do them only after Tasks 1–6 are committed.

- [ ] **Step 1: Stop + unload the launchd daemon**

Run:
```bash
launchctl bootout "gui/$(id -u)/com.workspacemcp.server" 2>/dev/null \
  || launchctl unload "$HOME/Library/LaunchAgents/com.workspacemcp.server.plist" 2>/dev/null
echo "exit: $?"
```
Expected: command returns (exit 0, or non-zero if already stopped — acceptable).

- [ ] **Step 2: Locate the plist and disable it from loading at login**

Run: `ls -la "$HOME/Library/LaunchAgents/com.workspacemcp.server.plist" "$HOME/.claude/mcp/workspace-mcp/com.workspacemcp.server.plist" 2>/dev/null`
Then move the LaunchAgents copy aside (keep a backup):
```bash
[ -f "$HOME/Library/LaunchAgents/com.workspacemcp.server.plist" ] && \
  mv "$HOME/Library/LaunchAgents/com.workspacemcp.server.plist" "$HOME/Library/LaunchAgents/com.workspacemcp.server.plist.disabled"
echo done
```

- [ ] **Step 3: Confirm port 8000 is free and the process is gone**

Run: `lsof -nP -iTCP:8000 -sTCP:LISTEN || echo "8000 FREE"`
Expected: `8000 FREE` (nothing listening).

- [ ] **Step 4: Remove the old HTTP MCP registration from `~/.claude.json`**

Read `~/.claude.json`, find the `mcpServers."workspace-mcp"` object:
```json
    "workspace-mcp": {
      "type": "http",
      "url": "http://localhost:8000/mcp"
    },
```
Delete that key/object (and fix the surrounding commas so the JSON stays valid). Then verify:
```bash
python3 -m json.tool "$HOME/.claude.json" >/dev/null && echo JSON_OK
python3 -c "import json; d=json.load(open('$HOME/.claude.json')); assert 'workspace-mcp' not in d.get('mcpServers',{}), 'still present'; print('REMOVED')"
```
Expected: `JSON_OK` then `REMOVED`.

- [ ] **Step 5: Clear the stale auth cache entry**

Run:
```bash
python3 - <<'PY'
import json, os
p = os.path.expanduser("~/.claude/mcp-needs-auth-cache.json")
d = json.load(open(p))
def strip(x):
    if isinstance(x, dict): return {k:strip(v) for k,v in x.items() if k != "workspace-mcp"}
    if isinstance(x, list): return [strip(v) for v in x]
    return x
json.dump(strip(d), open(p,"w"), indent=2)
print("CACHE_CLEANED")
PY
```
Expected: `CACHE_CLEANED`. (If the file shape differs, inspect it first and remove only `workspace-mcp` references.)

---

## Task 8: Rewrite the global CLAUDE.md "My Google Workspace" section

OUTSIDE the repo (no git commit). **Read `~/.claude/CLAUDE.md` first** — match the exact current strings before editing.

- [ ] **Step 1: Replace the Google Workspace bullet**

Old (current):
```
- **My Google Workspace** — account `andrevcv1@gmail.com`. You can manage my Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts. **Always use the `mcp__workspace-mcp__*` tools for this.** Claude's own connector tools (`mcp__claude_ai_Google_Calendar__*`, `mcp__claude_ai_Gmail__*`, `mcp__claude_ai_Google_Drive__*`) are wired to a different, unrelated Google account (`nicolas1120201@gmail.com`) — NEVER use them for my Workspace. If those connectors are the only Google tools loaded, authenticate `workspace-mcp` first (see below); do not fall back to them.
```
New:
```
- **My Google Workspace** — account `andrevcv1@gmail.com`, via my self-hosted **`google-workspace`** plugin (server `workspace`). Manage my Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts through the **`mcp__plugin_google-workspace_workspace__*`** tools — always use these. Claude's own connector tools (`mcp__claude_ai_Google_Calendar__*`, `mcp__claude_ai_Gmail__*`, `mcp__claude_ai_Google_Drive__*`) are wired to a different, unrelated Google account (`nicolas1120201@gmail.com`) — NEVER use them for my Workspace.
```

- [ ] **Step 2: Replace the old re-auth paragraph + the "Known issue — daily re-auth" blockquote** with:
```
The `google-workspace` plugin runs the server in stdio single-user mode (spawned per session — no daemon). First use opens a one-time Google consent in the browser; credentials cache locally and refresh silently afterward, so there's no recurring re-auth. If consent starts recurring (~weekly), the Google OAuth app is in "Testing" status — publish its consent screen to stop it. Plugin lives at `~/www/Andre-Dezzy/maccing/plugins/google-workspace/`; legacy secrets/back-compat live in `~/.claude/mcp/`.
```

- [ ] **Step 3: Verify the obsolete references are gone**

Run:
```bash
grep -nE "mcp__workspace-mcp__authenticate|Known issue — daily re-auth|complete_authentication" "$HOME/.claude/CLAUDE.md" && echo "STILL PRESENT — fix" || echo "CLEAN"
grep -nE "mcp__plugin_google-workspace_workspace__|google-workspace.*plugin" "$HOME/.claude/CLAUDE.md" >/dev/null && echo "NEW REF OK"
```
Expected: `CLEAN` then `NEW REF OK`.

---

## Task 9: End-to-end verification

- [ ] **Step 1: Enable the plugin** (user action) — in Claude Code, enable `google-workspace` from the `maccing` marketplace (`/plugin`), then restart the session so the new MCP server registers. Confirm tools appear: a fresh session should expose `mcp__plugin_google-workspace_workspace__*` and NO `mcp__workspace-mcp__*`.

- [ ] **Step 2: One-time Google auth** (user action) — trigger any Workspace tool (e.g. list calendars); complete the browser consent as `andrevcv1@gmail.com`; confirm creds written:

Run: `ls -la "$HOME/.google_workspace_mcp/credentials/" && echo CREDS_OK`
Expected: a credentials file exists (mode `600`), then `CREDS_OK`.

- [ ] **Step 3: Live smoke test** — list calendars / list today's events for `andrevcv1@gmail.com` through `mcp__plugin_google-workspace_workspace__*`; confirm a real result returns (the original "adjust my calendar" use case).

- [ ] **Step 4: Confirm the cutover is clean** — no `mcp__workspace-mcp__*` tools present; `lsof -nP -iTCP:8000 -sTCP:LISTEN` shows nothing except the transient auth callback; the daemon does not relaunch after a reboot (plist disabled).

- [ ] **Step 5: Final branch state** — confirm the repo commits are all on `google-workspace-plugin` and the unrelated `maccing-notion` edits remain unstaged:

Run: `git log --oneline main..HEAD && git status --short`
Expected: the google-workspace commits listed; only the pre-existing `maccing-notion` files show as modified (unstaged).

---

## Notes / Out of scope

- No `fastmcp_access_token_expiry_seconds` TTL patch and no workspace-mcp fork — unnecessary in stdio mode.
- No hosted/multi-tenant deployment.
- Pushing the branch / opening a PR / merging to `main` is a separate, user-initiated step (not in this plan).
- Deleting (vs. disabling) the old `~/.claude/mcp/workspace-mcp/` dir is deferred — it stays as the secrets fallback until you decide to remove it.
