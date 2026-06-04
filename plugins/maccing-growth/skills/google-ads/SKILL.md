---
name: google-ads
description: Use when managing Google Ads campaigns, creating ads, optimizing campaigns, checking metrics, or automating Google Ads via Scripts. Triggers on "google ads", "google ads campaign", "create campaign", "ad campaign", "google ads scripts", "check google ads", "google ads metrics", "campaign performance", "AdsApp".
---

# Google Ads Management

Scripts-first approach to Google Ads. Google Ads Scripts run inside the Google Ads UI with zero setup — no developer token, no OAuth, no approval. Use Scripts for everything. Browser automation (Playwriter) is only needed to apply Google's built-in recommendations.

**Project data lives in `.maccing/growth/google-ads/<account>/README.md`.** This file contains only generic, reusable platform knowledge.

## Iron Laws

### 0. MANDATORY: Read Project Context First

```
BEFORE ANY ACTION, ALWAYS READ THE PROJECT README.
.maccing/growth/google-ads/<account>/README.md contains current state:
campaign IDs, budgets, negatives, performance, pending actions.
Without reading it, you WILL operate on stale data.
```

### 1. Google Ads Scripts First, Always

```
ALWAYS USE GOOGLE ADS SCRIPTS FOR WRITE AND READ OPERATIONS.
PLAYWRITER IS ONLY FOR APPLYING GOOGLE RECOMMENDATIONS.
```

**Priority order:**
1. **Google Ads Scripts** (`AdsApp.mutate` / `AdsApp.search`) — create ads, add keywords, read metrics, manage campaigns. Reliable, requires zero approval, works immediately.
2. **Google Ads MCP** (`google-ads` MCP server) — secondary option when developer token is approved. Same power as Scripts but callable directly from Claude.
3. **Playwriter** — only for applying Google's built-in recommendations (the Recommendations page cards). There is no API for this.

**NEVER guide the user through manual Google Ads UI steps when Scripts can do it.**

### 2. Self-Improving Skill

After every session: update patterns, note new script techniques, record gotchas.

### 3. Exact UI Paths for Manual Actions

```
WHEN GUIDING ANY MANUAL ACTION, PROVIDE THE FULL CLICK PATH.
NEVER say "go to Conversions". ALWAYS say the exact sequence.
```

Every manual instruction MUST include:
- The exact sidebar item (e.g., "Metas")
- Every sub-menu and click in order (e.g., "→ Conversões → Resumo")
- The exact element to click (e.g., "→ clica em 'Editar meta' ao lado de 'Visualização de página'")
- The exact toggle/button (e.g., "→ muda 'Otimização de ações' de Principal para Secundário")
- The save action (e.g., "→ Salvar")

**Format:** `Sidebar Item → Sub-menu → Page Element → Action → Confirm`

**Conversion goals UI structure (confirmed 2026-05-05):**
- Sidebar: **Metas** (🏆 icon) → **Conversões** (dropdown) → **Resumo**
- Page shows goals grouped by category
- Each group has: Campanhas count, Principais ações count, Status, "Editar meta" button
- Click "Editar meta" → expands to show individual conversion actions
- Each action shows: name, Otimização de ações (Principal/Secundário), Origem, Todas as conv, Status
- Change Principal/Secundário here — NOT via a toggle on the action detail page
- `metrics.conversions` takes days to recalculate after changing Primary→Secondary

## Conventions & Best Practices

### Naming Conventions

| Entity | Format | Example |
|---|---|---|
| Campaign | `Brand - Product - Channel - Geo` | `Acme Brand - Search - PH/PK/BD` |
| Ad Group | `[Theme] - [Match Type]` | `Earning Keywords - Broad` |
| Script file | `NN-kebab-description.js` | `33-campaign-optimize.js` |
| Negative keyword | Lowercase, broad match default | `without investment` |

### Ad Group Organization

Split ad groups by match type for granular control:
- **Broad match group:** Discovery keywords, wider reach, lower CPC
- **Exact match group:** High-intent terms from search term reports, tailored RSA copy
- Each ad group gets its own RSA with copy tailored to that audience segment
- Never mix match types in the same ad group — makes bid optimization impossible

### RSA Best Practices (Confirmed Working)

