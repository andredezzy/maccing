## Contents

1. [Account Creation / Onboarding (per BM)](#account-creation--onboarding-per-bm)
2. What You Can and Cannot Automate — see `api-automation.md`
3. Dashboard backend API (session-cookie, AdsPower-profile access): see `api-automation.md`.
4. [Auto-unsubscribe chatbot (keyword opt-out, dashboard UI only)](#auto-unsubscribe-chatbot)
5. [Pricing & BSP Comparison](#pricing--bsp-comparison)
6. [YCloud Campaign Send File Format and Campaign-API-Lag Gotchas](#ycloud-campaign-send-file-format-and-campaign-api-lag-gotchas)

---

## Account Creation / Onboarding (per BM)

Creating the YCloud **account** (login + company) is a SEPARATE step from WhatsApp **Embedded Signup** (connecting a WABA/number). One YCloud account **per disposable BM**, created **from that BM's own AdsPower profile** (its isolated proxy) — never a clean host browser, never shared across BMs (a shared account is a single point of failure; YCloud has false-positive-suspended financial-niche accounts).

**Prereqs before the form**
- **Account email — separate per BM; prefer a domain email.** Must differ from every other BM's YCloud account. Disposable temp inboxes (`*.justwork.email`, etc.) risk non-delivery or being rejected as disposable → register the BM's throwaway brand domain and use a forwarded **catch-all** address. Pick the forwarding method by where the domain's DNS actually lives (check the nameservers): **Namecheap BasicDNS → Namecheap free Email Forwarding** (keep BasicDNS); **Cloudflare nameservers → Cloudflare Email Routing** (free — enable it, Cloudflare auto-adds the MX/TXT, then route `*@brand.tld` → a real inbox). Either way the email MX coexists with the site's A/CNAME (web) — different record types, no conflict. Isolation-safe: the visible address is on the throwaway brand domain; the forwarding TARGET is invisible externally.
- **A burner WhatsApp number** to receive the signup code — see step 2.

**The signup wizard (5 steps, observed 2026-06)**
1. **Create your free account** — Work email, First/Last name, Password, hCaptcha, accept Terms → Continue.
2. **⚠️ The account-verification code is delivered as an in-app WhatsApp MESSAGE** (not email, not SMS). The receiving number must be a LIVE WhatsApp account you can read, and must be **neither** (a) any other BM's WhatsApp (reuse/linkage) **nor** (b) the fresh chip reserved for THIS BM's WABA — receiving any WhatsApp on a number permanently disqualifies it from WABA registration (a WABA number must never have been on WhatsApp). **Workaround (field-verified):** on a secondary handset, register a NEW disposable WhatsApp using a cheap **online SMS-activation** number (the OTP site catches WhatsApp's *registration* SMS), then read YCloud's signup code inside that disposable WhatsApp. Keeps both the other BMs' WhatsApp and the WABA chip pristine. (Online "receive-WhatsApp-OTP" rental sites alone do NOT solve it — they're built for WhatsApp *registration*, not for receiving the YCloud message; pairing one with a real handset is what works.)
3. **"Tell us about your company"** — soft profiling (tunes recommendations, no compliance weight), but keep it coherent with the brand story: Company name = the brand; Company website = the brand domain; Country; **Industry = Education** for a financial-education niche (**never Finance** — niche trigger + contradicts the WhatsApp profile category); Role; Company size (small).
4. **"How do you plan to use YCloud?"** — multi-select; for broadcast dispatch pick **Marketing Automation + Lead Generation**.
5. **Console** — a **$0.50 USD free creation credit** lands in the wallet (one-time, on signup). The "Start to create channel" CTA is the WhatsApp Embedded Signup — but do NOT click it yet (see the rest below).

> ⏸ **MANDATORY: after creating the account, leave it idle ~24h before using it — keep it AFK (cooldown).**
> Do NOT immediately start Embedded Signup, connect a WABA, add a payment method, or send anything on a
> brand-new account. YCloud's free-tier risk-control has **false-positive-suspended financial-niche accounts
> within hours of signup** (observed on multiple accounts) — and a fresh account that instantly wires up a
> WABA and launches a campaign looks exactly like the automated-abuse pattern the screen is built to catch.
> The 24h idle lets the account clear automated post-signup review before any assets are attached — same
> logic as the 24h BM rest after accepting a disposable BM. During the window do nothing on the account (no
> logins-and-clicking sprees, no WABA, no top-up beyond the auto $0.50 credit). If it suspends anyway (it can
> trip even while idle), file the support ticket immediately (Education / BM legal-identity framing, never the
> real business) and resume only once restored.

> **Company-name reuse across two YCloud accounts is a WEAK link, not a cascade trigger.** YCloud disables accounts on message quality / policy / purchased-origin, and its documented cascade is "all WABAs under a BM" (within one BM), not across separate accounts — it even recommends a backup BM+WABA. The real cross-account links are shared **IP / payment / device**, not the company name (an invisible soft CRM field). The customer-facing WhatsApp **display name** reuse is separately validated-safe (see `meta`). Free hedge: vary the invisible Step-3 company name; don't change the display name.

**After the 24h rest: WhatsApp Embedded Signup (connect the WABA/number).** Uses YCloud's developer app — no Meta developer account, only Facebook login + BM **Admin**, run from the BM's AdsPower profile. Requires a **fresh WABA number** (BR eSIM/SIM never on WhatsApp) to register during the flow.

**The Embedded Signup wizard — full screen-by-screen (observed 2026-06 on a verified BM).** Trigger: YCloud console → **"Start to create channel"** → opens the **"Login do Facebook para Empresas"** OAuth dialog (YCloud's own Meta app — no Meta developer account needed; you must already be logged into the BM's Facebook profile in that AdsPower session). A left-side 4-dot rail tracks progress.

**Step 1 — "Selecione os ativos de negócios para compartilhar com o YCloud"**
- *Portfólio empresarial:* select the disposable BM (its purchased identity name).
- *Conta do WhatsApp Business:* the dropdown lists **"Criar uma conta do WhatsApp Business"** plus any existing WABA. ⚠️ **A pre-existing +1 555-xxx Meta test-number WABA auto-appears** (every BM ships with one). **Choose "Criar uma conta" — NEVER the +1 555 test number** (it can't broadcast and isn't your chip). The test WABA stays parked in the BM afterward — ignore it, don't delete. → Avançar.

**Step 2 — "Insira os dados da empresa para os novos ativos"** (subtitle: "As alterações realizadas afetarão somente os novos ativos" → nothing here touches the BM's locked verified fields).
- **Nome** (editable) = **the BM name** (the purchased BM's identity — a person/company name), **NOT the brand.** This is the internal WABA name; the customer-facing brand (your disposable brand) is the number's **display name**, set in Step 3.
- **Categoria** (editable, required) = **Education** (financial-education niche; never Finance/Serviços financeiros — niche trigger + contradicts the WhatsApp profile category).
- **País** ⚠️ **LOCKED** (greyed) on a verified BM — inherited, read-only.
- **Site** ⚠️ **LOCKED** (greyed) on a verified BM — pre-filled with the BM's **verified domain** (the purchased BM's locked site). It shows an `n/512` char counter but is **read-only — do NOT try to change it here.** (The brand site goes in the *profile* Website field later — see Step 6.)
- **Fuso horário** = America/Sao Paulo. "Mostrar mais opções" can be skipped (about/description live on the profile). → Avançar.

**Step 3 — "Adicione seu número de telefone do WhatsApp"** — radio: **"Usar somente um nome de exibição"** vs **"Adicionar um novo número"**. ⚠️ Pick **"Adicionar um novo número"** ("A verificação é obrigatória"); "somente nome de exibição" is a name-only sender with **no registered number** = useless for broadcast. Reveals:
- **Telefone:** the fresh WABA chip (BR eSIM, never on WhatsApp), e.g. BR +55 (11) 9xxxx-xxxx.
- **Nome de exibição do WhatsApp Business** = the customer-facing **display name**. On-screen helper: *"deve ser igual ao nome comercial e cumprir as diretrizes."* ⚠️ **It must match the brand on the profile Website** (the verification source) — a shortened form risks a *mismatch* rejection (e.g. "Acme" alone fails when the site shows "Acme Edu"). Use **`Brand (BM entity)`** → "[Brand] ([BM entity])". Full technique: `meta`.
- **Escolha como verificar: SMS** or **Ligação telefônica** — ⚠️ **NEVER WhatsApp** (receiving WhatsApp on the chip permanently disqualifies it as a WABA number). Mobile eSIM → SMS; landline → ligação. → Avançar → enter the OTP received on the chip.

**Step 4 — "Reveja o que você vai compartilhar com YCloud"** (BSP consent) — YCloud requests access to the WhatsApp Business Account with 3 standard perms: *Gerenciar suas contas do WhatsApp* · *Gerenciar e acessar conversas* · *Registrar e enviar eventos para a Meta*. → **Confirmar**.

**Step 5 — "Conectando sua conta…"** (brief spinner) → **"Sua conta está conectada a YCloud"** ("Assets successfully created: &lt;BM name&gt; — Conta do WhatsApp").
- A **"we'll review your business within 24h if there's a problem"** notice — **standard for every new WABA** (Política Comercial), **not a flag**.
- ⚠️ **"Melhore sua experiência" — 3 toggles, ALL pre-checked. Uncheck all 3** (insights / auto-identify order & lead events / share Cloud API events): unused on a broadcast-only BM (no ads/commerce), and each feeds Meta more signal on a disposable asset — the order/lead one is **Meta AI reading conversation content** (unwanted scrutiny in the financial niche). Reversible later in Configurações da empresa. → **Continuar para a configuração de recursos**.

**Lands on WhatsApp Manager → "Orientação de configuração"** (`.../whatsapp_manager/setup_guidance`). The URL carries the ops IDs: **`business_id`** (BM) · **`asset_id` = the WABA ID** · **`phone_number_id`**. Header: number · Integração=YCloud · Nome=display name · "Conversas iniciadas pela empresa: 0 de N usadas" (N = tier, e.g. 2000). A checklist runs: **Conta conectada → Número de telefone conectado** (polls ~1 min — click **"Atualizar"**) **→ Sua conta está ativa → Sua empresa é verificada** (all auto-complete on a verified BM). The 3 remaining tasks (QR code, "send first message", "learn to send a template") are **optional onboarding — skip them** (ramp with real templates, not test sends).

**Back in the YCloud console (WhatsApp accounts):** the channel card shows **WABA ID**, **Owned by BM**, **Message limit** (= tier, e.g. "2000 customers"), and the number row with **Status: Connected**, **Quality Rating: Unknown** (until sending), and the **display name "… is being reviewed"** (tooltip) — review takes minutes-to-hours; if rejected, resubmit ~10×/30d (low stakes). Card actions: WhatsApp Flows · Manage templates · + WhatsApp Business Number.

**Step 6 — WhatsApp profile (NOT part of Embedded Signup, do it after).** YCloud console → **WhatsApp accounts** → the channel → **Business Profile** (left nav, under "WhatsApp Business Number settings"). Exact fields — YCloud UI label · char limit · what to fill (observed 2026-06):

| Field (exact label) | Limit | Fill with |
|---|---|---|
| **Profile photo** ("Choose JPG or PNG File") | 640×640 px, <5MB, JPG/PNG | brand logo |
| **Display name** ("Edit" button) | — | set in Embedded Signup; badge shows **"In review" → "Approved"** |
| **About** | **139** chars | one-line brand + niche tagline |
| **Category** (dropdown) | — | **Education** (financial-education niche; never Finance) |
| **Description** ("What does your business do?") | **512** chars | brand story, Education-framed (no "gestão de capital" / regulated-activity wording) |
| **Address** | **256** chars | e.g. just the country |
| **Email** | **128** chars | ⚠️ **leave EMPTY** — a real email links the WABA to the real domain (isolation break) |
| **Website1** | **255** chars | ⚠️ **brand homepage** (NOT /grupo) — the **display-name verification source**; must show the brand. DIFFERENT field from the locked WABA Site in Step 2 |
| **Website2** | **255** chars | leave empty |

→ **Save**. The right-pane "Business profile preview" mirrors the customer view. Technique for the brand-site ↔ display-name relationship: `meta`.

**Sequencing after the WABA is live — wait for display-name approval before templates/sending.** Post-connect the display name sits **"In review"** and a ~24h Commerce-Policy review runs on the fresh WABA. Default to **holding both template submission AND the first send until the display name shows "Approved":**
- **The two reviews are independent pipelines** — submitting templates does NOT affect the name review. So holding templates is a *conservatism* choice, not a technical dependency. (If speed matters and you accept a small stacking risk, submitting templates in parallel is technically fine.)
- **Why hold anyway:** (a) avoids stacking a likely **template rejection** (regulated/financial-niche copy) onto the fresh WABA's initial Commerce-Policy window; (b) the name approval is a clean "WABA passed identity/name review → healthy" checkpoint before adding more; (c) costs ~nothing when the number isn't time-critical.
- **Sending is a FIRM gate (not optional):** never run a marketing/cold broadcast while the display name is "In review" — recipients see the **bare phone number** instead of the brand → "who is this?" reflex → blocks/reports = the fastest route to a **RED** quality rating on a fresh number. Sending on a same-day-created WABA is also the rush/abuse pattern. Send only after **display name Approved + WABA settled ~24h+ + templates Approved → then a low warm ramp.**

---

See `api-automation.md` for what is API-pullable vs not.

---

## Auto-unsubscribe chatbot (keyword opt-out, dashboard UI only)

A custom opt-out quick-reply button on a broadcast template (e.g. a "stop messages" button) does NOT
auto-add the clicker to the unsubscribe list, and the click is invisible to the public API (it appears
only as a `buttons[].count` in the dashboard per-campaign analytics). To actually suppress opt-outs you
build a keyword-triggered RULE-BASED chatbot whose flow ends in an Unsubscribe component, AND assign
that chatbot to the number. This is dashboard-UI only, there is no public API for it.

Exact steps [verified live 2026-06]:
1. AI Agent (left menu), Create Agent, **Rule-based Agent** (the deterministic one; "AI Agent" and
   "Responsive AI Agent" are LLM-based). Name it, Create.
2. The agent opens on **Profile**. Leave defaults: Welcome Message off, and "What should the agent do
   when it doesn't understand the user's intent" = **Remain without responding** (so the bot stays
   silent on everything except the opt-out keywords).
3. **Flows** tab, **Create a flow** (or open the auto-created one), **Build** canvas, **Add a trigger**.
4. Choose **Keyword trigger**, set **Keywords matching rule = Exact matching** (safer than Contains,
   which false-triggers on phrases like "I do not want to stop"), then **+ Keyword** for the exact
   button label plus common typed variants, one keyword each. **Save** with the node panel's Save
   button, NOT the X (the X discards the config).
5. Connect the next node by **dragging** from the Trigger node's right-edge handle onto the new node.
   Clicking the handle only re-opens the node editor; you must DRAG to create the link.
6. In the **Tool box**, click **Unsubscribe** to add the node. In its panel turn **Auto-reply = On** and
   write the confirmation message, then **Save** (node panel).
7. Drag-connect Trigger to Unsubscribe so an arrow links them.
8. **Save the flow** (top-right), and in the "Save the flow" dialog flip **Set up flow status = Active**,
   then Save. There are TWO save levels: each node panel AND the flow.
9. **MANDATORY: assign the chatbot to the number.** WhatsApp accounts, the number's gear (Settings),
   **Inbox > Assignment**, **Priority 3 "Assign to" -> AI Agent ->** select your rule-based agent,
   **Save**. The active flow alone never fires without this: the agent's "Associated" count stays 0 and
   the chatbot receives nothing. [deep-research + live verified]

Gotchas:
- Flow Active is not enough; the assignment in step 9 is what routes the number's messages to the bot.
- Assignment fires only at conversation CREATION [verified live + docs]. A NEW conversation (a number
  that never messaged before) IS auto-assigned to the Priority-3 chatbot and the flow runs; a
  PRE-EXISTING conversation NEVER re-routes on later inbound messages (the inbox "Assigned to bot" stays
  empty for old conversations, and the per-conversation manual-assign menu lists only human agents, not
  the bot). So always test from a brand-new number, and for the EXISTING audience rely on a separate
  suppression (e.g. exclude prior recipients at send time) since their opt-out clicks will not auto-fire
  the bot. The 24h window does NOT block any of this: an inbound message reopens the window, and the
  Unsubscribe action needs no window.
- For a template quick-reply button specifically, "Click button trigger" is the alternative to the
  keyword trigger.

---

## Pricing & BSP Comparison

> Meta base rates, BSP/platform comparison table, pricing model notes, and Why BSP vs Direct API are in `skills/meta/whatsapp/reference/pricing-and-billing.md`.

---

## YCloud Campaign Send File Format and Campaign-API-Lag Gotchas

**YCloud campaign send file format:** upload `.xlsx` (not `.csv` — CSV is rejected by the campaign UI). First column header must be exactly `phone` with numbers in +E164 format (e.g., +55XXXXXXXXXXX). Additional columns become template variables mapped in order. The UI "Test send" button is greyed out until at least one template variable field is populated with a sample value — fill all variable fields first, then the button activates.

**Broadcast-list storage hygiene (PII):** broadcast contact lists hold real recipient PII (phone + name). Store them in a dedicated per-number folder inside the project, e.g. `.../<profile>/<bm>/whatsapp/<number>/broadcasts/`, NEVER loose in `~/Downloads` or scattered across machines. **Gitignore the list data files** (`*.xlsx`, `*.csv`) so PII never enters git history, they are fully regenerable from the source DB. Keep one tracked `README.md` in the folder describing what each list is and the exclusion logic. Each day's pull EXCLUDES everyone already sent on prior days (matched by normalized E164), drops demo/invested/junk-name rows, and takes the freshest N un-messaged signups.

**Monitoring sends via the YCloud API (polling — verified live 2026-06):** the dashboard Analytics/Logs are the GUI view, but per-message status is pullable programmatically. ⚠️ The published YCloud SDKs (Java/Python/PHP) claim there is NO list endpoint (only `retrieve`/`send`/`sendDirectly`) — that is **WRONG**; the live REST API DOES expose a paginated list. Trust the live API over the SDK docs.
- **List:** `GET https://api.ycloud.com/v2/whatsapp/messages?limit=100` (header `X-API-Key: <key>`) → `{offset, limit, length, items:[...]}`. ⚠️ **PAGINATION (verified live 2026-06):** the `offset` param is **silently IGNORED** (offset=0 and offset=3 return identical rows) and there is **no cursor** — BUT the **1-indexed `page` param DOES paginate** (`?page=1&limit=100`, `?page=2&limit=100`, …). `limit` is **capped at 100** (`limit>100` errors). → Page with **`page`** (NOT `offset` — looping offsets returns the same newest page repeatedly and inflates counts ~Nx), **dedup by `id`**, and stop when a page returns no new ids. `?includeTotal=true` returns the account `total` so you can detect how many older messages remain. For full history beyond the API's page ceiling, use the campaign UI Analytics. No server-side time/status filter works (but `filter.to` and `filter.wabaId` DO apply server-side) → filter client-side by `createTime`/`type` for everything else.
- **Per-message fields:** `id`, `wamid`, `status`, `from`, `to`, `type` (text|template|…), `createTime`, `sendTime`, `deliverTime`, `readTime`, `totalPrice`, `pricingCategory` (`service`=free | `marketing` | `utility` | `authentication`); on failure `errorCode` + `whatsappApiError.{code,message}`.
- **Status enum:** `accepted → sent → delivered → read`, or `failed`. (`read` only if the recipient has read receipts on — "delivered" is the reliable floor.)
- **Single message:** `GET /v2/whatsapp/messages/{id}` (the YCloud `id`, NOT the `wamid`).
- **Aggregate a broadcast:** paginate all → group by `(createTime[:10], type, status)`. A UI campaign = the batch of `type:"template"` messages on its send date; split failures by `errorCode` (131026 undeliverable→remove vs 131049 throttle→retryable).
  ```bash
  curl -s "https://api.ycloud.com/v2/whatsapp/messages?limit=100&page=1" -H "X-API-Key: <key>" \
    | jq '[.items[]|{d:.createTime[0:10],type,status}]|group_by(.d+.type+.status)|map({k:(.[0].d+" "+.[0].type+" "+.[0].status),n:length})'
  ```
- ⚠️ **Campaign-send LAG (critical — the `/messages` list is NOT real-time for campaigns):** messages sent via the console **campaign (bulk UI) do NOT appear in `/v2/whatsapp/messages` for HOURS** (likely a periodic sync, not minutes). Verified live: a campaign can still be entirely ABSENT from the list hours after the console shows it **Completed and charged**, then appear the next day. There is also **NO campaign/bulk API**: `GET /v2/whatsapp/bulkMessages/{id}` → 404, and the `?bulkMessageId=` query param is silently IGNORED (returns the full unfiltered list). **So `/messages` polling is real-time ONLY for API-direct (`sendDirectly`) sends** (those appear instantly). For **real-time CAMPAIGN monitoring use the campaign's UI Analytics/Logs tab** (immediate per-recipient status + the campaign ID is in the URL `…/bulkMessages/detail/…/{id}`) **OR subscribe to `whatsapp.message.updated` webhooks**. Use `/messages` polling for campaigns only as a delayed/next-day reconciliation, not for the freshly-sent batch.
- **Push alternative (better at scale):** subscribe to the `whatsapp.message.updated` webhook (`POST /v2/webhookEndpoints` with `enabledEvents:["whatsapp.message.updated"]`); tag each send with `externalId="<campaignId>:<recipientId>"` so events self-identify, and verify the `YCloud-Signature` HMAC (`t={ts},s={hex}`, signed payload `{t}.{body}.`). There is NO campaign-stats API — webhooks or list-polling are the only programmatic options; aggregate campaign numbers otherwise live only in the UI.
- **Rate limits:** 200 rps / 10,000 rph on reads; the free plan has no extra read restriction.

