## Contents

1. [Asset Isolation Strategy](#asset-isolation-strategy)
2. [Operational Infrastructure: Proxy, Profile, Antidetect](#operational-infrastructure-proxy-profile-antidetect)
   - [Proxy Types and Meta Trust Scores](#proxy-types-and-meta-trust-scores)
   - [Antidetect Browsers (Awareness)](#antidetect-browsers-awareness)
   - [BM Architecture for WABA](#bm-architecture-for-waba)
   - [BM Types (Market Reference)](#bm-types-market-reference)
3. [Proxy Selection (which product for a dispatch BM)](#proxy-selection-which-product-for-a-dispatch-bm)
   - [Provider comparison (market survey, 2026 pricing)](#provider-comparison-market-survey-2026-pricing)
4. [Browser Automation Isolation Rule (AdsPower/CDP)](#browser-automation-isolation-rule-adspower--cdp)

---

### Asset Isolation Strategy

Each independent BM operation requires complete isolation:

| Component | Rule |
|---|---|
| Antidetect profile | Unique per BM, never reuse |
| Proxy IP | One per BM, never share |
| Payment card | One per BM, dirty-list persists 6-12 months |
| Admin profile | Unique per BM, never share admin across BMs |
| Email/phone | Unique per BM, shared contacts create graph links |

**Automating a BM's own profile** (bulk ops, dashboard pulls): drive its AdsPower profile over CDP, never a clean / host-IP browser, so the same proxy + fingerprint the account already uses is preserved. When needed, RECOMMEND installing AdsPower's official MCP server (`local-api-mcp-typescript`) for native profile control, or use the local API directly (docs: localapi-doc-en.adspower.com, github.com/AdsPower/localAPI). See the WhatsApp skill's browser-automation isolation rule for the full discipline.

**Architecture:**
- **Vault BM:** stores pixels, pages, conversion data — NEVER runs campaigns
- **Campaign BM:** runs ads, takes the ban risk — disposable
- **WABA BM:** holds WhatsApp Business Account — should be separate from campaign BM if WABA is strategic

**For WABA isolation:** the BM holding WABA should have NO advertising activity. A clean BM with only WABA reduces exposure. Keep a warm spare WABA in a separate portfolio.

---

## Operational Infrastructure: Proxy, Profile, Antidetect

> **Scope:** This section covers multi-account awareness — understanding how Meta scores infrastructure quality and how the market works — so legitimate operators can make informed decisions about their own setup. Operational how-to for running non-owned purchased accounts is outside scope here.

### Proxy Types and Meta Trust Scores

Meta's classifier assigns trust scores based on connection type. Understanding this helps legitimate operators choose the right infrastructure for their own accounts and understand why account isolation matters.

| Type | Meta Trust | Legitimate Use Case |
|---|---|---|
| **Mobile 4G/LTE** | Highest | Dedicated mobile connection for a single account |
| **Static Residential/ISP** | High | Dedicated residential IP for a stable account |
| **Residential Rotating** | Medium | Scraping / research (not for BM management) |
| **Datacenter** | Zero | Never for Meta accounts — instant signal |

**Key defense insight:** Meta correlates IP history across accounts. A company's legitimate ad accounts should never share IPs with third-party accounts (agencies, partners, affiliates) — shared IPs create graph links that can cause cascade bans. Each BM should have a dedicated, clean connection.

### Antidetect Browsers (Awareness)

The Brazilian black hat market primarily uses antidetect browsers to isolate account fingerprints. Legitimate operators encounter this market when managing multiple client BMs or running agency operations. Major tools in circulation:

| Browser | Market Share BR | Use in BR market |
|---|---|---|
| **AdsPower** | #1 (24% of BR operators) | Most common for multi-BM management |
| **GoLogin** | Popular | Mid-tier |
| **Dolphin Anty** | Popular for automation | Frequently used for automated operations |
| **Multilogin** | Premium/enterprise | High-end isolation |

**Defense implication:** Meta's fingerprint detection identifies antidetect browser signatures. Legitimate operators managing multiple client BMs in a browser that mimics antidetect behavior may trigger false positives. Use standard browsers for legitimate agency work where possible; ensure each client BM has a consistent, stable access pattern.

### BM Architecture for WABA

```
Profile Principal (aged, high-trust)
  └── BM Disparo (purchased)
        ├── WABA (WhatsApp Business Account)
        │     └── Phone number + templates
        └── Admin backup (cheaper profile)

If Profile Principal falls → BM survives via backup admin
If BM falls → WABA and phone number are lost (non-transferable)
```

**Critical:** WABA cannot be transferred between BMs. Choose the BM carefully. Add backup admin immediately.

### BM Types (Market Reference)

| Type | Description | Price Range | Risk |
|---|---|---|---|
| BM zerada | Fresh, no history | R$50-150 | High (no trust) |
| BM verificada | Business Verification done | R$90-250 | Medium |
| BM ilimitada | High-score creator profile | R$400-1500 | Medium |
| BM agência | Agency-allocated shared access | % of spend + fee | Low-medium |
| Disposable BM | Disposable, burn after use | R$80-300 total setup | Expected to die |
| BM reativada | Recovered from ban via appeal | Variable | Paradoxically stable |
| BM com linha de crédito | Monthly billing unlocked | Premium | High (heavily monitored) |
| BM disparo | Set up for WhatsApp dispatch | Variable | Depends on tier |

---

## Proxy Selection (which product for a dispatch BM)

Hard requirements, the proxy must be:
- **Dedicated/static**, NEVER rotating. Warming needs one consistent IP, a changing IP reads as account-takeover/bot. Avoid "alta rotacao" / high-rotation / web-scraping proxies.
- **SOCKS5** (full tunnel for the antidetect browser), not HTTP.
- **BR**, matching the operation's country.

Choosing within a provider's catalog:
- **Prefer the "Facebook/Google"-tuned line** if the vendor segments its catalog by target platform: those IPs keep a cleaner Meta reputation, which matters more than anything else for a WABA.
- **IPv4 vs IPv6:** IPv6-only SOCKS5 is an uncommon residential fingerprint in BR (mild AdsPower detection risk), IPv4 looks more like a real home connection. For a SECOND disposable BM, picking the opposite family from disposable BM #1 doubles as cross-BM isolation.
- **Residential** is the best anti-detection ONLY if static/dedicated. "Turbo"/rotating residential changes IP, bad for warming, confirm it is fixed before buying.
- **Avoid:** rotating/high-rotation, HTTP-only, and any IP flagged for scraping/abuse.

### Provider comparison (market survey, 2026 pricing)

A non-exhaustive market survey for the BR-first, static-dedicated-SOCKS5 use case. **Prices are 2026 list prices and drift — always confirm current pricing, SOCKS5 + `user:pass` auth, and live BR stock with the vendor before buying.** Sorted roughly by fit: BR-local first, then mobile (highest Meta trust), then global static-residential, enterprise, and rotating-only options to avoid.

| Provider | Type(s) | SOCKS5 | Static / Dedicated | BR Pool | Starting Price (2026) | Meta / WhatsApp Fit |
|---|---|---|---|---|---|---|
| **Proxy Roque** (proxy-agenciaroque.com.br) | Datacenter IPv4/IPv6, Residential ISP, Mobile 4G/5G | Yes | Yes — dedicated/exclusive per client on all non-scraping plans | BR-only (Vivo, Claro, TIM, Oi) | R$24,90/mo (Ultra BR Meta/Google); R$38/mo (IPv4 Dedicado); R$59/mo (Residencial) | Strong. Meta/Google-tuned line, 95%+ IPQualityScore, 1 IP per BM recommended. Flag: 47-day avg Reclame Aqui response time. Prefer IPv4 for warming (IPv6 SKU exists but is a less common BR fingerprint). |
| **ProxyAds** (proxyads.com) | Residential IPv4 & IPv6 (dedicated) | Yes | Yes — exclusive per client, unlimited bandwidth | BR-only, multi-state residential | ~R$25/mo (pricing requires WhatsApp contact) | Very strong. Built explicitly for Meta BM, WhatsApp API (Z-API, Evolution API, Baileys), and BM contingency. Top-cited BR choice in comparison articles. |
| **FastProxy** (fastproxy.com.br) | Datacenter IPv4/IPv6, Static Residential/ISP | Yes | Yes — all plans dedicated | BR-native (BR-SP) | R$30/mo (IPv6 DC); R$49,90/mo (IPv4 DC); R$80/mo (IPv6 for Facebook Ads); R$99/mo (ISP/Residential) | Good. Explicit "IPv6 for Facebook Ads" SKU; ISP plan suits WhatsApp warming. Use IPv4 dedicated for WABA (IPv6 unreliable across platforms). |
| **Proxy Brasil** (proxybrasil.com) | Residential, Datacenter | HTTP/HTTPS confirmed; SOCKS5 unconfirmed — verify | Yes — dedicated, unlimited traffic | BR-native | R$12/mo (IPv6 dedicated); R$18/mo (IPv4 dedicated) | Moderate. Lowest BRL price. Marketed for Facebook/Google Ads. SOCKS5 uncertain — verify. IPv4 plan better for WABA stability. |
| **HypeHost** (hypehost.com.br) | Datacenter, Residential | Yes (SOCKS4 + SOCKS5) | Yes — clean dedicated São Paulo IPs | BR-native (São Paulo DC) | ~R$15/mo per proxy (pricing page requires contact) | Good. Explicit Facebook/Google/TikTok Ads + multi-account positioning. São Paulo clean IPs. |
| **ProxyTotal** (proxytotal.com.br) | Residential IPv4, Datacenter IPv4 | HTTP/HTTPS confirmed; SOCKS5 unconfirmed | Yes — dedicated per client | BR-only | Not public (contact vendor) | Good for Meta. 100% Facebook/Instagram-focused. Tested with Multilogin, Incogniton. Reportedly merged into ProxyAds. Verify before ordering. |
| **ProxyBr** (site.proxybr.com.br) | Residential, Mobile 4G/5G | Yes (per vendor) | Partial — dedicated and rotating; confirm per plan | BR-only | Contact via WhatsApp | Good. Residential + mobile BR IPs, PT-BR support. Pricing not public. |
| **VPS Barato** (vpsbarato.com) | Static Residential/ISP, Datacenter IPv4 | Yes (HTTP + SOCKS5) | Yes — static dedicated both tiers | São Paulo + Rio de Janeiro | $3/mo (DC IPv4); $7/mo (Residential/ISP static) | Moderate. No Meta tuning; reputation unverified. Low-cost BR static entry. USD billing. |
| **iProxy.online** | Mobile 4G/5G (your own device + SIM) | Yes (+ OpenVPN, WireGuard) | Yes — dedicated device/SIM, operator-controlled rotation | Any country your device sits in (supply own BR SIM) | $9/device/mo (Basic); $12.50 (Pro) + SIM data | Very high. Real SIM on real handset = top-trust carrier ASN, zero pool contamination. Official AdsPower partner. |
| **Coronium.io** | Mobile 4G/5G (dedicated modem) | Yes | Partial — dedicated port, sticky ≤24h, on-demand rotation | São Paulo: Vivo ~38%, Claro ~33%, TIM ~23%, Oi ~6% | $89/mo (30-day BR); $39/wk; $12/day | Very high. Dedicated Meta-BM + WhatsApp-warming page, 7–14 day protocol. AdsPower/GoLogin/Multilogin/Dolphin partner. Keep sticky ON during warming. |
| **NafeProxys** (nafeproxys.online) | Mobile 5G/4G (dedicated SP device) | Yes (+ OpenVPN) | Yes — dedicated device per port | BR-only: Vivo + Claro 5G, São Paulo | From $7.20/day (monthly — contact Telegram) | Very high. BR-native devices on BR carriers. BitBrowser + GeeLark partner. Unlimited bandwidth. |
| **OnlineProxy.io** | Mobile 4G/5G (dedicated phones/modems) | Yes | Yes — private dedicated port, full rotation control | BR: Claro, TIM, Vivo; São Paulo | $150/mo per BR port; $65/wk; $20/day | High. Single-tenant carrier IPs. Sticky sessions fit warming. 97% uptime. Rotate only between sessions. |
| **ProxyBlocks.io** | Mobile 5G/4G (dedicated device) | Yes (SOCKS5 TCP + UDP/QUIC) | Yes — dedicated device, rotation 1 min–72h or static | BR: Vivo + Claro; 25 Mbit/s | $2.50 trial (4h); 30-day via configurator | High. SOCKS5 UDP (QUIC) for WebRTC realism. "Skip Used IP" on rotation. OpenVPN/WireGuard tunnel option. |
| **MobileProxy.Space** | Mobile 4G/5G (single-tenant channel) | Yes | Yes — one user per channel; rotation via dashboard/API/timer | BR in 31-country pool; city + carrier targeting | $33–$169/IP/mo (BR rate not broken out — contact) | High. Single-tenant = no pool-history contamination. Flexible rotation. |
| **IPRoyal — Static Residential** (iproyal.com) | Static Residential/ISP | Yes | Yes — 100% dedicated, same IP for subscription | 10,482 dedicated BR IPs | $2.40/IP/mo (90-day); $2.70 (30-day); $1.80/24h | Good. Large BR static pool. Fraud-Score filter to pick lowest-risk IPs. AdsPower-compatible. Reputation variable — use the filter. |
| **Proxy-Cheap — Static Residential** (proxy-cheap.com) | Static Residential/ISP | Yes | Yes — dedicated IPv4, unlimited bandwidth | BR in 24+ countries; verify stock | $2.29/IP/mo (1-mo); $1.99/IP/wk (trial) | Good. ISP-sourced residential ASN, no per-GB billing. Zero-CAPTCHA in social tests. SOCKS5-compatible with all browsers. |
| **Proxy-Cheap — Static Mobile** (proxy-cheap.com) | Mobile 4G/5G static | Yes | Partial — static mobile IPv4 for subscription; narrow pool | BR in 100+ country pool; carrier unnamed — verify | $42.21/proxy/mo (1-mo); $27.89 (12-mo) | Good — mobile carrier ASN = top trust class. 2–5 Mbps (fine for WhatsApp). Confirm BR carrier before bulk. |
| **Proxy-Seller** (proxy-seller.com) | Static Residential/ISP, Datacenter IPv4/IPv6, Mobile | Yes | Yes — ISP + DC lines dedicated/private | BR confirmed (ISP + /brazilian-proxy/) | $0.90/IP/mo (ISP static); $1.53/IP/mo (BR DC IPv4) | Good value. ISP static = residential ASN, correct for warming. DC line cheaper but higher detection. Official AdsPower partner. |
| **NetNut** (netnut.io) | Static Residential/ISP, Rotating Residential, Mobile | Yes (SOCKS5h — no UDP) | Yes — ISP static: persistent non-rotating | BR static residential confirmed; verify ISP line via sales | $99/mo / 7 GB static residential; ISP Starter $350/mo / 20 GB | Good. Fraud Score 12–16/100 (Low Risk). Bandwidth-billed, no per-IP model. Confirm Meta domains not blocked under defaults. |
| **Decodo** (ex-Smartproxy) | Static Residential/ISP (dedicated), Rotating, DC, Mobile | Yes (+ UDP) | Yes — dedicated ISP truly static; **BR not in confirmed ISP list — verify** | BR confirmed for rotating residential; static ISP = US/EU/APAC | $3.33/IP/mo (dedicated ISP, 3 IPs); $3.75/GB (BR rotating) | Moderate for BR static. Best-known global brand for WhatsApp account mgmt. BR rotating (sticky) is the practical fallback. Official AdsPower guide. |
| **Bright Data** (brightdata.com) | Static Residential/ISP, Datacenter, Rotating, Mobile | Yes (port 22228; SOCKS5h) | Yes — ISP dedicated $4/IP/mo; shared ISP $2/IP/mo | ~4.9M ISP IPs in BR; city targeting | $1.30/IP/mo (ISP PAYG); $2 (shared unlimited); $4 (dedicated unlimited) | Moderate. **AUP prohibits fake engagement — verify compliance.** Documented Meta adversarial history. Enterprise compliance (SOC2/GDPR). |
| **Oxylabs** (oxylabs.io) | Static Residential/ISP (shared + dedicated), DC, Rotating, Mobile | Yes (ISP SOCKS5 lacks country nodes — use Dedicated ISP/DC for BR) | Yes — Dedicated ISP + DC exclusive | BR confirmed for DC + residential/mobile; verify Dedicated ISP BR | $1.20/IP/mo (ISP shared, 500); $3.20 (Dedicated ISP, 5); $2.25 (Dedicated DC) | Moderate. Enterprise. BR residential 96%+ authenticity. SOCKS5 caveat on ISP — use Dedicated ISP/DC. Official AdsPower integration. |
| **SOAX** (soax.com) | Residential (rotating + sticky), Mobile, Static ISP (US/UK only), DC | Yes (+ UDP/QUIC) | Partial — static ISP US+UK only; **BR is sticky residential or mobile only** | 13.7M BR residential; city + carrier; no static BR | $90/mo / 25 GB residential ($3.60/GB) | Moderate for BR static. Mobile = top trust; sticky residential approximates static short-term. No truly-static BR IP. |
| **PROXIES.SX** (proxies.sx) | Mobile 4G/5G (rotating pool, per-GB) | Yes (+ OpenVPN, HTTP/3 QUIC) | Partial — sticky sessions; not dedicated device; pool rotates | BR: Vivo, Claro, TIM; SP/Rio/Brasília | $4.00/GB (1–24 GB); $90/mo / 25 GB | Moderate. Excellent IP quality (real carrier ASN). Per-GB rotating unsuitable for multi-day warming — use for short sessions. |
| **CyberYozh** (cyberyozh.com) | Mobile, Static Residential/ISP, Residential, DC | Yes (mobile + ISP; HTTP on DC) | Yes — ISP static + DC dedicated | BR pool: 4 ISPs (V.tal, Lumina, Lietpark, ML Telecom) | $5.39/mo (ISP static BR); $1.70/day (mobile); $0.90/GB (rotating) | Good. Mobile highlighted for social high-trust. ISP static stable for BM. Country-level only. USD billing. |
| **PYPROXY** (pyproxy.com) | Static Residential/ISP, Rotating, Mobile | Yes | Yes — ISP static dedicated up to 1 year | BR in 190+ pool; BR ISP price via quote | ~$5/IP/mo (ISP static); ~$0.90/GB (rotating) | Moderate. Architecturally suitable (non-rotating ISP). BR reputation unverified — test before production. Chinese-origin; async PT-BR support. |
| **2Captcha Proxy** (2captcha.com) | Residential, Mobile, DC (rotating) | Yes | **No — rotating/sticky only (0–120 min). Avoid for warming.** | Large BR pool (SP 70K, Rio 62K) | R$25,20/GB; R$201,60/10 GB | Poor for WABA. Rotating IPs trigger Meta account-takeover detection. BRL billing is the only upside. |
| **ASocks** (asocks.com) | Mobile (rotating pool), Residential, DC | Yes (SOCKS4 + SOCKS5) | **Partial — sticky ≤30 min, no dedicated device. Avoid for long warming.** | BR in 150+ pool | $4.50/GB (mobile); $15/proxy/mo (dedicated res/corp) | Poor for extended warming. 30-min session expiry triggers Meta takeover detection on long flows. |
| **Live Proxies** (liveproxies.io) | Rotating Residential, Static Residential (US only), Rotating Mobile (US/CA/UK) | On request | **Partial — static is US-only; BR is rotating only. Avoid for BR warming.** | BR rotating residential only | $70/mo / 4 GB ($17.50/GB) | Poor for BR WABA. No BR static. Originally a sneaker-bot proxy. |

**Trust tiers (Meta/WhatsApp):** dedicated **mobile 4G/5G** (real carrier ASN, nearly indistinguishable from a real phone) > **static residential / ISP** (residential ASN, strong + cost-effective) > **dedicated datacenter** (cheapest, but detectable by Meta's ASN checks — acceptable only for low-sensitivity BM work, not WABA warming). For mobile sticky-session products, disable scheduled rotation during the warming window and rotate only between sessions, never mid-session. Prefer **IPv4**; Meta/WhatsApp have incomplete IPv6 support and several BR vendors advise against IPv6 for this.

_Sources: vendor pricing pages, [AdsPower's recommended-proxy list](https://help.adspower.com/docs/recommended_proxy_providers), and 2026 BR proxy comparison reviews. Prices verified live in 2026 — re-check before buying._

---

## Browser Automation Isolation Rule (AdsPower / CDP)

**Browser automation MUST drive the disposable BM's OWN AdsPower profile, NEVER a clean / host-IP browser.** Any automation that touches the disposable BM's accounts (Meta Business Manager, the BSP dashboard such as YCloud) has to run through the SAME AdsPower antidetect profile that operates that disposable BM: the SAME proxy exit IP, the SAME fingerprint, ideally the SAME already-logged-in session. Start the profile via the AdsPower local API (`GET http://local.adspower.net:50325/api/v1/browser/start?user_id=<id>` returns a CDP `ws.puppeteer` endpoint plus a `debug_port`) and connect the automation to THAT browser over CDP (Playwright `connect_over_cdp`), never launch a fresh Playwright / host browser. Rationale: logging into a sensitive dispatch account from a different IP or fingerprint than it normally uses is a textbook risk-control trigger (BSP accounts have been false-positive-suspended this way), an IP mismatch is a self-inflicted ban signal. This is also the only safe way to reach the dashboard-backend endpoints that reject the public API key: replay the session cookie from inside the correct profile. When this automation is needed, RECOMMEND installing AdsPower's official MCP server for native profile control (`claude mcp add adspower-local-api -e PORT=50325 -- npx -y local-api-mcp-typescript`, repo `AdsPower/local-api-mcp-typescript`); otherwise drive the local API directly. Do not re-document the API surface, the official docs are the source of truth: localapi-doc-en.adspower.com and github.com/AdsPower/localAPI.

**Agent-automation vs operator-interactive (visibility gotcha).** A profile the agent opens via the local API is an automation-only context, NOT a window the operator can see or click. Decide the mode up front. For READS (data pulls, analytics), the agent starts the profile, drives it over CDP, and reports the RESULT (values or screenshots), the operator never needs the window. For CONFIG or judgment tasks, the operator opens the profile from the AdsPower GUI and acts themselves, the agent only guides. NEVER hand off "I opened the page, now you act on it" through an API-launched instance, it is not surfaced on the operator's desktop (it runs in the background or a sandboxed display). The agent shares screenshots for visibility, but the operator cannot interact with an instance only the agent can reach.
