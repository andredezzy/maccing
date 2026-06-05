---
name: meta
description: Parent skill for the Meta platform — Business Manager (BM) fundamentals and types, business verification, account quality, Meta enforcement classifier, Brazilian defensive intelligence (niche classification, black hat ecosystem awareness, payment hygiene), asset isolation, proxy/antidetect/CDP setup, disposable BM strategy, ban mechanics, ban/cascade/appeal, and Official Business Account. Use when working with ANY Meta platform (Ads, WhatsApp, Instagram) — BM health, verification, isolation, classifier, disposable-BM ops. Triggers on "business manager", "BM", "business verification", "account quality", "meta classifier", "asset isolation", "disposable BM", "proxy meta", "payment hygiene", "ban appeal", "cascade ban", "AdsPower", "CNPJ".
---

# Meta Platform Skill

Parent skill for the Meta platform; meta-ads and whatsapp depend on this.

```
MANDATORY — read context AND report the full BM roster BEFORE any action
(including before clarifying questions):
1. READ `.maccing/growth/README.md` (the vendor/account index), if it exists.
2. ENUMERATE every BM — never assume one. The path is `meta/<profile>/<bm>/`, so
   list `.maccing/growth/meta/*/` (profiles) and `.maccing/growth/meta/*/*/` (BMs),
   then READ the root README, EVERY profile README, and EVERY BM README found.
3. TELL the operator a roster of ALL BMs up front — one line each
   (profile · BM · verification/tier · proxy/isolation · status) —
   INCLUDING BMs unrelated to the current task. Never silently narrow to one BM.
Each BM README holds verification status, proxy/card/profile inventory, pipeline
progress, and pending actions. Skipping this = stale data + hidden live assets.
```

**Child skills:** `meta-ads` and `whatsapp` both build on this. If working on ads only, load `meta-ads`. If working on WhatsApp dispatch, load `whatsapp`. Both share the BM infrastructure, isolation rules, and classifier defensive intelligence documented here.

---

## BM Fundamentals & Types

A Business Manager (renamed "Business Portfolio" in 2024) is the container for all Meta assets: ad accounts, Pages, pixels, WABAs, system users. BM health controls access to everything inside it.

Key types:

| Type | Description | Price Range | Risk |
|---|---|---|---|
| BM zerada | Fresh, no history | R$50-150 | High (no trust) |
| BM verificada | Business Verification done | R$90-250 | Medium |
| BM ilimitada | High-score creator profile | R$400-1500 | Medium |
| Disposable BM | Burn after use | R$80-300 setup | Expected to die |
| BM reativada | Recovered from ban via appeal | Variable | Paradoxically stable |
| BM disparo | Set up for WhatsApp dispatch | Variable | Depends on tier |

**Architecture rule:** Vault BM (pixels/pages/conversion data) is ALWAYS separate from Campaign BM (runs ads, takes ban risk), which is ALWAYS separate from WABA BM (holds WhatsApp number). WABA cannot be transferred between BMs — choose carefully.

Full type reference: `reference/asset-isolation-infrastructure.md`

---

## Account Quality & Classifier

Meta's enforcement classifier operates in three layers: (1) content ML models on photos/text/copy, (2) behavioral/network graph linking devices, IPs, cards, and BM structure, (3) human review for edge cases. The **Account Integrity classifier** targets coordinated inauthentic behavior and linked-account structures — this is what triggers cluster bans when BMs share infrastructure.

**Key risk signals:** shared device fingerprint, shared payment card, shared proxy IP, account age <90 days for BM creation, rapid budget scaling, CNPJ inconsistency with Receita Federal.

Actively monitor Account Quality in Business Manager. Financial niche triggers extra scrutiny — niche guilt-by-association means legitimate operators get caught in classifier sweeps targeting black hat operators using identical keywords.

Full intelligence: `reference/brazilian-classifier-defense.md`

---

## Defensive Intelligence (Brazilian Financial Niche)

Brazil is the highest-risk Meta market for financial advertisers. The black hat ecosystem is large (thousands of disposable BMs in active circulation), and Meta's classifier is trained on Portuguese-language scam patterns — legitimate operators face frequent false positives.

**Niche tiers:** Black (offshore casino, unregulated forex) → Gray (MLM-adjacent infoproducts) → White (regulated financial services). Legitimate white-category operators differentiate via: real CNPJ, business verification, no guaranteed-return language, visible regulatory registration.

**CNPJ matters:** Meta cross-references CNPJ with Receita Federal. Inactive CNPJ, mismatched address, or CPF/CNPJ linked to permanently banned BMs creates persistent blacklist entries. Financial identity verification (March 2026) adds another layer for banking/fintech/crypto advertisers.

**WhatsApp profile compliance:** Category + About + Description must tell one coherent story. "Gestão de capital" triggers both Meta and CVM risk simultaneously. "Educação financeira" and "compartilhamos análises" are safe. Complete profile is safer than minimal — empty fields signal scam during manual review.

Full playbook + WABA profile risk table: `reference/brazilian-classifier-defense.md`

---

## Ban Mechanics

**Triggers (critical):** shared device fingerprint across BMs, payment card on dirty-list (persists 6-12 months), IP previously on banned BM, profile under 90 days creating a BM, UBP policy violations.

**Cascade:** BM restriction is instantaneous — every asset inside goes down. Cross-platform cascade (Instagram + Facebook + WhatsApp + Threads) is live as of 2025-2026. BM ban is catastrophic (WABA numbers go to Disabled); number ban is recoverable.

