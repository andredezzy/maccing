# maccing-growth

Growth toolkit for coding agents: paid acquisition (Google, Meta, TikTok Ads) and owned messaging (WhatsApp Business Platform / Cloud API) — strategy, metrics, and platform references.

## Install

```
/plugin install maccing-growth@maccing
```

## Skills

Each skill is a thin SKILL.md (routing table) over on-demand `reference/` files (progressive disclosure). Platform skills load the shared `meta` substrate first.

| Skill | Purpose |
|-------|---------|
| growth | Cross-channel strategy, metrics, funnel, attribution, competitive intelligence, defensive techniques |
| google-ads | Google Ads production reference + scripts |
| **meta** | **Shared Meta platform substrate** — Business Manager, business verification, account quality, enforcement classifier + defensive intelligence, asset isolation, proxy/antidetect, disposable-BM strategy, payment hygiene, ban/appeal/cascade. Loaded first by `meta-ads` and `whatsapp`. |
| meta-ads | Meta (Facebook/Instagram) Ads production reference. Loads `meta`. |
| tiktok-ads | TikTok Ads production reference |
| whatsapp | WhatsApp Business Platform / Cloud API production reference. Loads `meta` (not `meta-ads`). |
| ycloud | YCloud BSP platform operations — console, plans, embedded signup, campaigns/inbox/journeys, auto-unsubscribe chatbot, dashboard-vs-API, read-only CDP automation |
| ycloud-api | YCloud v2 REST API reference — messages, templates, phone/WABA, wallet, webhooks, contacts, unsubscribers, media, pagination gotchas |

## Command

`/growth <task>` — routes into the orchestrator.

## Project state convention

When used in a project repo, growth state lives in a git-tracked `.maccing/growth/<vendor>/.../<account>/` tree (the `growth` skill enforces this).
