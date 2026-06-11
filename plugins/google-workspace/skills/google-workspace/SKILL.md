---
name: google-workspace
description: Use when working with André's self-hosted Google Workspace MCP (the `google-workspace` plugin) — driving Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, or Contacts via the `mcp__plugin_google-workspace_workspace__*` tools, OR setting up / troubleshooting its OAuth (first-run consent, 7-day test-mode re-auth, credential storage). Covers the account-isolation rule (never use the `mcp__claude_ai_*` Google connectors — different account).
---

# Google Workspace

Self-hosted Google Workspace MCP server for Claude Code, built on `workspace-mcp==1.21.2` (PyPI package, `taylorwilsdon/google_workspace_mcp`). Runs as a per-session stdio process — no daemon, no daily re-authorization. Supports Calendar, Gmail, Drive, Docs, Sheets, Slides, Forms, Tasks, Chat, and Contacts.

## When to use

- Calling any `mcp__plugin_google-workspace_workspace__*` tool — calendar events, Gmail threads, Drive files, Docs, Sheets, Slides, Forms, Tasks, Chat, Contacts
- First-run OAuth setup or re-authentication
- Troubleshooting credential expiry or port-8000 conflicts
- Setting up the Google Cloud project, enabling APIs, or configuring the OAuth consent screen

## Account-isolation rule — the single most important rule

**Always use `mcp__plugin_google-workspace_workspace__*`; NEVER the `mcp__claude_ai_Google_Calendar__*` / `mcp__claude_ai_Gmail__*` / `mcp__claude_ai_Google_Drive__*` connectors — they are wired to a different, unrelated Google account (`nicolas1120201@gmail.com`). The user's Workspace account is `andrevcv1@gmail.com`.**

## References — load on demand

| Task | Reference |
|---|---|
| Google Cloud setup, enabling APIs, OAuth client, publishing consent screen, secrets, tool tiers | `references/setup.md` |
| First-run browser flow, credential storage, no-daily-reauth rationale, reset procedure | `references/auth-and-credentials.md` |
| Tool inventory by service, common workflows, parameter gotchas, user defaults | `references/tools.md` |