- **15 headlines + 4 descriptions** for maximum ad strength
- Headlines must cover diverse angles: what it is, action, community, CTA, benefit, differentiator
- Always count characters before creation: headlines ≤ 30, descriptions ≤ 90
- Path1/Path2 should match the ad group theme
- Ad strength POOR = Google suppresses impressions. Aim for GOOD or EXCELLENT.
- One ad group can have 2-3 RSAs for A/B testing — remove underperformers (0 impressions)

### Keyword Strategy

- **Broad match:** Use for discovery. Monitor search terms report weekly. Negative aggressively.
- **Exact match:** Graduate winning search terms from broad campaigns to exact match in dedicated ad groups.
- **Negatives at campaign level:** Prevents all ad groups in the campaign from triggering on those terms.
- **Quality over CTR:** High CTR on low-intent keywords wastes budget. Evaluate keywords by downstream funnel conversion, not just click metrics.

### Multi-Step Script Pattern (Confirmed Working)

A single script can chain multiple operation types reliably:
```
1. campaignCriterionOperation.create (negatives) via mutateAll
2. GAQL query → adGroupCriterionOperation.update (pause keywords) via mutateAll
3. adGroupCriterionOperation.create (add keywords) via mutateAll
4. adGroupAdOperation.remove (delete ad) via mutate
5. adGroupAdOperation.create (new RSA) via mutate
6. adGroupOperation.update (rename) via mutate
7. adGroupOperation.create (new ad group) via mutate
```
Use `AdsApp.mutateAll()` for batch (arrays), `AdsApp.mutate()` for single operations. Chain sequentially. If step N fails, `return` to stop the script.

### GAQL Gotchas

| Field | Issue | Fix |
|---|---|---|
| `quality_info.qualityScore` | TypeError if undefined | Don't include in SELECT, query separately |
| `ad_relevance`, `landing_page_experience` | Invalid in Scripts API | Remove from queries |
| `metrics.conversions` | Inflated after Primary→Secondary change | Wait 7+ days for recalculation |
| `REGEXP_MATCH` | Works for keyword text filtering | Use for pattern-based queries |
| `metrics.conversions` with `conversion_action` | PROHIBITED_METRIC error | Use `all_conversions` or query from `campaign` with `segments.conversion_action_name` |

### Negative Keyword Conflicts

Broad match negatives can silently block positive keywords. Example: negative "jobs from home" (BROAD) blocks positive "online jobs from home". Google shows this in Recommendations → "Remover palavras-chave negativas em conflito" but does NOT prevent serving — it just wastes budget on zero impressions for those keywords.

**Always audit:** after adding negatives, cross-check against positive keywords. A broad negative matches any query containing those words in any order.

### Funnel-Aware Negative Keywords

When the business model has a free tier → paid conversion funnel:
- Negative "without investment", "no investment", "free money" — these users explicitly won't pay
- High CTR ≠ high value. Evaluate keywords by downstream conversion (purchase), not clicks
- Search terms with high downstream CVR → promote to exact match

## Scripts Workflow

### How to run a script

1. Claude reads the template from the plugin's `skills/google-ads/scripts/` directory
2. Claude fills in `CONFIG` variables (IDs, ad copy, keywords) from the project README
3. Claude gives the script to the user using this EXACT format:

   **Script:** `script-name`
   **Arquivo:** `.maccing/growth/google-ads/<account>/scripts/NN-script-name.js`
   **Copiar:** `cat .maccing/growth/google-ads/<account>/scripts/NN-script-name.js | pbcopy`

   ALWAYS provide all three lines. Never skip any.

4. User opens Google Ads → **Ferramentas → Scripts → Novo script**
5. User names the script, pastes content, clicks **Executar** (NOT Visualizar — Preview is read-only and blocks all mutations)
6. For read scripts: user copies the `Logger` output back to Claude
7. For write scripts: script logs success/failure per operation

### When to use Scripts vs MCP vs Playwriter

