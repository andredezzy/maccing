# maccing-growth

Growth toolkit for coding agents: paid acquisition (Google, Meta, TikTok Ads) and owned messaging (WhatsApp Business Platform / Cloud API) — strategy, metrics, and platform references.

## Install

```
/plugin install maccing-growth@maccing
```

## Skills

Each skill is a thin SKILL.md (routing table) over on-demand `reference/` files (progressive disclosure). Skills are grouped on disk into platform/provider folders (registered via the `skills` array in `plugin.json`); commands stay flat (`maccing-growth:<skill>`).

```
skills/
  meta/          meta · meta-ads · whatsapp        (shared substrate + Meta children)
  platforms/
    ycloud/      ycloud · ycloud-api               (a comms provider + its API)
  google-ads/ · tiktok-ads/ · growth/              (top-level)
```

| Skill | Group | Purpose |
|-------|-------|---------|
| growth | — | Cross-channel strategy, metrics, funnel, attribution, competitive intelligence, defensive techniques |
| google-ads | — | Google Ads production reference + scripts |
| tiktok-ads | — | TikTok Ads production reference |
| **meta** | meta | **Shared Meta platform substrate** — Business Manager, business verification, account quality, enforcement classifier + defensive intelligence, asset isolation, proxy/antidetect, disposable-BM strategy, payment hygiene, ban/appeal/cascade. Loaded first by `meta-ads` and `whatsapp`. |
| meta-ads | meta | Meta (Facebook/Instagram) Ads production reference. Loads `meta`. |
| whatsapp | meta | WhatsApp Business Platform / Cloud API production reference. Loads `meta` (not `meta-ads`). |
| ycloud | platforms | **YCloud** — multi-channel communications provider (CPaaS: WhatsApp, SMS, Voice, Email). WhatsApp BSP ops: console, plans, embedded signup, campaigns/inbox/journeys, auto-unsubscribe chatbot, dashboard-vs-API, read-only CDP automation |
| ycloud-api | platforms | YCloud v2 REST API reference — messages, templates, phone/WABA, wallet, webhooks, contacts, unsubscribers, media, pagination gotchas |

## Command

`/growth <task>` — routes into the orchestrator.

## Project state convention

When used in a project repo, growth state lives in a git-tracked `.maccing/growth/<vendor>/.../<account>/` tree (the `growth` skill enforces this).
