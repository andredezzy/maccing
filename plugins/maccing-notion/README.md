# maccing-notion

Notion API engineering reference for coding agents — the low-level details for building and editing Notion databases programmatically, and debugging Notion API errors.

## Install

```
/plugin install maccing-notion@maccing
```

## Skills

| Skill | Purpose |
|-------|---------|
| notion-api | Notion API/MCP reference: `data_sources` model & versions, auth/MCP pattern, core endpoints, property-creation shapes, reading property values, pages, Notion-flavored Markdown, blocks & positioning, Views API, charts, **formula gotchas (empirically verified on a live workspace)**, rollups, relations, pt-BR number formatting via arithmetic, and production architecture patterns. Triggers on building/editing databases, formulas, rollups, relations, views, charts, page blocks, or hitting Notion API errors. |

## Relationship to the official Notion plugin

This skill is the **complementary low-level reference**. For high-level workflows in Claude Code, also install the official [`makenotion/claude-code-notion-plugin`](https://github.com/makenotion/claude-code-notion-plugin) and use it for Knowledge Capture, Meeting Intelligence, Research Documentation, and Spec-to-Implementation. Reach for `notion-api` when you're engineering databases/formulas/views directly against the API or debugging its errors.
