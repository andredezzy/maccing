---
name: meta-ads
description: Meta Ads (Facebook + Instagram) production reference. Use when managing Meta/Facebook/Instagram ad campaigns, creating ads, CAPI setup, audience targeting, creative testing, or automating via Marketing API. Triggers on "meta ads", "facebook ads", "instagram ads", "CAPI", "conversions API", "meta pixel", "advantage+", "lookalike audience", "custom audience", "meta campaign", "facebook campaign", "ad set", "ad creative", "click-to-whatsapp", "CTWA".
---

# Meta Ads (Facebook + Instagram) Skill

Production reference for Meta Ads. Covers Marketing API, campaign types, targeting, creative formats, bidding, CAPI, pixel, reporting, compliance, automation, and 2025-2026 best practices.

> **Depends on:** the `meta` skill (BM, verification, account quality, classifier, asset isolation, ban mechanics). ALWAYS load `meta` first.

> **Related:** `whatsapp` for the messaging side of CTWA (templates, 72h window, pricing).

---

## Project Context (MANDATORY)

Follow the mandatory BM-roster protocol in the meta skill's Project Context block (it includes the ads ad-account README step).

---

## API Version Status

Current: **v25.0** (Feb 18, 2026) | Minimum supported: **v22.0** (since Sep 9, 2025)

| Version | Release | Status |
|---------|---------|--------|
| v25.0 | Feb 18, 2026 | Current |
| v24.0 | Apr 8, 2026 | Supported |
| v23.0 | Jan 15, 2026 | Supported |
| v22.0 | Feb 11, 2026 | Minimum |
| v21.0 | Jun 26, 2025 | Deprecated |
| v20.0 | Jan 31, 2025 | Deprecated |

**Key breaking changes:**
- **v25.0:** Advantage+ Shopping/App Campaign creation deprecated — effective ALL versions May 19, 2026.
- **v24.0:** Facebook video feeds deprecated (migrate to Reels). Messenger lead ads blocked via API. Batch limit 30 MB.
- **v23.0:** Advantage+ Audience default-on for new ad sets. `instagram_actor_id` → `instagram_user_id`.
- **v22.0:** `instagram_actor_id` removed. `promotions` → `promotion_details`.
- **v21.0:** ODAX objectives required for ALL new campaigns.
- **v20.0:** Offline Conversions API shut down — use CAPI with `action_source`.

Base URL: `https://graph.facebook.com/v25.0/`

---

## Routing Table

| Intent | Reference | Use for |
|--------|-----------|---------|
| API auth, tokens, CRUD endpoints, rate limits, batch, webhooks; campaign structure, ODAX objectives, Advantage+ campaigns; Python automation scripts; API quick-reference enums; WhatsApp Marketing Messages | reference/api-and-campaigns.md | Setting up API access, creating/updating campaigns and ad sets, understanding Advantage+ levers, choosing objectives, building automation scripts, quick enum lookups |
| Audience targeting, custom audiences, lookalike audiences, geo, interests; remarketing via WhatsApp contacts | reference/audiences.md | Building targeting specs, creating LLAs, configuring Advantage+ Audience, custom audience upload, CTWA-contact remarketing |
| Ad formats, image/video specs, carousel, DCO, UGC, catalog/product feed | reference/creative.md | Producing or validating ad creative, enabling Advantage+ Creative, setting up catalog ads |
| Bid strategies, budget types, CBO, learning phase, scaling | reference/bidding.md | Choosing bid strategy, setting budgets, exiting learning phase, scaling spend |
| CAPI setup, EMQ, deduplication, standard events, Pixel, AEM, domain verification, iOS 14.5+ | reference/capi-pixel.md | Implementing conversion tracking, maximising EMQ score, debugging CAPI, Pixel deduplication |
| Insights API, attribution windows, key metrics, data retention, async reports; A/B testing, Creative Hub, automation rules | reference/reporting.md | Pulling performance data, building reports, setting up automation rules, A/B tests |
| Special ad categories, finance/housing/employment restrictions, restricted content, ad review policy | reference/compliance.md | Financial services compliance, policy review, restricted-content decisions |
| 2026 best practices, account structure, CAPI checklist, creative guidelines, scaling checklist, attribution strategy; creative rotation; ad fatigue management | reference/best-practices.md | Account setup decisions, pre-launch checklists, debugging common mistakes, managing creative refresh cycles |
| Click-to-WhatsApp ads, ctwa_clid attribution, 72h free window | reference/ctwa.md | CTWA campaign setup, attributing WhatsApp conversions via CAPI, CTWA vs landing page decisions |
| AdsPower browser automation, antidetect doctrine, official-surface-first decision tree | ../meta/reference/browser-automation.md | When an ads task needs the browser / antidetect discipline |

---

## Summary by Area

**API & Campaigns:** System User tokens are the only viable production auth. Budget is always in cents. ODAX objectives required since v21.0. Advantage+ (3 levers: Budget + Audience + Placement) is the new default — legacy ASC/AAC APIs end May 19, 2026. Max 5 ad sets per campaign to concentrate learning signal. Python automation scripts and API enums live in reference/api-and-campaigns.md.

**Audiences:** Interest targeting is now suggestions-only in most objectives; detailed targeting exclusions removed March 2025. The creative IS the targeting signal. For scale: Advantage+ Audience + geo/age hard constraints only. Lookalike seeds from closed-won customers (not form fills) deliver 20-40% ROI improvement. Remarketing via WhatsApp contacts is documented in reference/audiences.md.

**Creative:** 9:16 vertical video first (Reels/Stories), then 4:5 image. First 3 seconds determine 80% of video outcome. UGC wins "9 out of 10 accounts." DCO via `asset_feed_spec` runs up to 10 images/videos × 5 headlines × 5 body variants. Catalog ads require Dynamic Media enforcement as of Oct 20, 2025.

**Bidding:** Start with `LOWEST_COST_WITHOUT_CAP`; switch to `COST_CAP` at 1.3× target CPA after 50+ conversions/week. Budget >20% change resets learning. Minimum daily budget formula: `(target CPA × 50) / 7` per ad set.

**CAPI:** Non-negotiable — pixel-only accounts lose 15-40% of conversion data to ad blockers. `fbp` and `fbc` must NOT be hashed. Target EMQ ≥ 8.8 for Purchase. Deduplication requires matching `event_id` across Pixel and CAPI. Store `fbclid` at lead creation; fire closed-won events via CAPI with original match keys.

**Reporting:** Default attribution window: `7d_click` + `1d_view`. `7d_view` and `28d_view` REMOVED Jan 12, 2026 — they return empty data silently, not an error. Audit all pipelines. Unique-count fields expire after 13 months. Full Insights API reference in reference/reporting.md.

**Compliance:** Financial services ads require `FINANCIAL_PRODUCTS_AND_SERVICES` special ad category (expanded Jan 2025). Age locked to 18-65+, no ZIP targeting, no LLAs, no location exclusions. Policy-only details in reference/compliance.md.

**CTWA:** CTWA ads get a 72-hour free messaging window. `ctwa_clid` from webhook referral is the attribution key — store it in Redis (90-day TTL) mapped to phone. Fire CAPI with `action_source: "business_messaging"` to close the attribution loop.

**Creative Rotation & Ad Fatigue:** Rotation schedules, fatigue signals, and refresh checklists live in reference/best-practices.md.
