# maccing-growth

Growth toolkit for coding agents: paid acquisition (Google, Meta, TikTok Ads) and owned messaging (WhatsApp Business Platform / Cloud API) — strategy, metrics, and platform references.

## Install

```
/plugin install maccing-growth@maccing
```

## Skills

| Skill | Purpose |
|-------|---------|
| growth | Cross-channel strategy, metrics, funnel, attribution, competitive intelligence, defensive techniques |
| google-ads | Google Ads production reference + scripts |
| meta-ads | Meta (Facebook/Instagram) Ads production reference |
| tiktok-ads | TikTok Ads production reference |
| whatsapp | WhatsApp Business Platform / Cloud API production reference |

## Command

`/growth <task>` — routes into the orchestrator.

## Project state convention

When used in a project repo, growth state lives in a git-tracked `.maccing/growth/<vendor>/.../<account>/` tree (the `growth` skill enforces this).
