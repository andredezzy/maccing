# growth

Growth toolkit for coding agents: paid acquisition (Google, Meta, TikTok Ads) and owned messaging (WhatsApp Business Platform / Cloud API) — strategy, metrics, and platform references.

## Install

```
/plugin install maccing@maccing
```

## Skills

Each skill is a thin SKILL.md (routing table) over on-demand `references/` files (progressive disclosure). Every skill is its own folder directly under `skills/`, named exactly as the skill — the layout the Agent Plugins spec discovers. The nesting that used to carry the grouping is in the names now, so a skill says which family it belongs to wherever it is quoted. The Substrate column is a load-order relationship, not a folder.

```
skills/
  growth/                                                   the orchestrator this README documents
  growth-google-ads/ · growth-tiktok-ads/                   platform references
  growth-meta/ · growth-meta-ads/ · growth-meta-whatsapp/   shared Meta substrate + its two children
  growth-ycloud/ · growth-ycloud-api/                       a comms provider + its API
```

| Skill | Substrate | Purpose |
|-------|-----------|---------|
| growth | — | Cross-channel strategy, metrics, funnel, attribution, competitive intelligence, defensive techniques |
| growth-google-ads | — | Google Ads production reference + 12 ready-to-run Scripts (6 read: campaign performance, keyword performance, search terms, ad details, conversion actions, full audit; 6 write: add keywords, add negatives, create conversion, create RSA, pause campaign, update ad URL) |
| growth-tiktok-ads | — | TikTok Ads production reference |
| **growth-meta** | — | **Shared Meta platform substrate** — Business Manager, business verification, account quality, enforcement classifier + defensive intelligence, asset isolation, proxy/antidetect, disposable-BM strategy, payment hygiene, ban/appeal/cascade. Loaded first by `growth-meta-ads` and `growth-meta-whatsapp`. |
| growth-meta-ads | growth-meta | Meta (Facebook/Instagram) Ads production reference. Loads `growth-meta`. |
| growth-meta-whatsapp | growth-meta | WhatsApp Business Platform / Cloud API production reference. Loads `growth-meta` (not `growth-meta-ads`). |
| growth-ycloud | — | **YCloud** — multi-channel communications provider (CPaaS: WhatsApp, SMS, Voice, Email). WhatsApp BSP ops: console, plans, embedded signup, campaigns/inbox/journeys, auto-unsubscribe chatbot, dashboard-vs-API, read-only CDP automation |
| growth-ycloud-api | growth-ycloud | YCloud v2 REST API reference — messages, templates, phone/WABA, wallet, webhooks, contacts, unsubscribers, media, pagination gotchas |

## Command

`/maccing:growth <task>` — routes into the orchestrator.

## Project state convention

When used in a project repo, growth state lives in a git-tracked `.maccing/growth/` tree (the `growth` skill enforces this). The top level groups by **platform** — `google-ads/`, `tiktok-ads/`, `meta/`. Under `meta/`, the next level is **ownership**:

```
.maccing/growth/
  google-ads/<account>/ · tiktok-ads/<account>/     platform → account
  meta/
    profiles/<profile>/<bm>/                        assets WE own (antidetect profile → BM → channel)
    vendors/<vendor>/<channel>/<YYYY-MM-DD>-<slug>/ third parties who dispatch FOR us; the date is the DISPATCH date
```

"Vendor" means an outsourced dispatcher, not an ad platform.

A campaign folder gets its date when the send happens, so one that has not been dispatched yet is just `<slug>/`.
