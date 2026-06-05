## Contents

1. [Defensive Intelligence: Brazilian Black Hat Ecosystem](#defensive-intelligence-brazilian-black-hat-ecosystem)
   - [Glossary (Market Jargon)](#glossary-market-jargon)
   - [What Meta's Classifier Detects](#what-metas-classifier-detects)
   - [Why Legitimate Financial Companies Get Flagged](#why-legitimate-financial-companies-get-flagged)
   - [Defense Playbook for Legitimate Companies](#defense-playbook-for-legitimate-companies)
   - [Black Hat Infrastructure Overview (Know Your Enemy)](#black-hat-infrastructure-overview-know-your-enemy)
   - [Meta's AI Enforcement Classifier (Deep Intelligence)](#metas-ai-enforcement-classifier-deep-intelligence)
   - [BM Ban Triggers (Confirmed 2025-2026)](#bm-ban-triggers-confirmed-2025-2026)
   - [BM Ban Cascade (How It Propagates)](#bm-ban-cascade-how-it-propagates)
   - [BM Appeal Process](#bm-appeal-process)
   - [Profile Types and Survival Rates](#profile-types-and-survival-rates)
   - [Niche Classification in Brazil](#niche-classification-in-brazil)
   - [2025-2026 Trends](#2025-2026-trends)
2. [Business Profile Compliance (financial niche) — WhatsApp](#business-profile-compliance-financial-niche--whatsapp)

---

## Defensive Intelligence: Brazilian Black Hat Ecosystem

Understanding the black hat Meta ecosystem in Brazil is defensive knowledge for legitimate financial services companies. The classifier groups all advertisers in a niche together — knowing what triggers penalties helps avoid guilt by association.

### Glossary (Market Jargon)

| Term | Meaning |
|---|---|
| BM | Business Manager (Meta Business Suite) |
| CA250, CA1500 | Ad account tier by daily spend limit (R$250, R$1500) |
| Disposable BM | Throwaway BM bought from the gray market, run aggressively until inevitable ban (also called "BM balão" in Brazilian dispatch circles) |
| Capitão / Soldado | Hierarchical BM structure: Captain holds pixel, Soldiers absorb bans |
| Aquecer | Warming: simulating organic behavior for weeks before advertising |
| Contingência | Rotating stock of profiles, BMs, pages, pixels ready to replace banned ones |
| Cloaking | Showing safe page to Meta bot, real offer to users |
| Pre-sell / Advertorial | Intermediate page (fake article) between ad and checkout |
| Score | Meta's internal reputation score for profiles, BMs, pixels |
| Reativada | BM recovered via appeal, considered more stable post-recovery |
| BM Verify | Business Verification status |

### What Meta's Classifier Detects

**Profile signals:** account age, history consistency, reverse image search on photo, validated phone/email, IP history, friend network plausibility, organic activity before advertising.

**BM signals:** time between creation and first ad, speed of payment method addition, number of ad accounts created sequentially, linked CNPJ status, verification status, payment/ban history.

**Creative signals:** similarity hash to previously banned creatives, copy text classifier triggers, landing page cloaking detection, user report rate, "hide ad" rate.

**Behavioral signals:** login time patterns, navigation patterns, stable vs rotating IP, stable vs changing fingerprint, automation-typical actions (uniform scroll, precisely regular clicks).

**Network signals (cascade mechanism):** BMs linked to same profile, profiles linked to same IP, shared payment methods across accounts, domains used in banned BMs, pixels with bad history. One ban can propagate across everything connected.

### Why Legitimate Financial Companies Get Flagged

1. **Niche guilt by association:** forex, trading, investment keywords trigger the same classifiers that catch black hat operators running unregulated offshore casinos and fake binary options
2. **Domain contamination:** if affiliates or partners run ads to your domain from their BMs and get banned, your domain gets flagged
3. **Creative pattern matching:** any ad mentioning "earn", "profit", "returns", "guaranteed" triggers classifiers trained on thousands of black hat scam ads in Portuguese
4. **New account suspicion:** new BMs in financial niche get extra scrutiny because black hat operators create and burn BMs constantly

### Defense Playbook for Legitimate Companies

#### 1. Business Verification (critical)

Complete Business Verification with real CNPJ, real address, institutional email on company domain. Verified BMs get higher tolerance threshold before automatic ban and access to premium support. This is the single highest-ROI action.

#### 2. Domain hygiene

- Operate only on main company domain (no disposable subdomains)
- Public WHOIS when possible
- Valid SSL, visible privacy policy and terms of use
- Real contact information
- NEVER let affiliates run ads to your domain from their BMs

#### 3. Institutional creative positioning

Emphasize regulation, security, transparency, real team (photos, names, bios). Meta's classifier is trained to distinguish this from the aggressive black hat pattern. Companies positioning as institutions get significantly less friction.

#### 4. Compliance disclaimers in every ad

Include standard financial disclaimers ("past performance does not guarantee future results", "risk of loss", "no guaranteed returns"). Not just regulatory compliance — consistent presence of disclaimers creates a pattern the classifier recognizes as legitimate regulated advertiser.

#### 5. Payment hygiene

Pay Meta with company corporate card matching the BM's CNPJ and billing address. Never use personal employee cards or cards with history on other BMs. Meta cross-references cards: a card used on a banned account "stamps" any new account it's added to.

#### 6. Affiliate separation

If running an affiliate program, maintain contractual and technical separation. Affiliates advertise from their own BMs and pixels, not company infrastructure. Linking affiliates to your main domain exposes it to contamination.

#### 7. Active classifier monitoring

Regularly check Account Quality scores in Business Manager, ad feedback metrics (positive/negative), and account health indicators. Fast reaction to drops is cheaper than recovering from full ban.

### Black Hat Infrastructure Overview (Know Your Enemy)

| Component | What It Is | Why It Matters for Defense |
|---|---|---|
| Antidetect browsers | Browsers with unique fingerprints per profile (Dolphin Anty, Multilogin) | Meta flags multiple accounts from same fingerprint — ensure your legitimate setup has clean, consistent fingerprint |
| Residential proxies | IPs from real connections, $30-200/mo | Meta correlates IPs — never share VPN/proxy with anyone else's ad accounts |
| Disposable virtual cards | Cards from fintechs, used once per BM | Your corporate card should be exclusively yours, never shared |
| Domain rotation | Pools of cheap domains, burned when flagged | Your stable domain is a signal of legitimacy — longevity helps |
| Pixel farming | Fake conversion events to train algorithm | Your real conversion data (CAPI) is a legitimacy signal — send it |
| BM supply chain | Pre-verified BMs sold on npprteam.shop ($19-59), perfilantigo.com (R$39+), mendesbmilimitada.com.br | Thousands of disposable BMs in circulation — legitimate operations must differentiate via stable identity |
| Profile farming | Teams simulate organic behavior on purchased accounts for weeks (shopping via FB login, groups, stories) | Meta's trust score rewards age and activity — legitimate accounts naturally accumulate this |

### Meta's AI Enforcement Classifier (Deep Intelligence)

**Layer 1: Content ML models** — recognize what's in photos/text, predict policy violations. Most violations removed automatically before anyone sees them. Covers languages spoken by 98% of internet users including Portuguese regional slang.

**Layer 2: Behavioral/network graph** — cross-account signal aggregation via shared devices, IPs, phone numbers, payment cards, and BM structure. Violation in one node propagates to connected nodes. This is what triggers cluster bans.

**Layer 3: Human review queue** — uncertain cases queued for human review teams + physical device farms with real operators.

**2025 upgrade confirmed:** AI for adult content detection caught 2x more violations than humans while decreasing mistakes by 60%. Similar upgrades applied to financial fraud and impersonation detection.

**Account Integrity classifier (2025-2026):** Specifically targets account farming, coordinated inauthentic behavior, and linked-account structures. Uses device fingerprints, phone number associations, and behavioral patterns. This is the classifier that fires when multiple BMs share operational infrastructure.

**False positive problem (documented):** May-June 2025 ML filter upgrade caused major wave of innocent content flagged. July 2025: Meta removed 135,000 accounts + 500,000 linked accounts as collateral from graph propagation. The system is acknowledged to be "too aggressive" in some areas.

### BM Ban Triggers (Confirmed 2025-2026)

| Category | Trigger | Severity |
|---|---|---|
| **Authenticity** | Creating BM with purchased/fake profile | Critical |
| **Authenticity** | Profile registered on Windows (higher suspicion than mobile) | Medium |
| **Authenticity** | Profile under 90 days creating a BM | High |
| **Network** | Login from multiple IPs/geos in short windows | High |
| **Network** | IP previously associated with banned BM ("dirty list") | Critical |
| **Network** | Shared device fingerprint across multiple BMs | Critical |
| **Financial** | Rapid budget scaling ($20 → $500 in <7 days) | High |
| **Financial** | Card previously on banned BM (dirty-list 6-12 months) | Critical |
| **Financial** | Payment geo mismatch vs declared business geo | Medium |
| **Policy** | UBP (Unacceptable Business Practices): MLM, returns, health claims | Critical |
| **Policy** | High chargeback rates on payment processor | High |
| **Operational** | Adding admin profile under checkpoint/restriction | High |
| **Operational** | Adding multiple ad accounts in first 7 days | Medium |
| **Operational** | Creating BM immediately after profile creation | High |

### BM Ban Cascade (How It Propagates)

**BM restriction → All assets inside:** Instantaneous. Every user, ad account, page, pixel, WABA under that BM goes down simultaneously.

**Admin profile ban → BM risk:** If sole admin is banned, BM becomes disabled. Mitigation: always 2+ admin profiles.

**Cluster-linked BMs:** BMs sharing device fingerprint, proxy IP, or payment card get linked in Meta's graph. One ban cascades to ALL linked BMs within hours.

**Cross-platform cascade (2025-2026):** Instagram + Facebook + WhatsApp + Threads are identity-linked. A flag on any platform can cascade across the entire identity graph.

**Direction of BM-WABA cascade:**
- BM disabled → ALL WABAs lose API access, numbers go to "Disabled" (catastrophic)
- WABA/number banned → BM survives, other assets unaffected (granular, recoverable)
- Phone number ban is the more recoverable event. BM ban is catastrophic.

### BM Appeal Process

**Tier 1 (Automated):** "Request Review" in Business Support Home. Resolves ~35% of false positives within 24h. No human involved.

**Tier 2 (Human review):** Policy team review. 3-5 business days. Must provide specific compliance explanation, not generic denial.

**Tier 3 (Policy Advisory Board):** Complex/high-value cases. 10-15 business days. Rare.

**Critical deadline:** After 180 days disabled, reinstatement is not possible.

**Recovery Action Plan (new 2026):** Complete compliance training → submit corrective action plan → pass re-certification → account reinstated with 30-day probation (all ads manually reviewed during probation).

### Profile Types and Survival Rates

| Type | Source | Survival Rate | Price |
|---|---|---|---|
| Self-reg (autoreg) | Bot-created, no history | ~10% on first action | Cheapest (bulk) |
| CPRD | Pre-verified, minimal history | Moderate | Mid-range |
| Farm (farmado) | Manually cultivated weeks/months | ~90% | R$80-200 |
| King/Real | 1+ month manual cultivation, full docs | Highest | Premium |
| Aged (antigo) | 2008-2015 era, high trust score | High if warmed | R$39+ |

**Profile warming phases:**
1. Days 1-3: 4G/5G only, humanized photo, 3-5 real contacts
2. Days 4-9: Join sticker groups, receive 50-200 media files from established accounts (builds receive/send ratio)
3. Days 7-14: Join groups, like/comment/share, view stories, connect to Mercado Livre/Shopee via FB login
4. Day 14+: Create or join BM, run small engagement campaigns R$5/day

### Niche Classification in Brazil

| Category | Examples | Risk for Meta Classifier |
|---|---|---|
| Black (prohibited) | Offshore casino, unregulated forex with guaranteed returns, nutra with medical claims, crypto scams | Instant ban |
| Gray (edge) | Dropshipping with long delivery, "earn R$10k in 30 days" infoproducts, crypto education | High scrutiny, frequent disapprovals |
| White (legitimate) | Regulated financial services, licensed trading platforms, educational content with disclaimers | Low risk if properly positioned |

A legitimate operator in the White category (e.g. a regulated financial-services company) differentiates from black-hat operators by: (a) regulatory registration, (b) no guaranteed-return promises, (c) documented compliance, (d) a verified BM with a real CNPJ.

### 2025-2026 Trends

- **Intensified Meta crackdowns:** verified BMs getting mass-disabled alongside common ones. Verification increases scrutiny for violators. July 2025: 135k accounts + 500k linked removed in single sweep.
- **AI on both sides:** Meta uses AI for cloaking detection, image analysis, behavioral anomaly detection. Black hat operators use AI for mass creative generation and synthetic profile creation.
- **Account Integrity ban wave (July 2025-present):** Shared workplace devices/IPs causing legitimate accounts flagged as "linked accounts". Cascading blocks via guilt-by-association.
- **CNPJ cross-verification:** Meta now cross-references CNPJ with Brazilian public databases (Receita Federal), flagging inconsistencies (inactive CNPJ, mismatched address). Benefits legitimate companies.
- **CPF/CNPJ blacklisting:** Brazilian documents linked to permanently banned BMs create persistent blacklist entries. Total investment loss, blocking of all linked accounts.
- **Financial identity verification (March 2026):** Meta now requires identity verification for financial product advertisers (banking, lending, fintech, crypto) as additional compliance layer.
- **Regulatory convergence:** CVM, Banco Central, Senacon, ANPD increasingly monitoring digital advertising in sensitive niches. Receita Federal cross-referencing Pix transactions with tax returns.
- **Meta ML detection rate:** reportedly detects 95% of traditional proxy connections, VPNs, shared residential IPs. Only mobile proxies remain effective.
- **BM supply chain scale:** npprteam.shop's top product (Verified BM with WABAs, $59) has 1,713 orders — thousands of disposable BMs in active circulation.

---

## Business Profile Compliance (financial niche) — WhatsApp

### Business Profile Compliance (financial niche)

**The profile IS reviewed by Meta** — reactively (when account is flagged for any reason: spam reports, volume spikes, blocks), not proactively like templates. Meta's terms: "WhatsApp may review, remove, or delete Company Content you share on your business profile." A profile that contradicts the WABA category becomes evidence of deception during review.

**Category + About + Description must tell ONE coherent story.** Mismatch (e.g., category "Education" but description says "managed capital") is a compounding risk during review.

**Profile risk spectrum (Brazil financial/investment):**
| Phrase | Meta risk | CVM risk | Use? |
|---|---|---|---|
| "educação financeira" | None | None | ✅ Safe |
| "comunidade de investidores" | None | None | ✅ Safe |
| "mercado financeiro" / "mercado de capitais" | None | None | ✅ Safe |
| "compartilhamos análises/estratégias" | None | None | ✅ Safe |
| "gestão de capital" | Medium | High (CVM authorization required) | ❌ Avoid |
| "gerenciamos seu capital" | High | Very High | ❌ Never |
| "retorno garantido" / "rentabilidade garantida" | Instant flag | Criminal-level | ❌ Never |

**Key distinction (Brazilian law):**
- Educação financeira (teaching markets/strategies) = NO CVM authorization needed
- Consultoria de investimentos (personalized advice) = CVM registration required
- Gestão de carteiras (managing portfolios) = CVM authorization required
- "Compartilhamos" (we share) is safe; "gerenciamos" (we manage) triggers regulation

**CVM is aggressive (2025):** 24 platforms suspended, R$1k/day fines. Meta + CVM risk are independent but additive — "gestão de capital" hits both at once.

**Complete profile is SAFER than minimal** (counterintuitive but consistent):
- Quality rating depends on message reception, NOT profile completeness
- Empty/sparse profile looks like scam → more blocks → worse quality rating
- Complete + coherent profile looks legitimate during manual review
- Website in profile must match WABA display name footprint (helps display name approval)
- Email: use domain email, NOT Gmail (raises trust questions)
- Address: city/state or "Brasil" is enough — fill it, don't leave empty

**The "surface area" myth:** more profile info = more consistency signals, not more attack surface. The real risk in a disposable BM is messaging behavior (spam, opt-ins, volume), not profile text. Write clean copy, don't leave fields empty.

**Website field is CRITICAL for display name approval (not optional):**
- Meta requires a working website to approve a display name (confirmed across 12+ BSP sources)
- The display name must literally APPEAR on the website
- Meta primarily checks the BM-registered website; the profile website field is secondary but also checked
- When brand name ≠ legal entity: the website must show BOTH — brand in header/body, legal entity + CNPJ in footer ("Brand powered by Legal Entity" pattern, recommended by 360dialog/Wati)
- Empty website field = near-certain display name rejection
- If the BM website is locked and doesn't show the brand, the profile website field pointing to a brand-showing site is your ONLY lever — fill it
- Updating the website field during a pending review has no documented downside; reviewer may pick it up
- Profile website field ≠ for isolation. Put the disposable brand site, NOT the real client domain
- Email field: leave empty for isolation if you'd otherwise use the real domain (links WABA → real brand). Website (disposable site) is fine and necessary; email (real domain) is the actual isolation risk.
