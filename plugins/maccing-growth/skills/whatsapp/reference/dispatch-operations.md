## Contents

- [Chip Warming (Unofficial API Route)](#chip-warming-unofficial-api-route)
- [Direct Cloud API Setup (No BSP)](#direct-cloud-api-setup-no-bsp)
- [Switching BSP / Migrating an Existing WABA](#switching-bsp--migrating-an-existing-waba)
- [Measuring Success](#measuring-success)
- [Quality Rating Recovery Protocol](#quality-rating-recovery-protocol)
- [Number Longevity & Cold Lists](#number-longevity--cold-lists-preserve-over-burn)

> **Scope:** WA-specific dispatch operations only. For the full disposable-BM pipeline, proxy/isolation stack, profile acquisition, BM sources, Tier System, Number Warming Protocol (official WABA), Setup Sequence, Display Name Strategy, Business Profile Compliance, and Phone Number Strategy — see the `meta` skill.

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


---

### Direct Cloud API Setup (No BSP)

For teams with technical capability, direct Cloud API is cheaper (no BSP monthly fee or per-message markup).

**Setup sequence (direct, requires developer account):**
1. Log into `developers.facebook.com` as BM admin
2. Register as developer → verify via SMS (needs real carrier number, see Phone Number Strategy)
3. Create App → type "Business" → associate with BM
4. Add WhatsApp product to the app
5. Create WABA in the app dashboard → set display name (review: up to 24h)
6. Create System User in BM Settings → Users → System Users → Admin role
7. Add assets: Apps → your app → enable `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
8. Generate permanent token (shown once, save immediately)
9. Register phone number via OTP (needs virgin number)
10. Add payment method at WABA level
11. Create and submit templates
12. Send via: `POST https://graph.facebook.com/{version}/{phone_id}/messages`

**Alternative: BSP Embedded Signup (NO developer account needed):**
If developer account SMS verification is blocked (common with purchased profiles), use a BSP:
1. Sign up on BSP platform (e.g., YCloud free plan at ycloud.com)
2. Go to WhatsApp accounts → WhatsApp Business API → Get started
3. On the onboarding page, scroll to "Embedded Sign-up" section → click **"I'm ready to start"** (NOT the "On boarding" floating button)
4. Facebook Login popup opens → log in as the BM admin profile
5. Select existing Business Manager → create WABA → set display name
6. Add phone number → receive OTP
7. BSP provides API access through their platform

The BSP uses THEIR developer app — you don't need one. You only need Facebook login + BM admin access.

**Token types:**
- Temporary (from app dashboard): expires ~24h, tied to personal account. For testing only.
- System User (permanent): does not expire unless revoked, survives if admin profile gets restricted. Always use for production.

**Webhooks:** not required to send messages. Only needed for delivery receipts. Simple HTTPS endpoint returning 200 OK.

**Rate limits (Cloud API, post-Oct 2025):**
- Tier 0 (unverified): 250 unique users/24h
- Tier 1 (verified): **2,000/24h** (raised from 1,000 on Oct 7, 2025)
- Tier 2: 10,000/24h (auto-scale once 50% of 2,000 used in 7 days at Green/Yellow quality)
- Tier 3: 100,000/24h (auto-scale)
- Unlimited: auto after 100k
- Throughput: 80 msg/sec → 1,000 msg/sec at Unlimited + Green

**Billing (direct API, Brazil 2026):**
- Charging begins at first real message sent (not at WABA creation)
- Marketing: ~$0.0625/msg delivered (base rate; verify — April 2026 Brazil pricing update may apply; BRL billing available from July 2026 for eligible accounts)
- Utility: **~$0.0068/msg** outside CSW; **free** inside 24h CSW (since July 1, 2025)
- Authentication: **~$0.0068/msg** (charged even inside CSW — unlike utility)
- Service (inbound-initiated): **free** within 24h window, no monthly cap (since Nov 1, 2024)
- Payment at WABA level (not BM or app level)
- Wise/Revolut virtual cards work (Visa/Mastercard with international support)
- Meta does NOT require cardholder name to match BM legal name


---

### Switching BSP / Migrating an Existing WABA

A WABA lives in the BM, NOT in the BSP. The BSP is just a connected partner (system user with API access). If a BSP suspends you or you want to switch:

**What survives the switch:** phone number, display name, approved templates, quality rating, messaging tier, OBA status.
**What does NOT survive:** message history, contacts/flows stored in the old BSP's dashboard, pending/rejected templates.

**Migration steps:**
1. **Reset/disable 2FA PIN first** (BM admin can do this WITHOUT the old BSP). The old BSP (e.g. YCloud) sets a 6-digit PIN you don't know — must disable it to re-register elsewhere.
   - Exact path (current WhatsApp Manager UI, 2026): `business.facebook.com → Gerenciador do WhatsApp → Números de telefone → select number → tab "Confirmação em duas etapas"` (it's a TAB in the row Insights | Perfil | Automações | Links da mensagem | **Confirmação em duas etapas** | ... — NOT a gear icon)
   - ⚠️ **GOTCHA 1: both "Desativar" and "Alterar PIN" buttons are GREYED/DISABLED until you enable 2FA on the Meta ACCOUNT.** The red warning "A autenticação de dois fatores é necessária para sua conta da Meta" is a hard gate (BMs with enforced 2FA requirement). You must enable account-level 2FA FIRST. Only then do the number-PIN buttons unlock.
   - Enabling account 2FA needs a phone (SMS/WhatsApp) or authenticator app.
   - ⚠️ **GOTCHA 2 (the real killer for purchased/antidetect profiles): the 2FA change itself can be BLOCKED by Meta's device-trust hold.** Message: "Você não pode fazer essa alteração no momento. Notamos que você está usando um dispositivo diferente do que costuma usar... Vamos permitir que você faça essa alteração após usar este dispositivo por um tempo." Meta won't allow security changes (2FA, password) on a freshly-accessed purchased profile in an antidetect browser. This cascades: can't enable 2FA → can't disable number PIN → can't migrate BSP.
   - **Mitigation: this is where profile warmup actually matters.** Profile warmup is NOT needed for WABA SETUP (creation/templates), but device/session trust IS needed for SECURITY CHANGES (2FA, password, PIN, BSP migration). Warm the antidetect profile (daily login + light browsing for several days) so Meta trusts the device, THEN security changes are allowed.
   - **Implication: if you might ever need to migrate BSP or change security settings, warm the profile early.** Don't skip warmup entirely just because WABA creation doesn't need it.
   - After account 2FA is on (device trusted) → click **"Desativar a confirmação em duas etapas"** to remove the number PIN. **Meta then sends a confirmation email to the admin's address — you MUST click the link in that email to complete the disablement.** Without clicking the email link, the PIN is NOT actually removed. Keep access to the admin email during migration.
   - Note: The two-step verification PIN **cannot be disabled via the API** — there is no API endpoint to remove the 2FA feature entirely. The API can only UPDATE the PIN value (`POST /{phone_number_id}` with `pin`). Full disablement requires the WhatsApp Manager UI + email confirmation only.

**If the connected BSP suspends you and you can't migrate (device-trust blocks the PIN reset):** the path of least resistance is recovering the original BSP account (support ticket), NOT forcing a migration. The number stays registered on the original BSP; if it recovers, you send without migration. Force migration only after the device gains trust.

**A BSP "account unavailable / suspended" is very often a FALSE-POSITIVE risk-control auto-flag, NOT a Meta ban — open a support ticket FIRST.** Confirmed real case (YCloud, 2026): account auto-suspended by their security system, recovered in <24h via a support ticket. Support's words on recovery: "your account was mistakenly blocked due to risk control, but it has now been unblocked." The recovery ticket that worked: account email + WABA ID + Phone Number ID + the dual ask ("restore access OR disable the 2-step PIN"). They then asked 3 legitimacy questions before restoring: **(1) Legal name (2) Business website (3) Business type** — answer these with the verified-business identity and the LOWEST-RISK truthful business category (e.g. "Education / educational content"), NOT a financial/investment framing (financial categories are what trip BSP risk-control in the first place; match your WABA profile category). Don't rush into an expensive/risky BSP migration before giving support a chance — migration is the fallback, not the first response to a suspension.

**Cleanest unblock when you DON'T know the PIN (old BSP set it):** ask the old BSP support to EITHER restore your account OR disable the two-step-verification PIN on the number from their side. The BSP that set the PIN can disable it server-side — this bypasses both the account-2FA gate and the device-trust hold entirely. Single best ask in a recovery ticket: "Restore access OR disable 2-step PIN on number X."

**NEVER guess the PIN.** Multiple wrong attempts lock the number for hours/days. If you don't know it and can't disable it (device-trust), don't brute-force — recover via the old BSP or wait for device trust.

**No access-token path to reset the PIN either:** Meta's API can set/reset the number PIN (`POST /{phone_number_id}` with `pin`), but that needs an access token — which needs the BSP (down) or your own dev app (blocked). So the API reset is also gated. The old-BSP-disables-it route is the realistic unblock.

**The NEW BSP's own migration wizard confirms this dependency (Gupshup, 2026):** Gupshup's "Create App" flow asks "How do you want to create your WhatsApp Business Account?" with two options — "New phone number" vs "Migrate a live phone number." The migrate option's own description states verbatim: **"Migrate from other BSP to Gupshup. Your existing BSP will need to disable 2FA to complete migration."** This is independent confirmation that a live-number BSP migration is HARD-GATED on the source BSP disabling two-step verification. The wizard steps are: 1. Let's Started (choose migrate + local storage region, USA default is fine) → 2. Contact Details → 3. Embedded Signup → 4. WABA Phone Selection → 5. Setup Complete. The block lands at step 4. Don't push through embedded signup just to "pre-stage" — it risks tripping fresh device-trust flags on the antidetect profile you're warming, and step 4 can't complete anyway. Stop at step 1, leave the wizard (it's resumable), unblock the PIN via the old BSP first.
2. New BSP → Embedded Signup → select existing BM → **select existing WABA** (not create new)
   - ⚠️ **A live WABA still "Conectado" to the OLD BSP will NOT appear in the new BSP's embedded-signup asset picker.** Meta hides a WABA already bound to one BSP from a different BSP's "share assets" dialog until it's released. Symptom (confirmed Gupshup, 2026): the picker offers only a stray WABA with a **+1 555-xxx-xxxx Meta test number** (auto-provisioned), and searching for your real display name returns nothing. This is the SIGNAL that your real number is still bound to the old BSP — NOT that the WABA was lost.
   - **Verify the WABA actually exists and where:** business.facebook.com → WhatsApp Manager → Telefones → open the WABA-account selector (top-right). It lists ALL WABAs in the BM with their IDs + connection status, regardless of BSP binding. A purchased BM often has 2+ WABAs (your real one + an empty/test one). Your real WABA shows status "Conectado" with the real number; the test WABA shows the +1 555 number.
   - **Don't connect the new BSP to the test WABA** — its +1 555 test number can only message ~5 pre-registered recipients (no real broadcast). Connecting to it wastes the slot and connects nothing useful.
   - **The fix is still releasing the number from the old BSP** (disable 2-step PIN / old-BSP support), after which the real WABA becomes selectable in the new BSP's picker.
3. OTP on the number → number's Cloud API registration moves to new BSP
4. Send

**Caveat — credit line:** if the WABA was created on the old BSP's credit line, you may need to migrate the number to a new WABA under the new BSP's credit line. Number/template/name still travel with it.

**Twilio exception:** Twilio creates a NEW WABA in your BM (doesn't slot into existing) — templates get re-reviewed, display name re-approved. Other BSPs (Gupshup, 360dialog) connect to the existing WABA directly.

**Diagnosing a suspension:** check the number in WhatsApp Manager. If it shows active/healthy there, the BSP (platform) suspended you, not Meta — the number is migratable. If Meta banned the number, no BSP switch fixes it (appeal via Meta Business Support).


---

### Measuring Success

| Metric | Healthy | Warning | Critical |
|---|---|---|---|
| Delivery rate | >95% | 90-95% | <90% |
| Read rate | >70% | 50-70% | <50% |
| Block/report rate | <2% | 2-5% | >5% |
| Quality rating | Green | Yellow | Red (tier downgrade) |
| Open rate | >96% | 90-96% | <90% |
| CTR (link in template) | >15% | 5-15% | <5% |

**Industry benchmarks (2026):**
- Open rate: 96.7-98.2% (well-optimized: ~99%)
- CTR: 15-45% (well-optimized: 25-35%)
- Conversion rate: 5-10% (top performers: up to 18%)
- Delivery rate: 95-99% (well-optimized: 99%+)

**If quality drops to yellow:** stop broadcast, review template content, reduce volume, wait 6h evaluation cycle.
**If quality drops to red:** pause all marketing, switch to utility-only for 7+ days, may need to ramp up tier again.


---

### Quality Rating Recovery Protocol

1. Pause ALL broadcasts immediately
2. Identify and disable poorly performing templates
3. Clean contact list: remove non-engaged, non-opted-in
4. Wait 7 days for quality score recalculation
5. Resume gradually: best templates → most engaged contacts only
6. If quality holds at Green/Yellow for 7 days: status returns to Connected


---

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