| Task | Scripts | MCP (when approved) | Playwriter |
|---|---|---|---|
| Create RSA ads | ✅ `AdsApp.mutate` | ✅ | ❌ Angular overlay |
| Add keywords | ✅ `AdsApp.mutateAll` | ✅ | ⚠️ FAB works but fragile |
| Read metrics | ✅ `AdsApp.search` GAQL | ✅ GAQL | ✅ `innerText` |
| Apply recommendations | ❌ No API | ❌ | ✅ Only way |
| Create conversion actions | ✅ `AdsApp.mutate` | ✅ | ❌ Blocked |
| Pause/resume campaigns | ✅ `AdsApp.mutate` | ✅ | ✅ Status toggle |
| Remove negative keywords | ✅ `AdsApp.mutate` | ✅ | ❌ No bulk UI |
| Update ad URLs | ✅ `AdsApp.mutate` | ✅ | ❌ |
| Add negative keywords | ✅ `AdsApp.mutateAll` | ✅ | ⚠️ Campaign picker broken |
| Modify conversion goals | ❌ ALL approaches fail | ❌ Same API | ❌ |
| Remove campaigns | ❌ Campaigns can only be PAUSED | ✅ | ✅ |
| Create sitelinks | ✅ `AdsApp.mutate` | ✅ | ❌ 16-field form corrupts |

### AdsApp.mutate() — What Works and What Doesn't (Confirmed May 2026)

**Works:**
- `campaignOperation` create/update (name, status, budget, bidding) — confirmed
- `adGroupCriterionOperation` update (pause/enable keywords) — confirmed
- `campaignCriterionOperation` create (add negative keywords) — confirmed
- `campaignCriterionOperation` remove (delete negative keywords) — confirmed
- `adGroupAdOperation` create (create RSA ads) — confirmed
- `adGroupAdOperation` remove (delete ads) — confirmed
- `conversionActionOperation` create (create new conversion action) — confirmed
- `adGroupOperation` create/update (create ad group, rename) — confirmed
- `assetOperation` create (sitelinks) — confirmed
- `campaignAssetOperation` create/remove (link/unlink sitelinks to campaigns) — confirmed
- `assetOperation` remove → NOT supported. Assets can only be unlinked via `campaignAssetOperation.remove`

**Also works (confirmed 2026-05-12):**
- `conversionActionOperation` update name — confirmed (renamed 4 conversion actions in single mutateAll)
- `campaignCriterionOperation` create with `location` (add geo targets) — confirmed
- `campaignBudgetOperation` update `amountMicros` — confirmed
- `campaign.finalUrlSuffix` for UTM parameters — confirmed (set on 3 campaigns, verified via GAQL query)
- Campaigns with status REMOVED cannot be updated (name, status, anything) → "The operation is not allowed for removed resources"

**GAQL gotcha (confirmed 2026-05-13):**
- `geographic_view` queries require `campaign.status` in SELECT clause when filtering by `campaign.status` in WHERE — otherwise `EXPECTED_REFERENCED_FIELD_IN_SELECT_CLAUSE` error

**Does NOT work:**
- `conversionActionOperation` update/remove on WEBPAGE_CODELESS type → `MUTATE_NOT_ALLOWED`
- `conversionActionOperation` update status to DISABLED → generic error
- `customerConversionGoalOperation` (update biddable) → generic error
- `campaignConversionGoalOperation` (update biddable) → generic error
- `campaignOperation` with `conversionGoalCampaignConfig` → generic error
- `campaignOperation.remove` → generic error. Campaigns can only be paused.
- Any operation on REMOVED campaigns → "not allowed for removed resources"

**Classic AdsApp API (always works as fallback):**
```js
var campaigns = AdsApp.campaigns().withCondition("campaign.id = 123").get();
campaigns.next().enable();  // or .pause()
// NOTE: .remove() does NOT exist on campaign objects in Google Ads Scripts

// Bidding strategy change (classic API only, mutate update fails):
campaigns.next().bidding().setStrategy("TARGET_SPEND", { cpcBidCeiling: 2.50 });
// TARGET_SPEND = Maximize Clicks. "MAXIMIZE_CLICKS" is NOT valid.
```

