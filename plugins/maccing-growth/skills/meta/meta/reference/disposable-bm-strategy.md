## Contents

1. [BM Ban Triggers (Confirmed 2025-2026)](#bm-ban-triggers-confirmed-2025-2026)
2. [BM Ban Cascade (How It Propagates)](#bm-ban-cascade-how-it-propagates)
3. [BM Appeal Process](#bm-appeal-process)
4. [Dispatch Infrastructure (Disposable BM Strategy)](#dispatch-infrastructure-disposable-bm-strategy)
   - [Overview](#overview)
   - [Full Pipeline Architecture](#full-pipeline-architecture)
   - [Required Stack](#required-stack)
   - [Running Disposable BMs in Parallel (Second Disposable BM)](#running-disposable-bms-in-parallel-second-disposable-bm)
   - [Tier System (Current State, Oct 2025 Onward)](#tier-system-current-state-oct-2025-onward)
   - [BM Sources (Market Reference)](#bm-sources-market-reference)
   - [Number Warming Protocol (Official WABA)](#number-warming-protocol-official-waba)
   - [Chip Warming (Unofficial API Route)](#chip-warming-unofficial-api-route)
   - [Setup Sequence (Detailed)](#setup-sequence-detailed)
   - [Display Name Strategy (Mismatched BM Entity)](#display-name-strategy-mismatched-bm-entity)
   - [Phone Number Strategy (Brazil, 2025-2026)](#phone-number-strategy-brazil-2025-2026)
   - [Virtual Numbers for Brazil](#virtual-numbers-for-brazil)
   - [Cost of a Ban Cycle](#cost-of-a-ban-cycle)
   - [Burn and Replace Pattern](#burn-and-replace-pattern)
   - [Number Longevity & Cold Lists (preserve over burn)](#number-longevity--cold-lists-preserve-over-burn)

---

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

---

## Dispatch Infrastructure (Disposable BM Strategy)

### Overview

A **disposable BM** is a throwaway, pre-verified Business Manager bought from the parallel/gray market, used to validate the WhatsApp broadcast channel before investing in permanent infrastructure. Expected lifecycle: weeks to months. When it falls, the validated learnings (template performance, block rates, conversion data) transfer to the permanent BM. (In Brazilian black-hat / gray-market dispatch circles this is called a "BM balão" or "balloon" — this skill deliberately uses the neutral term "disposable BM".)

### Full Pipeline Architecture

```
[1] PROFILE ACQUISITION (R$18-216, GGMax/perfilantigo)
     ↓
[2] PROFILE WARMING (7-14 days, antidetect + proxy)
     ↓
[3] BM ACCESS (purchase invite link or create fresh)
     ↓
[4] BM VERIFICATION (pre-verified purchase OR real CNPJ docs)
     ↓
[5] WABA / PHONE NUMBER ATTACHMENT
     ↓
[6] NUMBER WARMING (official API: tier escalation per quality)
     ↓
[7] TEMPLATE CREATION & APPROVAL
     ↓
[8] TEST BROADCAST (50-100 contacts, measure block rate)
     ↓
[9] SCALE DISPATCH (gradual, quality-gated)
     ↓
[10] MONITOR / BURN & REPLACE (when banned)
```

### Required Stack

| Component | Recommended | Cost |
|---|---|---|
| BM Disparo | Purchased with WABA + dispatch tier | R$100-350 (or $19-59 USD international) |
| Profile (primary admin) | BR 2025-2026 / 1-3 Fanpages | ~R$216 |
| Profile (backup admin) | Mix antigo / Sem Fanpages | ~R$18 |
| Proxy | Dedicated SOCKS5, country-matched (see Proxy Selection below) | ~R$30/mês |
| Antidetect browser | AdsPower (free tier, 2 profiles) | R$0 |
| Virtual card | Wise/Revolut (separate from other BMs) | R$0 |
| Total initial | — | ~R$370-620 + ~R$30/mês |

**Isolation rules:**
- NEVER link company domain to disposable BM
- NEVER share proxy/card with other BMs
- NEVER use personal profile as admin
- NEVER reuse a card that was on a banned BM (dirty-list persists 6-12 months)
- Treat as disposable from day 1
- **Proxy is a PRECONDITION of opening the antidetect profile, NOT a per-step check.** The profile is NEVER opened without its proxy already attached, so once it is open the proxy is a given. Never re-verify "is the proxy on?" mid-flow, opening the profile already implies it.
- **Between disposable BMs, isolate the IP FAMILY, not just the IP.** Parallel disposable BMs use different proxies AND ideally different IP families (e.g. disposable BM #1 on IPv6, disposable BM #2 on IPv4), so Meta cannot graph-link them by adjacent range. Same for card and number: one per disposable BM.
- **Browser automation discipline** (own-profile/CDP rule, agent-vs-operator visibility gotcha, undetectable behavior, the MCP read recipe): see `reference/automation.md`.

### Running Disposable BMs in Parallel (Second Disposable BM)

Running a 2nd (or Nth) disposable BM in parallel buys redundancy (one falls, the others keep warming) and multiplies daily capacity. The learnings transfer (approved template copy, the warming ramp, the recent-signups nurture pool), only the infrastructure is new.

- **Full isolation BETWEEN disposable BMs**, not just versus the company: separate antidetect profile, separate proxy on a different IP family/range, separate virtual card, separate number. Anything shared lets Meta graph-link them, and one ban then cascades to all.
- **Templates are per-WABA.** Reuse the exact approved copy, but each WABA submits its own templates (approval does not transfer between WABAs).
- **One BSP account per disposable BM (RULE, recommended practice).** Each profile gets its OWN YCloud (BSP) account with its own email, NEVER a shared YCloud account running a 2nd channel for the second disposable BM (even though the Free plan technically allows 2 channels). Rationale (observed in production): YCloud false-positive-suspended a disposable BM's BSP account once, and if both disposable BMs shared that account the suspension would have taken down BOTH at once. A separate BSP account makes a suspension hit only that one disposable BM and keeps each disposable BM independent end to end: proxy, card, number AND BSP account. BSP-level linking is lower risk than Meta-level (proxy/card/pixel) linking, but a separate account removes the single point of failure entirely.
- **Split the contact lists.** The renewable recent-signups pool can feed all disposable BMs, but never message the same lead from two numbers (looks like spam, and the per-user marketing cap, error 131049, applies across senders).
- **Stagger the sends.** Avoid broadcasting from both numbers in the same window, spacing keeps the footprints distinct and avoids a correlated quality dip.

### Tier System (Current State, Oct 2025 Onward)

**Current tier behavior (empirically confirmed in production on a live WABA via YCloud, May 2026):**

| Status | Daily Limit | How to Reach |
|---|---|---|
| Unverified BM | 250 unique users/day | Starting point |
| Verified BM (initial) | 2,000/day (Tier 1 per Oct 2025 schema) | Business verification approved |
| Tier 2 | 10,000/day | Auto-scale: 50% of 2,000 limit used in 7 days at Green/Yellow quality |
| Tier 3 | 100,000/day | Auto-scale |
| Tier 4 | Unlimited | Enterprise |

The earlier claim that "Verified BM → direct jump to 100,000/day" was **disproved by production dashboard observation** (verified BM showed 2,000/day, consistent with the standard Oct 2025 tier schema). The '100K jump for verified BMs' is an announced Meta roadmap item (Q1-Q2 2026 rollout), not yet universally applied.

**Tier advancement rule:** At least 50% of current limit used in any 7-day window AND quality rating is Green or Yellow (not Red). Evaluation every 6 hours. Advancement is automatic within hours of meeting criteria.

**Pre-2026 advancement thresholds (now superseded):** The old table showing "500 unique users for Tier 1→2" used incorrect absolute numbers — the actual rule was always "50% of current limit in 7 days." For Tier 1 (1,000 limit) that was ~500 users, but the threshold was proportional not fixed. For Tier 3→4 (10,000 limit) the threshold was ~5,000 (not 20,000). These absolute-number references are now obsolete.

**Key changes (Oct 2025 onward):**
- Tier evaluation now every 6 hours (was 24h)
- Limits apply per Business Portfolio, not per phone number (Oct 2025)
- New numbers added to a verified portfolio inherit the portfolio's tier immediately
- Meta limits per-user marketing messages at an undisclosed daily threshold (estimated ~2/day); exceeded cap returns error **131049** (not 130472)

**Upcoming (Q1-Q2 2026, partial rollout):** Meta intends to remove the 2K and 10K intermediate tiers so verified businesses jump directly to 100K. As of May 2026 this has NOT been universally applied. Treat as pending.

### BM Sources (Market Reference)

**International vendors (serving Brazil):**

| Vendor | Product | Price |
|---|---|---|
| npprteam.shop | Brazil Verified BM $50 limit, WABA-eligible | $19 USD |
| npprteam.shop | Verified BM with WABAs, $250 limit, 1k-2k msg/day, 2 numbers | $59 USD |
| verifiedbm.shop | Verified BM + WhatsApp API | Variable |
| dhaka-bm.com | WhatsApp API BM, 250 or 2000 msg/day | Negotiable |

**Brazilian domestic vendors:**

| Vendor | Product | Price |
|---|---|---|
| perfilantigo.com | BM + profile bundle | R$39+ |
| mendesbmilimitada.com.br | BM Ilimitada (verified profile) | Variable |
| proxybrasil.com | BM Verificada $250 + WhatsApp API | ~R$250 |

**Survival rates by BM type:**

| BM Type | Price (USD) | Daily Limit | Lifespan Under Load |
|---|---|---|---|
| Reinstated BM | $1.60-1.90 | $50 | 1-3 days |
| BM via WhatsApp flow | $0.76-0.95 | $50 | 1-5 days |
| BM3 (3 ad accounts) | $4.10-4.65 | $50 | 5-10 days |
| BM5 $50 limit | $7.51-17.60 | $50 | 7-14 days |
| BM5 $250 limit | $34.90-241.80 | $250 | 14-30 days |
| Verified BM $50 | $24.70-59.00 | $50 | 14-30 days |
| Unlimited BM | $97.02-429.00 | No cap | 30-90+ days |

**Industry reality:** Only 10-20% of purchased BMs survive the first 30 days under real advertising load.

### Number Warming Protocol (Official WABA)

**Post-Oct 2025: new numbers inherit the portfolio's tier instantly** (e.g., verified BM at Tier 2 = 2000/day from day 1). BUT inheriting the LIMIT ≠ safe to use it. Quality rating + pacing system are per-number and built from real behavior. Hitting full limit on a new number looks like bot behavior.

**The limit is the ceiling, NOT the day-1 target. Warm the number regardless:**

| Day | Safe Volume | Recipients |
|---|---|---|
| 1 | 20-50 | WARM only: team + admins + people who expect the message |
| 2 | 50-100 | Engaged/known contacts |
| 3-4 | 100-300 | Semi-warm (prior brand interaction) |
| 5-6 | 200-500 | Warmest subset of cold list — ONLY if quality Green |
| 7 | assess | Review quality before scaling |
| 8-14 | 800-1500 | If Green throughout |
| 15+ | follow tier | Full limit, only if Green holds |

**The #1 ban cause: blasting a cold list on a new number.** New number = zero quality buffer. Cold marketing broadcast (no opt-in) → high block rate → Red status in hours → permanent number ban. A single bad broadcast kills a new number. This is universal across all sources.

**Block rate thresholds (industry-derived, Meta doesn't publish):**
- <0.5% healthy, ~1% Yellow nudge, >2% Red risk, >5% serious ban risk
- On a 50-contact send, 1 block = 2%. First send MUST be warm contacts (0 blocks achievable).

**Quality rating mechanics:**
- Reflects rolling 7-day feedback (blocks, spam reports, read rate, error 131049 frequency saturation)
- Recalculates ~every 24h
- Recovery: Yellow→Green 48-72h, Red→Green 7-14 days, number ban = PERMANENT
- Post-Oct 2025: "Flagged" status eliminated; Red prevents tier upgrade but doesn't auto-downgrade. Sustained Red + any policy violation = immediate disable.

**Emergency stop signals:** quality → Red, Meta warning message, frequent error 131049, read rate <20%.

**Wallet funding — fund ONE DAY AT A TIME (never pre-fund the ramp):** BSP platform may be free (YCloud), but Meta charges per delivered message from a prepaid wallet — NO free marketing messages, so top up before Day 1. From then on, top up **only the current day's send budget plus a small buffer, every day, immediately before that day's send. NEVER bulk-fund multiple days ahead** — even when a ramp plan tempts a single larger top-up to "sustain the week". A disposable BSP account can be suspended or false-positive risk-flagged at ANY moment (observed repeatedly on free tiers for financial-niche accounts), and a large prepaid balance is then frozen, slow, or impossible to recover. Per-day funding caps the at-risk balance at one day's spend (~$10-15 for a few hundred BR marketing msgs) instead of a whole week's, and forces a daily go/no-go check on quality + account health before any money is committed.

**Rules:**
- Randomize send intervals (mimic human timing) (see `reference/automation.md` §3 message-dispatch axis)
- Monitor BOTH BSP dashboard (delivery/read) AND Meta Business Manager Quality Rating column after every batch
- Financial niche + Brazil = recipients trigger-happy on "report spam" → warm harder

### Chip Warming (Unofficial API Route)

For operators using unofficial APIs (Evolution API, WPPConnect, WasenderAPI) on burner SIMs:

| Period | Daily Limit | Content |
|---|---|---|
| Days 1-3 | Up to 20 messages | Text only, no links/media |
| Days 4-7 | Up to 50 messages | Can add emojis |
| Days 7-14 | Progressive increase | Media allowed |
| Days 14-21 | Begin API automation | Links allowed |
| Days 21-30 | Normal volume | Full content |

**Critical:** Use 4G/5G exclusively during warming. Get inbound messages (sticker groups, contacts calling the number) before sending outbound. A receive-only account builds trust; a send-only account is definitionally a bot.

**Anti-detection for unofficial API:**
- Random delays: 15-45 seconds between each message
- Rest periods: 10-15 minute breaks after every 50 messages
- Spintax rotation: no two messages identical
- Maintain positive sent/received ratio
- Consistent IP: never login from multiple countries
- Persistent session: frequent reconnections flagged as suspicious
- Avoid shortened URLs (bit.ly etc.)

**Risk:** Meta blocked ~7 million WhatsApp accounts in H1 2025. Financial keywords (boleto, PIX, cartão, investimento) trigger higher scrutiny.

### Setup Sequence (Detailed)

#### Operator Data-Request Protocol (MANDATORY)

The operator drives the browser, the agent drives the data collection. At every gate the agent MUST proactively REQUEST the specific screenshot or value from the operator, verify it, and record it into project state BEFORE advancing. NEVER passively wait for the operator to volunteer it, never assume, never skip a check. At minimum, request and record each of these:

| Gate | Request from the operator | Record / verify |
|------|---------------------------|-----------------|
| Profile open | Print of the FB profile (name, ID, friends count) | Profile identity |
| Proxy | Print of the AdsPower profile list showing the IP | Proxy IP + family, isolation vs the other disposable BMs |
| Account status | Print of `facebook.com/account_status` (and `/profile_status/<id>`) | "Sem restrições" vs any restriction, this GATES the BM accept |
| Central de Contas | Print of profile + contact email + DOB | Single-profile isolation, disposable email, DOB |
| BM accept step 1 | Print of the name/email wizard | Name entered, notification email |
| BM accept step 2 | Print of "Analisar informações da empresa" | Verification status, Razão social + CNPJ, site, whether assets already exist (burn-check) |
| BM accept step 3 | Print of "Leia e aceite o convite" | Disclosures + ToS |
| Post-accept home | Print of `business_home` | BM ID (from the URL), alerts, empty portfolio |
| BM settings | Print/text of Configurações portfolio info | Full BM data: CNPJ, address, phone, verification date, ad-account limit, 2FA, admin contact |
| Role | Print of `Configurações → Pessoas` | Role label = Admin / full control (required for Embedded Signup) |

After each gate, write the confirmed values into the project state README in the SAME session. This protocol is how the skill stays retro-fed: every print the operator sends becomes documented state.

#### Verified vs Practitioner Lore (2026 deep-research, primary-sourced)

**Maintenance principle: this skill is ALWAYS retro-fed and corrected from real operator runs.** Every step actually executed gets documented here, and every claim is tagged by provenance, "observed live" (first-party from a real run), "primary-sourced" (Meta/BSP docs), or "practitioner lore" (community convention, unverified). When a real run contradicts the skill, fix the skill in the SAME session. Live observation outranks blog lore and overrides stale claims.

A 2026 multi-source verification pass (23 sources, 25 claims adversarially voted, 11 confirmed / 14 killed) separated what Meta actually documents from widely-repeated community lore. Treat the two differently.

**Confirmed (primary sources, survived adversarial review):**
- **Admin role is required to complete BSP Embedded Signup.** Only the owner/Admin of the Business Portfolio can run the flow, an "Employee" cannot even select the portfolio, and the BSP cannot navigate it for you (you authenticate with your own Facebook Login). When accepting a purchased BM, VERIFY the granted role is Admin / full control, otherwise WABA setup is blocked later. Sources: docs.360dialog.com, docs.gupshup.io (3-0).
- **The system user, not the human admin, is the API identity for dispatch.** WhatsApp API tokens are generated by the BM's system user (a server/software credential that does NOT go through Facebook Login OAuth), which insulates the human profile from API-level actions. The human admin is needed only to start Embedded Signup and assign assets. Personal-user tokens are technically valid but impractical (~24h expiry). Source: developers.facebook.com (2-1).
- **Ban-cascade enforcement is OWNER-based.** Meta's Account Integrity policy disables assets "owned by the same person or entity as an account that has been disabled." This is exactly why per-disposable-BM isolation (separate profile, proxy, card, number) works: it denies Meta the same-owner signal. The stronger "mere network proximity / shared admin also cascades" claim was REFUTED (1-2), and whether simply being admin of a burned BM contaminates your own assets is unverified. Source: transparency.meta.com (3-0).
- **A temporary restriction right after Embedded Signup is NORMAL, not a burn.** Meta auto-reviews business info, website, display name, and Commerce Policy after signup, during which "messaging may be limited" and "the account could appear temporarily restricted." Do not panic-diagnose this as a dead BM, it is expected onboarding. Source: docs.360dialog.com (3-0).
- **Reusing the SAME display name across multiple WABAs/BMs is ALLOWED and is not a known linking signal.** WhatsApp display names are NOT globally unique (no anti-duplication rule across 360dialog/Gupshup/WATI/GoHighLevel, 3-0). Approval checks brand-to-website-to-legal-name correlation, and reusing an established brand can actually HELP approval. The impersonation rule targets third-party brands, not reusing your OWN brand. Meta's association detection is opaque but focuses on ORGANIZATIONAL signals (same BM, phone reuse, business details), not the display-name text, and the "name reuse = evasion signal" theory was refuted (1-2). So the same brand on a second disposable BM is safe for approval; the cross-BM risk is the same-owner cascade, addressed by the isolation stack (separate profile/proxy/BSP/card/number/CNPJ), NOT the name. Caveat: no primary Meta source (Help Center is JS-rendered/unfetchable) and no BR-community source confirmed this, so "name is not a signal" is absence-of-evidence, not positive proof, treat conservatively. Source: 360dialog/Gupshup/WATI docs + transparency.meta.com (2026 deep-research). NB: 2026 @usernames ARE globally unique, that is a different field from the display name.

**NOT primary-sourced (practitioner lore, plausible but unverified):**
- The Nome/Sobrenome + "Email comercial" fields: the research found NO doc on this (blog claims refuted 0-3), but the accept wizard's own Step 3 answers it FIRST-PARTY (observed live 2026): your name/email and the actions you take on behalf of the BM are visible to other managers of that business, and "actions on behalf of the business are NOT shared on your personal profile." So the name is the work-display identity and the personal profile is insulated from business-side actions. Full walkthrough in the "BM Invite Acceptance Wizard" section below.
- Why some accepts skip the name wizard (link vs in-app vs direct-provisioning). Open question, no primary source.
- The exact Account Quality UI (color codes, tabs, navigation). All refuted 0-3, trust the LIVE screen, not blog screenshots. Meta renamed "Business Manager" to "Business Portfolio" in 2024, so older guides are stale.
- The gray-market accept hygiene itself (consistent proxy/antidetect IP at accept, the 24h BM rest, the disposable BM workflow). No primary sourcing, these are sensible community conventions, undocumented by Meta.

**BM de disparo (WABA-only) does NOT require profile warmup.** Profile warmup (browsing, liking posts, joining groups) protects Facebook ad accounts from Meta's Ads algorithm trust checks. WABA trust is evaluated through Business Portfolio verification + phone number quality rating, which are completely separate systems. A freshly acquired profile can immediately set up WABA without triggering ad-related trust checks because WABA setup involves zero ad account activity.

The only warmup that matters for WhatsApp dispatch is the **gradual message volume increase on the phone number itself** (see Number Warming Protocol above).

**Phase 1: Infrastructure (Day 0)**
1. Install AdsPower, create browser profile(s)
2. Configure dedicated proxy (SOCKS5, BR) per profile
3. Set fingerprint: timezone BRT, language PT-BR, consistent resolution
4. Create separate virtual card (Wise/Revolut)

**Phase 2: Profile Login + BM Accept (Day 1)**
5. Import profile cookies into antidetect
6. Open facebook.com — should land logged in via cookies
7. Check Account Status immediately. **Path: profile photo (top-right) → Ajuda e suporte / Help & support → Status da Conta / Account Status.** It is NOT under Settings or the settings search (not indexed there). Direct URLs: `facebook.com/account_status` or `facebook.com/profile_status/<profile-id>`. Clean = "Sem restrições / Tudo certo com sua conta" (bonus health signal: Marketplace "Ativo"). Any restriction, limited feature, or pending "Confirmação de identidade" demand: do NOT accept the BM, invoke the supplier guarantee.
8. Accept BM invite link in same antidetect session (within supplier deadline!). VERIFY the granted role is **Admin / full control**, NOT "Employee" (an Employee cannot run the later BSP Embedded Signup, confirmed 3-0, see Verified Findings above). The invite-link wizard may ask for a display name + a notification email, this is standard for joining a portfolio, enter the profile's name and leave the supplier's disposable email.
9. Do NOT touch the BM for 24 hours (let Meta's systems settle)

#### BM Invite Acceptance Wizard (Business Portfolio, observed live 2026)

The invite-link accept (`business.facebook.com/invitation/?token=...`) is a 3-step wizard. Meta does not document it publicly, this is first-party observation, an in-app accept via Business Suite notifications may differ.

**Step 1 of 3, "Você recebeu um convite para participar de [BM]":** enter Nome + Sobrenome ("como você quer que apareça neste portfólio empresarial", your display identity inside the portfolio) and a notification "Email comercial" (pre-filled, fine to leave the supplier's disposable one). Optional Meta-marketing checkbox, leave it unchecked. Use the profile's own name for consistency, and NEVER an email that links to the real brand.

**Step 2 of 3, "Analisar informações da empresa" (the burn-check surface):** shows the BM display name, creation date, and **business verification status** (Verificada / Não verificada). "Verificada" is the key win, it means Tier 2 (2000/day) from day one with no document submission. Also shows Razão social + CNPJ, País, and the registered Site (LOCKED on a verified BM, NEVER change it), plus whether the portfolio already has a Page/Instagram/WhatsApp with >1000 followers (a fresh disposable BM shows none). A fresh, verified, empty, no-violation BR portfolio is the healthy case, pre-existing assets or restriction notices here are the burn signal.

**Step 3 of 3, "Leia e aceite o convite" (first-party answer to the name/insulation question):** re-shows your Nome + Email, then states verbatim:
1. "Seu nome, email e ações que você realiza em nome de [BM] ficarão visíveis para outras pessoas que gerenciam esta empresa." (the name IS the work-display identity, visible to co-managers).
2. "As ações que você realizar em nome dessa empresa NÃO serão compartilhadas no seu perfil pessoal." (Meta's own UI confirms the personal profile is insulated from business-side actions, corroborating the system-user finding).
3. People with full control of the portfolio can see whether you enabled 2FA.
Accepting joins the portfolio and agrees to Meta ToS + Commercial Terms. Click "Aceitar convite".

**The wizard does NOT show or set your ROLE.** Admin vs Employee is whatever the inviter granted, verify it AFTER accepting at `business.facebook.com → Configurações → Pessoas` (your access level). Admin / full control is required for the later BSP Embedded Signup, if it is Employee, ask the supplier to re-grant as Admin.

**Phase 3: Security Hardening + WABA Setup (Day 2, split sessions)**

Hardening and WABA setup can happen on the same day (different entities: profile vs BM), but must NOT happen in the same 2-hour window. The cluster of password change + 2FA + admin changes + asset creation resembles an account takeover to Meta's automated systems. Split into two sessions with a 2-4h rest. **Hardening ALWAYS before WABA** — security changes after WABA is live can trigger re-verification.

**Morning session: Profile Hardening**
10. Change Facebook password, enable 2FA (authenticator app)
11. Add backup profile as second BM admin
12. ⏸ **REST 2-4 hours** — do not perform any BM operations

Note: purchased profiles typically come with temporary/disposable emails (tuamaeaquelaursa.com, mail.tm, tempail, etc.). No need to secure those — just change Facebook password + 2FA. The temp email becomes irrelevant once Facebook credentials are yours.

**Afternoon session: WABA Setup**
13. Fill out Business Information in BM (legal name, address, website, email — must be complete BEFORE Embedded Signup)
14. Choose BSP and initiate Embedded Signup (360dialog, WATI, Disparo Pro, etc.)
15. Create WABA + set display name (Meta reviews display name: 1-3 days)
16. Register phone number via OTP (SMS or voice call)
17. Number active within 60-120 min post-verification
18. Attach virtual card to BM for billing
19. Set WhatsApp profile: picture, business description, category

**Deferred: Remove supplier admin (Day 8+)**
20. Facebook enforces a 7-day restriction: new admins cannot remove other admins for 7 days after accepting the BM invite
21. Do NOT attempt removal before the 7-day window — the blocked attempt itself registers as a BM-level security event
22. Sequence: add backup admin first (Phase 3) → confirm backup has access → remove supplier admin (Day 8+)

**Phase 4: Phone Number Requirements**
- Never previously registered on any WhatsApp product (consumer, Business App, or API)
- Must receive SMS or voice calls (no IVR-only, no short codes)
- If migrating from Business App: delete that account first, wait up to 30 days
- Max 2 numbers on unverified BM; 20 after business verification

**Phase 5: Templates (Day 2-3)**
23. Create marketing templates and submit for approval
24. Approval timeline: minutes to 4h (ML-automated), up to 24h if flagged for manual review
25. Pre-design templates before submitting (see Template Strategy below)

**Phase 6: Testing (Day 3-4)**
26. Test broadcast: 50-100 opted-in contacts
27. Measure: delivery rate, read rate, block rate
28. If block rate >2%: stop, review template content
29. If green: proceed to number warmup ramp

**Phase 7: Number Warmup + Scale (Day 4+)**
30. Follow Number Warming Protocol above (50→100→250→500→1,000/day over 15 days)
31. Wait for tier evaluation (every 6 hours)
32. Monitor quality rating daily
33. Scale horizontally by adding numbers under same portfolio (inherit tier)

**Phase 8: Business Verification (submit Day 1, approval 1-14 days)**
34. Submit verification documents simultaneously with setup
35. Verification unlocks: 2,000 conversations/day (Tier 1 per Oct 2025 schema) + up to 20 phone numbers
36. Since Oct 2025: messaging limits are per Business Portfolio, not per number — new numbers added to a verified portfolio inherit the tier immediately

**Timeline: BM purchased → first message sent in 3-5 days** (1 day BM rest + hardening + WABA setup + display name review + template approval). No profile warmup days wasted.

**What was removed and why:**
- ~~7-day profile warmup (browse feed, like posts, join groups)~~: protects ad accounts only. WABA trust model is independent. Confirmed by supplier, Meta developer docs, and Brazilian dispatch community (disparopro.com.br, socialhub.pro, blackrat.pro). No BSP or WABA setup guide mentions profile warmup as a prerequisite.
- ~~Ad warmup campaigns (awareness → engagement → conversion)~~: already removed in 2026-05-10 update.
- ~~Remove supplier admin on Day 2~~: Facebook enforces 7-day wait for new admins to remove other admins. Deferred to Day 8+.

**What was kept:**
- 24h no-use period after BM accept: low-cost precaution to let Meta's systems settle.
- 2-4h rest between hardening and WABA setup: prevents account-takeover behavioral signature.

### Display Name Strategy (Mismatched BM Entity)

Meta does NOT require the display name to match the BM's legal entity name. The real rule: the display name must have a **publicly verifiable relationship** with the business, proven via the website. Confirmed by 360dialog, WATI, AiSensy, Salesforce/Meta docs.

**The website footer strategy (documented, sanctioned solution):**
When the BM legal name differs from the desired brand, the website must show both:
- Display name prominently in header/logo/title
- BM legal entity in footer: `[Brand] — operado por [BM Legal Name] | CNPJ XX.XXX.XXX/0001-XX`

**Display name rules:**
- Must appear on a live, accessible website linked in BM settings
- Cannot be a generic noun alone ("Trading", "Community", "Signals")
- Cannot include "Oficial", "Verificado", or implied status words
- Cannot be all caps unless branded that way everywhere
- Cannot include the agency/intermediary name (that goes in the footer only)
- Minimum 3 characters
- **Forbidden characters:** `~!@#$%^&*()_+:;"'{}[]|<>,/?` — parentheses, pipes, etc. are auto-flagged before human review
- No URLs, symbols, or emoji
- Exception: forbidden formatting rules don't apply if the business already brands that way externally (e.g., "CRED" in all caps). But this must be provable on the website.

**Meta-official format for brand/entity mismatch: "Brand by [Entity]"** (e.g., "Fruit Snacks by Fresh Produce", "Delight Ice-creams by Fresh Dairy"). This is the officially documented and safest approach — uses no special characters, no auto-flag risk. Reserve the parenthetical format only when the site already shows that exact format externally.

**"Brand (Entity)" format — CONFIRMED WORKING (with caveat):**
- Parentheses are in the official forbidden character set, but Meta's policy explicitly states: "These formatting guidelines do not apply to businesses who already brand this way externally."
- "Brand (Entity)" format was accepted during Embedded Signup (empirically confirmed in production, May 2026) — consistent with the external-branding exception (the disposable brand site footer showed the parenthetical format)
- Real-world precedent: "a retailer support line (Company Ltda)" also approved
- Use "Brand (Entity)" only when your site already shows that exact parenthetical branding, not as a general-purpose pattern
- **Rejection risk is LOW-consequence:** display name rejection doesn't ban BM or WABA, can resubmit up to 10x in 30 days

**Verified BMs: website field is LOCKED.**
After business verification, core fields (legal name, website, country, phone, tax ID) become protected. Changing them:
- Triggers re-verification review
- Can cause loss of verified status
- For purchased BMs: identity inconsistency is a red flag → BM suspension risk
- NEVER change the website field on a verified BM

**Implication for disposable BM with brand mismatch:**
If the purchased BM's website doesn't mention your brand, you cannot use your brand as the display name. Options:
1. Use the existing BM entity name as display name (e.g., the disposable BM identity name or a variant of it)
2. Check if the existing website has any editable section to add your brand name
3. Create a separate, unverified BM with your own website (loses verified tier benefits)

**What Meta checks during review:**
- Automated: does the name appear on the website? Formatting rules? Prohibited words?
- Human (triggered when automated is uncertain): cross-references display name vs BM identity, checks website connection, checks for trademark conflicts

**What Meta does NOT systematically check:**
- WHOIS domain ownership vs BM entity
- Trademark databases (only obvious conflicts)
- Government business registries

**If rejected:**
- Does NOT ban the BM or WABA (scoped to display name only)
- Number still works but shows phone number instead of name
- Can resubmit up to 10 times in 30 days
- Can appeal with website screenshot showing the footer connection
- If appeal limit hit: 7-60 days locked from changing that name (not a ban)

**Backup names:** always have 2-3 alternatives ready before submitting.

**Critical sequence:** website MUST be live BEFORE submitting display name. Never submit without the site ready.

**Domain requirement:** Meta requires domain verification in the Business Portfolio (DNS TXT record). Free subdomains (vercel.app, netlify.app, github.io) do NOT work because you can't verify a root domain you don't own. Must buy a custom domain.

**Cheap disposable domains (for disposable BM, expected to die in 30 days):**
- `.site`, `.store`, `.online`: ~$0.98/yr first year (Namecheap promo)
- `.xyz`: ~$1.58/yr first year (Namecheap)
- ⚠️ Promo price is ONE per TLD per account. Second `.site` on same account costs $1.98. Rotate TLDs across purchases (.site → .store → .online → .xyz) to always get the lowest promo
- Renewal jumps to $20-30+/yr — irrelevant for disposable BM setups
- Buy on Namecheap, host on Vercel free tier with custom domain (free SSL)
- Check availability from CLI: `whois <domain>` or `npx domain-check <name> site online xyz store`
- Total cost for disposable WABA website: ~$1 domain + $0 hosting = ~$1

### Phone Number Strategy (Brazil, 2025-2026)

**Two separate verifications require different number strategies:**

| Verification | Purpose | What works | What fails |
|---|---|---|---|
| Meta Developer account (Facebook SMS) | One-time SMS to verify developer identity | Physical SIM from major carrier (Vivo/Claro/TIM), carrier-grade eSIM | VoIP, virtual numbers, some MVNO ranges |
| WABA registration (OTP) | Register number on WhatsApp Business API | Physical SIM, eSIM, virtual numbers (Salvy), landline (voice call) | Numbers previously on any WhatsApp product |

**Meta Developer verification is the stricter one.** Meta actively blocks:
- VoIP numbers (Twilio, Vonage, RingCentral ranges)
- Known virtual number ranges
- Some MVNO number ranges (carrier-type identification)
- Rate-limited accounts: 24-48h cooldown after failed attempts

**WABA registration is more lenient.** Accepts mobile, landline (voice OTP), and virtual numbers built for the purpose. The critical requirement is the number has NEVER been on WhatsApp.

**Physical SIM requirements (Brazil, 2025+):**
- CPF + biometric validation required for all new prepaid activations
- 5-10 lines per CPF limit depending on carrier
- Factory-new SIM from carrier store recommended (avoid recycled numbers)
- Keep R$5-10 credit, 1 SMS every 60-90 days to prevent carrier recycling
- After WABA OTP, SIM role is done — but keep accessible 30+ days for re-verification

**MVNO range blocking:** MVNOs (virtual operators running on big carrier networks) get their own number ranges. Meta maintains a blocklist of ranges associated with spam/automation. If one number from an MVNO fails, all numbers in that range likely fail too.

**Salvy (Brazilian MVNO, Y Combinator W24):**
- Legitimate company, 5000+ businesses, 20k+ lines
- Three products: Physical Chip, eSIM (carrier-grade), Número Virtual Móvel
- eSIM = real carrier number (data + calls + SMS), range (11) 9362x
- Número Virtual Móvel = cloud DID, R$29.90/mês, exclusively for WhatsApp API
- The Número Virtual is built for WABA OTP (receives via webhook or voice redirect)
- The Número Virtual will NOT work for Meta Developer SMS verification (VoIP-type, blocked)
- The eSIM MAY work for Developer verification (carrier-grade) but MVNO range risk exists

**Recommended dual-number strategy:**
| Purpose | Best option | Cost |
|---|---|---|
| Developer verification | Physical SIM from Vivo/Claro/TIM (safest) or Salvy eSIM (cheaper, MVNO risk) | R$15-20 (SIM) or ~R$25/mês (eSIM) |
| WABA number | Salvy Número Virtual Móvel | R$29.90/mês |

**Can same number be used for both?** Yes, if using a physical SIM or eSIM. Developer SMS verification does NOT register the number on WhatsApp — it stays "virgin" for WABA. But using separate numbers is safer (isolation).

**Adding phone to purchased Facebook profile — risks:**
- Meta does NOT cross-reference carrier subscriber name vs profile name for SMS verification
- If the number is already a login contact on ANOTHER Facebook/Instagram account → hard block, cannot add
- Adding a number does NOT affect an existing WhatsApp consumer account on that number (separate systems)
- Do NOT merge WhatsApp into Accounts Center — just add as phone contact
- Number CAN be removed after developer verification (switch 2FA to authenticator first)
- Rate limiting: wait 24-48h after a failed verification attempt before trying a different number
- Failed number itself is rate-limited separately (don't retry the same number)

### Virtual Numbers for Brazil

| Provider | Type | Starting Cost | Works for Dev Verification? | Works for WABA? |
|---|---|---|---|---|
| Salvy Número Virtual | Cloud DID (WhatsApp API) | R$29.90/mês | No (VoIP-type) | Yes (built for it) |
| Salvy eSIM | Carrier-grade eSIM | ~R$25/mês | Maybe (MVNO risk) | Yes |
| Calilio | Brazilian mobile | $6/mês | Unknown | Possibly |
| JustCall | Regional DID | Custom | No (VoIP) | Possibly |

**Rule:** Numbers must have valid Brazilian DDD (area code). Many SMS-PVA services provide pre-flagged numbers. Always prefer carrier-grade (SIM/eSIM) over VoIP for any Meta verification.

### Cost of a Ban Cycle

| Item | Cost |
|---|---|
| New disposable BM | $19-59 USD |
| New profile (primary) | R$216 |
| New profile (backup) | R$18 |
| Proxy (ongoing) | ~R$30/mês |
| Setup time lost | 2-4 days (no profile warmup needed for dispatch BMs) |
| Total replacement | ~R$400-600 + time |

### Burn and Replace Pattern

1. BM banned → all WABA numbers under it deactivated simultaneously
2. Discard banned BM (non-recoverable in disposable BM strategy)
3. Buy new disposable BM ($19-59)
4. If profile survived: reuse with new BM. If not: buy new profile, rewarm
5. Reattach warmed profile to new BM
6. Transfer learnings (template text, contact segments, timing data)
7. Restart from Phase 3 in setup sequence

**Key insight:** Template performance data, contact segment insights, and timing optimizations survive the burn. Only the infrastructure dies.

### Number Longevity & Cold Lists (preserve over burn)

"Disposable" means ISOLATED (a ban cannot cascade to the real business or to other disposable BMs), NOT
"burn fast". With the same discipline as a primary number, a disposable-isolated number is a long-lived
asset, burn-and-replace above is the FALLBACK when one dies, not the goal. Longevity reduces to one
thing: keeping the rolling 7-day block + report rate low.

**Recovery timelines (rule of thumb):** Yellow to Green in ~48-72h, Red to Green in ~7-14 days, IF you
stop marketing and resume only to engaged opt-ins. Quality held low for 7 straight days can cut the
messaging limit.

**Cold lists vs longevity, the WARM-FIRST rule.** Marketing to cold (non-opted-in) numbers is
incompatible with preserving quality: cold blocks at ~15-40% vs ~2-5% for opted-in signups, which
directly degrades the per-number quality window. No "dilution" fixes this on a number you want to keep,
mixing cold into warm only lowers the AGGREGATE rate while still adding absolute blocks to the rolling
7-day window, a slow tax on the asset. To use a cold list WITHOUT killing a preserved number:
1. **Validate first (HLR / carrier lookup)** before any send: confirms each number is active/reachable
   WITHOUT messaging it, stripping dead/disconnected numbers. Repeated delivery failures (131026) read
   to anti-spam like a dictionary-style attack, so this step is not optional for cold data.
2. **Warm cold to engaged BEFORE marketing, by making THEM initiate.** You CANNOT free-text a cold
   number: the first business-initiated message to anyone who has not messaged you REQUIRES a template,
   so even a "soft" first touch is a template send that risks blocks. The only way to skip
   template-to-cold is to get the prospect to message YOU first. Run a **Click-to-WhatsApp ad (CTWA)** so
   they tap "Send message" and self-initiate, which opens a 24h window and makes them warm. For an
   EXTRACTED or purchased list (e.g. members scraped from a third-party group), upload it as a **Custom
   Audience** in the ad platform and run the CTWA ad to it (plus a lookalike). A reply / inbound makes
   later marketing both quality-safe AND exempt from the per-user marketing cap (131049).
   - **Isolation rule for extracted-list CTWA:** a custom audience built from non-consented / extracted
     data carries AD-ACCOUNT ban risk (the ad platform penalizes non-consented data), so run it from the
     DISPOSABLE BM's OWN isolated ad account (funded by its isolated card), NEVER the real business's ad
     account or pixel. This shifts the burn risk to the disposable ad account and keeps the WhatsApp
     number's quality untouched, because no cold template ever leaves. (BSPs like YCloud expose a CTWA
     integration that drops these ad-sourced conversations straight into the inbox / a flow, so the bot
     can auto-route them, e.g. an auto-invite to your group.)
   - **Account-trust gate (fresh disposable BMs):** creating/using that ad account requires the BM to
     have two-factor authentication enabled, AND Meta blocks security changes (2FA, password) from an
     unfamiliar device. An antidetect profile reads as a "new device" and gets "you can't make this
     change right now, we will let you after using this device for a while". There is no instant bypass:
     AGE the profile (use it normally for a few days) until Meta trusts the device, then enable 2FA, then
     run CTWA. So the CTWA route needs an aged FB account, plan it AFTER the number's warmup, not day one.
     Do not hammer the 2FA page on a fresh profile, repeated security-change attempts add a risk signal.
3. **Reply = warm.** Only then send marketing templates. Numbers that never engage are discarded.
4. **Bulk cold blasting is a job for a dedicated worker number you accept will burn**, never the
   preserved asset. Rotate worker numbers to distribute ban risk.

Cold numbers also carry no first name, so a personalized template (`{{1}}` = name) renders broken on
them, use a no-variable template or a generic greeting for any cold / un-named send. (Researched 2025-06
across Meta docs + BSP deliverability guidance.)
