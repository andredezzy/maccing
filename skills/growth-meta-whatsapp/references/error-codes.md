## Contents

- [Authentication Errors](#authentication-errors)
- [Rate Limiting Errors](#rate-limiting-errors)
- [Message Delivery Errors](#message-delivery-errors)
- [Template Errors](#template-errors)
- [Flow Errors](#flow-errors)
- [Account Errors](#account-errors)
- [Delivery / Send Errors (broadcasts)](#delivery--send-errors-common-in-broadcasts)
- [Retry Strategy](#retry-strategy)

## 11. Error Codes Reference

> This table is a curated subset — the ones you actually hit running broadcasts. Meta's full list is at [Error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes); check it before treating an unlisted code as unknown.

**Error response shape.** Build handling around `error.code` and `error.error_data.details`. Do **not** branch on `error_subcode`: it is deprecated and is not returned in v16.0+ responses. Do not branch on the code *title* either — titles live inside `message` and Meta plans to deprecate them. Errors arrive synchronously as a Graph API response, asynchronously in a **messages** webhook (`entry.changes.value.errors` or `entry.changes.value.messages.errors`), or both — subscribe to `messages` or you will miss the async half.

```json
{
  "error": {
    "message": "(#130429) Rate limit hit",
    "type": "OAuthException",
    "code": 130429,
    "error_data": { "messaging_product": "whatsapp", "details": "Cloud API message throughput has been reached." },
    "fbtrace_id": "Az8or2yhqkZfEZ-_4Qn_Bam"
  }
}
```

### Authentication Errors

| Code | Meaning | Fix |
|---|---|---|
| 0 | Auth exception | Generate new access token |
| 3 | API method / capability | Verify permissions |
| 10 | Permission denied | Check token permissions; re-add phone to allowlist |
| 190 | Access token expired | Generate new system user token |
| 200 | No access token provided | Distinct from 190 (expired/invalid). Some GET endpoints (e.g. `whatsapp_business_profile`) return this with "Provide valid app ID" when the token is missing entirely. Add the token. |

### Rate Limiting Errors

| Code | Meaning | Fix |
|---|---|---|
| 4 | Too many calls (200/hr default) | Throttle requests |
| 130429 | Throughput limit hit (80 MPS) | Reduce sending speed |
| 131048 | Spam rate limit | Improve content quality |
| 131056 | Pair rate limit (too many to same recipient) | Space out messages to one recipient |
| 133016 | Register/deregister rate limit (10 per 72h) | Wait 72 hours |
| 80007 | WABA rate limit reached | The WhatsApp Business Account — not the app — hit its rate limit. Slow down or retry later. |
| 131064 | Messaging limit reached from **template classification violations** | Account-level restriction because templates were mis-categorized (applies to template *and* direct sends). Not fixed by retrying: review and correct template categories. Lifts automatically at the end of the enforcement period. |

### Message Delivery Errors

| Code | Meaning | Fix |
|---|---|---|
| 131021 | Recipient cannot be sender | Use separate test number |
| 131026 | Message undeliverable | **4 possible causes (Meta does not identify which):** (1) Number not registered on WhatsApp; (2) Recipient has not accepted the latest WhatsApp ToS/Privacy Policy; (3) Recipient is using an outdated WhatsApp client; (4) Sending an authentication template to a +91 India number (not supported). Remove from list; do not retry. |
| 131047 | Re-engagement message: free-form (non-template) send attempted outside the 24h customer-service window | Use an approved template instead (templates are allowed any time; only free-form text is gated by the 24h window) |
| 131049 | Per-user marketing limit — also the blanket US-number marketing block | **Adaptive**, not a fixed daily quota: Meta throttles per recipient based on their recent marketing read rate and how full their inbox already is, so the ceiling moves per user. Wait at least 24h before resending; retrying sooner triggers a *separate* enforcement that can suppress delivery to that user for another 24h and skews your delivery reporting. Marketing sent inside an open 24h customer service window does not count toward the limit. Not currently active for business numbers or recipients in the EEA, UK, Japan, or South Korea. **US (+1) numbers:** Meta "does not currently deliver marketing template messages" to them at all — no announced end date, and Meta has never called it permanent, so do not write it off forever. (Rollout was April 1, 2025 per BSP notices at the time; Meta's current reference page states no date.) Utility and authentication templates and 24h service-window replies are unaffected — switch category or route US traffic elsewhere. |
| 131051 | Unsupported message type | Check API docs for supported types |
| 131052 | Media download error | Verify media URL/ID accessibility |
| 131053 | Media upload error | Check format, size, configuration |
| 130472 | Experiment holdout (~1% of users per region, since June 2023) | Marketing template blocked for experiment participants. Not billed. Do not retry directly. Exceptions where delivery IS allowed even for experiment participants: (1) user messaged your business in last 24h (CSW open), (2) active marketing conversation ongoing, (3) user arrived via CTWA/free-entry-point ad. Affects marketing templates only. |
| 130403 | **Your business has blocked this user** | You blocked them via the Block Users API. Do NOT retry — every send fails until you unblock. Distinct from the user blocking you (which surfaces as quality damage, not a code). |
| 131050 | **Recipient opted out of marketing messages from you** | The user chose to stop receiving marketing from your business. Do NOT retry — the message will never be received. Suppress them for marketing until the `user_preferences` webhook reports a resume; that webhook (category `marketing_messages`) is the only signal Meta gives for stops and resumes, and without it you discover opt-outs as send failures. Never lift on a timer. Category-scoped: utility and authentication are unaffected. **Keep this flag in a different field from a keyword STOP the user typed at you** — a platform resume must only clear the platform suppression, never someone's explicit STOP to your business. See `compliance.md` for the opt-out handling rules. |
| 131063 | Marketing templates disabled for your Cloud API configuration | The WABA has `disable_marketing_messages_on_cloud_api` set to `true`. Either send via the Marketing Messages API, or flip the flag back to `false`. Not a recipient problem. |
| 131045 | Phone number registration error | The sending business phone number is not properly registered. Register it and retry. |
| 131037 | 555 test number has no approved display name | Only affects Embedded Signup 555 numbers. Set an approved display name. |

### Template Errors

| Code | Meaning | Fix |
|---|---|---|
| 132000 | Parameter count mismatch | Verify param count matches template |
| 132001 | Template not found | Check name, language, approval status |
| 132005 | Hydrated text too long | Shorten variables |
| 132007 | Policy violation | Review and revise template content |
| 132012 | Parameter format mismatch | Verify format matches template specs |
| 132015 | Template paused (low quality) | Auto-resumes after 3h (1st pause) or 6h (2nd pause). Stop active campaigns immediately. After auto-resume, evaluate content/targeting. A 3rd trigger moves template to DISABLED (132016). Can also appear when portfolio pacing drops remaining messages mid-campaign. |
| 132016 | Template disabled (repeated low quality) | Edit template content and resubmit for review (status returns to In Review; if approved, restored to Active). Creating a new template is an option but not required. |
| 2388019 | Template limit exceeded | A WABA can hold up to 250 templates. Delete unused ones before creating more. |
| 2388040 | Character limit exceeded on a template field | The error message names the field and its limit. Shorten it. |
| 2388039 | Template status cannot be changed | You tried to edit a template that is still in review. Wait for approve/reject; note templates also have a daily edit cap. |

### Flow Errors

| Code | Meaning | Fix |
|---|---|---|
| 132068 | Flow blocked | Fix missing inputs or logic errors |
| 132069 | Flow throttled (10 msg/hr) | Improve endpoint health and nav metrics |

### Account Errors

| Code | Meaning | Fix |
|---|---|---|
| 368 | WABA policy violation (account restricted/disabled) | The WhatsApp Business Account has been restricted or disabled for violating Messaging, Commerce, or ToS policy. Can be temporary (1-30 days) or indefinite. Not retryable. Appeal via Business Support Home → select violation → Request Review. Common causes: spam reports, restricted content, excessive blocks. Distinct from 131031 (number-level lock). |
| 131031 | Account locked | Two distinct causes: (1) Policy violation — WABA restricted/disabled. Appeal via Business Support Home. (2) 2FA PIN mismatch — Meta cannot verify the two-step PIN in the request. Fix: disable 2FA on the number, re-register, re-enable 2FA. Check the WhatsApp Manager healthcheck for diagnostic detail. |
| 131042 | Business eligibility / payment issue | One of: (1) payment account not linked to WABA; (2) credit limit exceeded; (3) credit line inactive; (4) WABA suspended/deleted; (5) timezone/currency settings missing or wrong; (6) pending MessagingFor request. Fix: check each condition in WhatsApp Manager billing settings. |
| 130497 | Business account restricted from messaging users in this country | **Brazil (+55) and Indonesia (+62) cross-border block, effective September 15, 2025.** It cuts *both* ways: a foreign-registered number cannot message BR/ID users, **and** a BR/ID-registered number cannot message users outside its own country. Same-country traffic (BR→BR) and inbound messages are unaffected. The tier scaling path does NOT clear it — use a number registered in the target market. *Unverified:* BSP notices call this a **temporary** safeguard with no published end date, and I could not find a Meta-hosted page documenting it at all, so treat both its permanence and its exact scope as unconfirmed. For other markets, two causes: (1) Cross-border restriction — your WABA number's registered country does not match the recipient's; may clear by completing the messaging tier scaling path (up to 30 days); (2) Restricted content — sending prohibited goods/services to a country where they're not allowed. Fix: a locally-registered number for the target market, or review the WhatsApp Commerce Policy. |
| 133005 | 2FA PIN mismatch | Verify PIN; reset via WhatsApp Manager |
| 133010 | Phone not registered | Complete registration |
| 1005 | Number on deprecated on-premises API | Migrate to Cloud API (on-prem API shut down October 23, 2025) |
| 131000 | Unknown error (something went wrong) | Transient server-side error. Retryable — implement exponential backoff. If persists >5 minutes, check Meta status page. |
| 131005 | Permission denied | Token missing required permission (`whatsapp_business_messaging` or `whatsapp_business_management`). Re-generate token with correct permissions. |
| 131008 | Required parameter missing | API request is missing a required field. Fix the request payload. Not retryable. |
| 131009 | Invalid parameter value | A parameter value does not meet requirements. Fix the request payload. Not retryable. |
| 131016 | Service temporarily unavailable | Transient. Retryable with exponential backoff. Check Meta status page if persistent. |
| 33 | Business phone number has been deleted | Verify the phone number ID. Not retryable. |
| 100 | Unsupported or misspelled parameter | The request carries a parameter the endpoint does not accept, or a value over a length limit. Fix the payload. Not retryable. |
| 131057 | Account in maintenance mode | Often a throughput upgrade in progress. Transient — retry with backoff. |
| 133004 | Server temporarily unavailable | Transient. Check the WhatsApp Business Platform status page, then retry with backoff. |
| 133015 | Number recently deleted, deletion still completing | Wait 5 minutes and retry the request. |
| 134011 | WhatsApp Payments ToS not accepted | Accept the terms via the link in the error message. Blocks payment-flow sends only. |
| 135000 | Unknown request-parameter error | Generic malformed-request catch-all. Re-check the endpoint reference; contact support if it persists. |
| 2494100 | Business phone number in maintenance mode | Try again in a few minutes. |

### Delivery / Send Errors (common in broadcasts)

| Code | Meaning | Interpretation / Fix |
|---|---|---|
| 131026 | Message undeliverable | Recipient can't receive: number not on WhatsApp, hasn't accepted WhatsApp ToS, or invalid. LIST-QUALITY signal — a BSP upload marking a row "valid" checks FORMAT only, NOT WhatsApp-registration. Remove these numbers; do not retry. |
| 131049 | "Not delivered to maintain healthy ecosystem engagement" | Same code as above, seen at broadcast scale. NOT a block/report and NOT a hard penalty on your number. Note the documented mechanism is **recipient-side** — Meta sets the ceiling from that user's recent marketing read rate and inbox load, not from your number's trust score — so the field observation that "it eases as the number warms up" is better explained by the list getting warmer and better targeted than by the number itself earning headroom against this cap. Either way the fix is the same: high-engagement contacts and a slow ramp, never resending inside 24h (which trips the excessive-retry enforcement). |

**Real-world broadcast baselines** (illustrative, directional):
- An AGED / demo list: a large share fails with 131026 ("not on WhatsApp") plus some 131049 throttle, so delivery lands well below a fresh list and read rates are weaker.
- A FRESH list of RECENT signups (registered hours/days before): the 131026 "not on WhatsApp" failures essentially vanish, delivery jumps well above the aged list, and only mild 131049 throttle remains.
- **LESSON — list FRESHNESS dominates deliverability:** recently-registered leads (fresh, active numbers) deliver far better than an aged/demo list (the 131026 "not on WhatsApp" failures vanish). And the 131049 throttle eases as the number earns trust (Green). A renewable stream of recent signups is the best warming/nurture pool when you lack internal seeds — and the prospecting "welcome" template fits them (vs established customers, where it mismatches + risks alarming your best relationships).
- **Opt-out via the Quick-Reply button is HEALTHY and DISTINCT from blocks/reports.** A "Parar mensagens" / "Stop" button diverts annoyed recipients into a clean unsubscribe (auto-removed, compliant) instead of a block/report. So a 10-12% button-opt-out is NOT the same as the block-rate thresholds (<0.5% healthy / >2% red), which track blocks+reports and drive quality. Always include an opt-out Quick Reply — it protects the number. Watch button-opt-out as a soft audience-fit signal (climbing → message/audience mismatch), but it doesn't tank quality the way blocks do.
- Inbound replies open a 24h free-form session window = the best warm conversion path. URL-CTA button clicks are NOT reliably reported by BSP analytics — measure conversion at the destination (e.g. WhatsApp group member count), not the BSP click metric.

### Retry Strategy

```typescript
async function sendWithRetry(
  payload: object,
  maxAttempts = 3
): Promise<{ id: string }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendMessage(payload);
    } catch (error) {
      if (error instanceof WhatsAppError) {
        // Non-retryable errors
        const nonRetryable = [
          131021, 131026, 130403, 131050, 130472, 130497, 131063,
          132001, 132007, 132016, 133010, 368, 131031, 131008, 131009, 33, 100
        ];
        // Delayed retryable (after 24h+): [131049]
        // Enforcement-period wait, not a resend: [131064]
        // Transient retryable (immediate backoff): [131000, 131016, 131057, 133004, 2494100, 2]
        if (nonRetryable.includes(error.code)) {
          throw error;
        }

        // Rate limit: exponential backoff
        if ([4, 80007, 130429, 131048, 131056].includes(error.code)) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Max retry attempts reached');
}
```

---