**AdsApp.mutate() return values:**
- `result.isSuccessful()` — boolean
- `result.getErrorMessages()` — array of strings
- NO method to get the created resource name (`getReturnValue()` and `getReturnedResourceName()` both don't exist)
- To reference created entities: use **temp resource names** with `mutateAll` (see below)

**Temp resource names (confirmed working):**
Chain dependent creates in a single `mutateAll` batch using negative IDs:
```js
var ops = [
  { campaignBudgetOperation: { create: { resourceName: "customers/CID/campaignBudgets/-1", ... } } },
  { campaignOperation: { create: { resourceName: "customers/CID/campaigns/-2", campaignBudget: "customers/CID/campaignBudgets/-1", ... } } },
  { adGroupOperation: { create: { resourceName: "customers/CID/adGroups/-3", campaign: "customers/CID/campaigns/-2", ... } } },
  { adGroupCriterionOperation: { create: { adGroup: "customers/CID/adGroups/-3", keyword: {...} } } },
  { adGroupAdOperation: { create: { adGroup: "customers/CID/adGroups/-3", ad: {...} } } }
];
AdsApp.mutateAll(ops); // All resolved in one batch
```
Then query by name to get real IDs: `SELECT campaign.id FROM campaign WHERE campaign.name = '...'`

### Workaround: WEBPAGE_CODELESS Page View Conversions

WEBPAGE_CODELESS conversion actions are **completely immutable** via any API. Cannot disable, remove, change status, or modify biddable/primaryForGoal. This is a hard Google platform restriction.

**Solution:** Add `send_page_view: false` to `gtag('config', ...)` in the website code. This stops the codeless conversion from firing at the source.

### Manual UI: Conversion Goal Management

Changing `primaryForGoal` / otimização de ações CANNOT be done via Scripts or API. Must be done manually:

```
Metas (sidebar, ícone troféu) → Conversões → Resumo
→ clica no nome da conversão (texto azul)
→ página de detalhes abre com abas "Detalhes" e "Configurações"
→ clica "Editar configurações" (botão azul, canto inferior direito da seção Configurações)
→ seção "Otimização de ações" expande com 2 radio buttons:
   ○ "Ação primária utilizada para otimização de lances"
   ● "Ação secundária não utilizada para otimização de lances"
→ seleciona a opção desejada → Salvar
```

## Campaign Creation via Scripts

### Required Fields (confirmed)

```js
campaignOperation: {
  create: {
    name: "...",
    status: "PAUSED",
    advertisingChannelType: "SEARCH",
    campaignBudget: budgetResourceName,
    maximizeConversions: {},  // NOT biddingStrategyType
    containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",  // REQUIRED
    networkSettings: {
      targetGoogleSearch: true,
      targetSearchNetwork: false,
      targetContentNetwork: false
    }
  }
}
```

### Campaign Creation Gotchas

- `biddingStrategyType: "MAXIMIZE_CONVERSIONS"` does NOT work → use `maximizeConversions: {}` object
- `maximizeClicks` does NOT exist in v23 → use `targetSpend: { cpcBidCeilingMicros: "1500000" }` for Maximize Clicks
- `containsEuPoliticalAdvertising` is REQUIRED even for non-EU targeting
- Correct enum value: `"DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING"` (not "ADS", not boolean)
- Budget must have `explicitlyShared: false` for Maximize Conversions bidding
- Campaign name conflict: `campaignOperation.create` fails if a PAUSED campaign with same name exists
- Campaigns cannot be deleted — only paused. They stay in the account forever.

### Sitelink Creation (confirmed)

`finalUrls` belongs to the `Asset` object (sibling of `sitelinkAsset`), NOT inside `sitelinkAsset`.

```js
// WRONG
{ sitelinkAsset: { linkText: "...", finalUrls: ["url"] } }

// RIGHT
{ sitelinkAsset: { linkText: "...", description1: "...", description2: "..." }, finalUrls: ["url"] }
```

### Sitelink Policy: Common Disapprovals

| Trigger | Policy | Example |
|---|---|---|
| "win", "winning" in descriptions | Declarações não confiáveis | "Play and win daily" |
| Financial terms in landing page | MISLEADING_CONTENT | /invest with "profit sharing" |
| "profit", "returns", "guaranteed" | Unreliable claims | "Daily profit sharing" |

**Fix pattern:** sitelink assets are immutable — create a new compliant asset, unlink old from campaigns, link new. Old asset stays in account (cannot be deleted).

### Ad Copy Limits

| Element | Max Length |
|---|---|
| Headline | 30 chars |
| Description | 90 chars |
| Path1 | 15 chars |
| Path2 | 15 chars |

ALWAYS count characters before creating RSA ads. The API gives generic "Too long" error.

## GA4 Setup (Generic Flow)

### Create GA4 Property

```
analytics.google.com (NOT ads.google.com)
→ Create property with correct timezone + currency
→ Configure web data stream
→ Copy Measurement ID (format: G-XXXXXXXXXX)
```

### Create Measurement Protocol API Secret

```
analytics.google.com → Admin → Property → Data Streams → click stream
→ Events section → Measurement Protocol API secrets → Create
```

### Link GA4 to Google Ads

```
analytics.google.com → Admin → Product links → Google Ads → Link
→ Select Google Ads account → Confirm
```

## Server-Side Conversion Tracking (Generic Pattern)

### Architecture

```
Frontend (GA4 tag) ──cross-domain linker──▶ App (GA4 tag)
                                              │
                                    captures gaClientId + gaSessionId
                                              │
                                              ▼
                                    Backend: UserAttribution record
                                              │
                            ConversionTrackingListener
                              USER_REGISTERED → GA4 MP "sign_up"
                              CONTRACT_ACTIVATED → GA4 MP "purchase" + value
                                              │
                                              ▼
                                    GA4 ──linked──▶ Google Ads
```

### Key Technical Facts

- gclid is NOT a GA4 MP field. Attribution via session stitching (client_id + session_id)
- `engagement_time_msec: 100` required in every MP event or GA4 may ignore it
- `transaction_id` in purchase events = deduplication key
- GA4 MP production endpoint always returns 2xx (no error feedback). Use debug endpoint for testing
- Debug endpoint: `https://www.google-analytics.com/debug/mp/collect`
- client_id: use `gtag('get', 'G-XXX', 'client_id', cb)` API instead of parsing `_ga` cookie
- session_id goes in event params, NOT top-level body
- Max 72 hours backdating for events

## Financial Services Policy Learnings

> Note: the enforcement patterns below are practitioner-observed, not official Google policy. Verify against ads.google.com policy before acting.

- "Binary" in investment context = permanent ban trigger (binary options are banned)
- "Profit sharing" + "join/refer" = pyramid/MLM scheme flag
- "Automated trading" triggers review for financial licensing
- Landing page MUST have: legal business name, physical address, registration number, T&C, Privacy Policy, risk disclaimers
- Google requires financial services verification for India, but NOT for PH/PK/BD (specific program name "G2RS" is a practitioner-observed term, not confirmed in official Google Ads documentation)
- Safe ad copy pattern: focus on TOOL (platform, app), not OUTCOME (returns, profits)
- Include "Capital at risk" in ad copy — Google favors ads with embedded disclaimers
- Campaign with disapproval history should be abandoned — create new campaign with clean history
- MISLEADING_CONTENT is caused by landing PAGE CONTENT, not by domain name

### MISLEADING_CONTENT Triggers (Confirmed)

**Dangerous terms on landing page:** "trading", "investment", "deposit", "portfolio", "returns", "profit", "earnings", "withdrawal"

**Safe terms:** "community", "membership", "operations", "progress tracking", "participants"

**Ad copy triggers:** "earn", "income", "get paid", "profit sharing", "daily returns", "trusted", "proven track record", "no hidden fees", "grow your money", "secure your future"

## Wizard Flow (Manual Campaign Creation)

1. **Start:** click "+" (Criar) → Campanha
2. **Objective:** select card (Vendas / Leads / Tráfego) → Continuar
3. **Type:** Pesquisar → check "Visitas ao site" → enter URL → Continuar
4. **Name:** enter campaign name → Continuar
5. **Bidding:** leave Maximize Conversions → Avançar
6. **Settings:** uncheck "Rede de Display"; add locations; add languages → Avançar
7. **AI Max:** uncheck BOTH "Personalização do texto" AND "Expansão de URL final" → Avançar
8. **Keywords + Ads:** fill URL final; paste keywords; open RSA editor → add headlines + descriptions → Concluído → Avançar
9. **Budget:** set daily budget → Avançar
10. **Publish:** fix any issues → Publicar campanha

**Critical:** each step only saves on "Avançar". Clicking sidebar steps loses data.

## MCP Setup (Generic)

**Server:** `grantweston/google-ads-mcp-complete` v2.0.0

**Required credentials:**
1. Developer token from MCC → Ferramentas → Central de API
2. Google Cloud OAuth client ID + secret (Desktop Application type, Google Ads API enabled)
3. OAuth refresh token via browser auth flow

## Playwriter Patterns (for Recommendations only)

### Apply a recommendation card
```js
await state.page.goto("https://ads.google.com/aw/recommendations?ocid=<ACCOUNT_ID>");
await state.page.waitForLoadState("networkidle");

await state.page.evaluate(() => {
  const options = document.querySelectorAll("[role=option]");
  for (const opt of options) {
    if (opt.textContent?.includes("TARGET_RECOMMENDATION_TEXT")) {
      const btns = opt.querySelectorAll("[role=button], button");
      for (const btn of btns) {
        if (btn.textContent?.trim() === "Aplicar") {
          btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          break;
        }
      }
      break;
    }
  }
});
await state.page.locator('role=button[name="Aplicar"] >> nth=1').click({ force: true });
```

### Key rule: never use native click()
Google Ads wraps everything in `acx-overlay-container`. Always use `page.evaluate(() => element.click())` or `dispatchEvent`.

## URL Map

Base: `https://ads.google.com` — replace `<ocid>` with the account's Customer ID.

| Destination | Path |
|---|---|
| Overview | `/aw/overview?ocid=<ocid>` |
| Campaigns list | `/aw/campaigns?ocid=<ocid>` |
| Ad Groups | `/aw/adgroups?ocid=<ocid>` |
| Ads list | `/aw/ads?ocid=<ocid>` |
| Keywords | `/aw/keywords?ocid=<ocid>` |
| Campaign Settings | `/aw/campaignsettings?ocid=<ocid>` |
| Conversions | `/aw/conversions?ocid=<ocid>` |
| Account (Verification) | `/aw/policy/account?ocid=<ocid>` |
| Sitelink Extension | `/aw/adextensions/new?ocid=<ocid>&placeholderType=1&assetFieldType=31` |
| Callout Extension | `/aw/adextensions/new?ocid=<ocid>&placeholderType=17&assetFieldType=32` |
| Search Terms Report | `/aw/keywords/searchterms?ocid=<ocid>` |
| Negative Keywords | `/aw/keywords/negative?ocid=<ocid>` |
| Recommendations | `/aw/recommendations?ocid=<ocid>` |
| API Center (MCC only) | `/aw/apicenter` |
| Manager Accounts | `https://ads.google.com/home/tools/manager-accounts/` |

## Geo Target Constants

| Country | ID |
|---|---|
| Bangladesh | 2050 |
| India | 2356 |
| Indonesia | 2360 |
| Malaysia | 2458 |
| Pakistan | 2586 |
| Philippines | 2608 |
| Thailand | 2764 |

## Available Script Templates

All templates in `.maccing/growth/google-ads/<account>/scripts/` (copy from plugin `skills/google-ads/scripts/`).

| Script | Description |
|---|---|
| `read-full-audit.js` | Full account audit: campaigns, ad groups, ads, keywords, search terms, conversions |
| `read-campaign-performance.js` | Campaign metrics + budget + bidding strategy |
| `read-keyword-performance.js` | Keywords with Quality Score breakdown |
| `read-search-terms.js` | Search queries with wasted spend and converting term filters |
| `read-conversion-actions.js` | All conversion actions with attribution settings |
| `read-ad-details.js` | RSA headlines/descriptions with pin positions, ad strength |
| `write-create-rsa.js` | Create RSA in existing ad group (PAUSED state) |
| `write-add-keywords.js` | Add keywords via `AdsApp.mutateAll` |
| `write-add-negatives.js` | Campaign-level negative keywords |
| `write-pause-campaign.js` | Pause or resume campaign |
| `write-update-ad-url.js` | Update Final URL of an existing ad |
| `write-create-conversion.js` | Create new conversion action |