**Appeal:** Tier 1 automated (35% resolution, 24h) → Tier 2 human (3-5 days) → Tier 3 Policy Advisory Board (10-15 days, rare). Critical deadline: 180 days disabled = permanent loss of reinstatement.

Full trigger table, cascade mechanics, appeal tiers: `reference/disposable-bm-strategy.md` (also in `reference/brazilian-classifier-defense.md`)

---

## Asset Isolation

One proxy IP, one payment card, one admin profile, one antidetect browser profile — per BM, never shared. Parallel disposable BMs must also isolate the **IP family** (IPv4 vs IPv6) to prevent Meta graph-linking adjacent ranges.

**Browser automation rule:** Any automation touching a BM's accounts (Business Manager, BSP dashboard) MUST run through that BM's own AdsPower profile — same proxy/fingerprint, never a clean host-IP browser. Install the official AdsPower **skill** (`npx skills add AdsPower/adspower-browser`), **MCP** (`local-api-mcp-typescript`), and **CLI**. Full doctrine (undetectable behavior, keep-open, Hybrid agent-vs-operator split, the MCP read recipe, fallback ladder): `reference/automation.md`.

Full isolation table: `reference/asset-isolation-infrastructure.md`

---

## Proxy & Antidetect

Hard requirements for a dispatch BM proxy: dedicated/static (NEVER rotating), SOCKS5, BR, clean Meta reputation. Mobile 4G/5G proxies provide the highest Meta trust score (real carrier ASN). Static residential/ISP is strong and cost-effective. Datacenter is detectable — never for WABA warming.

Top BR-local choices: **ProxyAds** (built for Meta BM + WhatsApp API), **Proxy Roque** (Meta/Google-tuned line, IPv4 dedicated), **Coronium.io** (mobile dedicated, WhatsApp warming protocol).

Full 30-row provider comparison with 2026 pricing: `reference/asset-isolation-infrastructure.md`

---

## Disposable BM Strategy

A disposable BM is a purchased, pre-verified BM used to validate WhatsApp broadcast before investing in permanent infrastructure. Expected lifecycle: weeks to months. When it falls, learnings (template copy, block rates, contact segments) transfer — only infrastructure is replaced.

**Full pipeline:** Profile acquisition → Profile warming (7-14 days) → BM accept → BM verification → WABA attachment → Number warming → Template approval → Test broadcast → Scale → Monitor/burn-replace.

**Key rules:** Admin role (not Employee) required for BSP Embedded Signup. WABA non-transferable between BMs — choose BM at setup. Rest 24h after BM accept. Split hardening and WABA setup into separate sessions (2-4h apart). Remove supplier admin only after Day 8 (7-day Facebook enforcement window).

**Tier system (Oct 2025):** Verified BM = 2,000/day (Tier 1). Advancement at 50% of current limit in 7 days + Green/Yellow quality, evaluated every 6h.

**Cost of a ban cycle:** ~R$400-600 + 2-4 days setup time. Template data and contact segment insights survive the burn.

Full pipeline, setup sequence, Display Name Strategy, BSP migration, number warming protocol: `reference/disposable-bm-strategy.md`

---

## Payment Hygiene

Pay Meta with a **company corporate card matching the BM's CNPJ and billing address**. Never use personal employee cards or cards with history on other BMs. Meta's dirty-list for payment cards persists 6-12 months — a card used on a banned account stamps every new account it's added to. Use Wise/Revolut virtual cards for disposable BMs (separate card per BM).

See also: `reference/brazilian-classifier-defense.md` (Defense Playbook §5)

---

## Business Verification

Complete verification with real CNPJ, real address, institutional email on company domain. Single highest-ROI action for legitimate operators: raises tolerance threshold before automatic ban, unlocks premium support, grants Tier 1 (2,000 msg/day) on WhatsApp, enables up to 20 WABA numbers.

For WhatsApp: verified BMs skip the document-submission step when buying pre-verified BMs from the market. The `"Verificada"` status on the BM Invite Acceptance Wizard Step 2 is the key signal.

Official Business Account (blue badge): requires WABA 30+ days old, verified BM, 2FA, display name approved, notable organic media coverage. Application is via BSP only (not self-service).

Full verification requirements + OBA badge: `reference/business-verification.md`

---

## Intent → Reference Routing Table

| Intent | Reference | Use for |
|---|---|---|
| Brazilian classifier, niche classification, defense playbook, payment hygiene, profile survival rates, 2025-2026 trends, ban triggers/cascade/appeal, WhatsApp profile compliance (financial niche) | `reference/brazilian-classifier-defense.md` | Understanding why legitimate operators get flagged; defense playbook; WABA profile language risk |
| Asset isolation rules, proxy types + full provider table, antidetect browsers, BM architecture for WABA, BM types | `reference/asset-isolation-infrastructure.md` | Setting up isolated BM infrastructure; choosing a proxy |
| Browser automation for Meta properties (BM management, BSP/WhatsApp dashboard reads) | `reference/automation.md` | When any task on a Meta surface requires a browser — BM, BSP dashboard, WhatsApp Manager |
| Disposable BM pipeline, setup sequence, Operator Data-Request Protocol, BM Invite Acceptance Wizard, verified-vs-lore findings, tier system, BM sources + survival rates, number warming, chip warming, Display Name Strategy, phone number strategy, virtual numbers, burn-replace, number longevity + cold lists | `reference/disposable-bm-strategy.md` | Running a disposable BM end-to-end; WhatsApp dispatch warmup; number strategy |
| Business verification (WhatsApp), Official Business Account (blue badge), BM verification (ads defense note) | `reference/business-verification.md` | Verification requirements; OBA badge eligibility and process |
