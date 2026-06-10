# maccing-notion

Notion API engineering reference for coding agents — the low-level details for building and editing Notion databases programmatically, and debugging Notion API errors. Ships a self-hosted `notion` MCP server so the agent can call the Notion REST API directly.

## Install

```
/plugin install maccing-notion@maccing
```

## Skills

| Skill | Purpose |
|-------|---------|
| notion-api | Notion API/MCP reference: a **MANDATORY ancestral-`AGENTS.md` sweep** before any operation, `data_sources` model & versions, auth/MCP pattern, core endpoints, property-creation shapes, reading property values, pages, Notion-flavored Markdown, blocks & positioning, Views API, charts, **formula gotchas (empirically verified on a live workspace)**, rollups, relations, pt-BR number formatting via arithmetic, and production architecture patterns. Triggers on building/editing databases, formulas, rollups, relations, views, charts, page blocks, or hitting Notion API errors. |

## MCP server

The plugin bundles a zero-dependency [Bun](https://bun.sh) MCP server (`mcp/server.ts`) registered via `.mcp.json` as the `notion` server. It exposes one tool, `notion_request(method, path, body, query)`, a full-control passthrough to `https://api.notion.com` that always sends `Notion-Version: 2026-03-11` — unlocking the entire current surface (views, data sources, databases, pages, blocks, search, comments, file uploads).

**Setup — provide a token** (a Notion internal-integration Personal Access Token from notion.so/profile/integrations → Personal access tokens). Either:

- `export NOTION_TOKEN=ntn_...` in your shell (`.mcp.json` forwards it), **or**
- copy `mcp/secrets.env.example` → `mcp/secrets.env` (gitignored) and fill it in.

The launcher (`mcp/start.sh`) resolves the token in order: plugin-local `mcp/secrets.env` → legacy `~/.claude/mcp/notion/secrets.env` → `NOTION_TOKEN` in the environment. The token is never committed. Requires `bun` on `PATH` (or `~/.bun/bin/bun`).

## Relationship to the official Notion plugin

This skill is the **complementary low-level reference**. For high-level workflows in Claude Code, also install the official [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) and use it for Knowledge Capture, Meeting Intelligence, Research Documentation, and Spec-to-Implementation. Reach for `notion-api` when you're engineering databases/formulas/views directly against the API or debugging its errors.
