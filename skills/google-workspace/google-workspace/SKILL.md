---
name: google-workspace
description: Use when working with the bundled self-hosted Google Workspace MCP server — driving Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, or Contacts through it, OR setting up / troubleshooting its OAuth (first-run consent, 7-day test-mode re-auth, credential storage). Covers the account-isolation rule (never the Google connectors your host ships — they authenticate a different account).
---

# Google Workspace

Self-hosted Google Workspace MCP server, built on `workspace-mcp==1.21.2` (PyPI package, `taylorwilsdon/google_workspace_mcp`). Runs as a per-session stdio process — no daemon, no daily re-authorization. Supports Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts.

## Account-isolation rule — the single most important rule

**Always use this plugin's `workspace` server; NEVER a Google connector shipped by your host (`mcp__claude_ai_Google_Calendar__*`, `mcp__claude_ai_Gmail__*`, `mcp__claude_ai_Google_Drive__*` and the like) — those authenticate a different account. Tool-name prefixes differ per host, so match the server, not a fixed prefix. The account this server acts as is whatever `USER_GOOGLE_EMAIL` is set to.**

## References — load on demand

| Task | Reference |
|---|---|
| Google Cloud setup, enabling APIs, OAuth client, publishing consent screen, secrets, tool tiers | `references/setup.md` |
| First-run browser flow, credential storage, no-daily-reauth rationale, reset procedure | `references/auth-and-credentials.md` |
| Tool inventory by service, common workflows, parameter gotchas, user defaults | `references/tools.md` |
