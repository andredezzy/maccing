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

### Authentication Errors

| Code | Meaning | Fix |
|---|---|---|
| 0 | Auth exception | Generate new access token |
| 3 | API method / capability | Verify permissions |
| 10 | Permission denied | Check token permissions; re-add phone to allowlist |
| 190 | Access token expired | Generate new system user token |

### Rate Limiting Errors

| Code | Meaning | Fix |
|---|---|---|
| 4 | Too many calls (200/hr default) | Throttle requests |
| 130429 | Throughput limit hit (80 MPS) | Reduce sending speed |
| 131048 | Spam rate limit | Improve content quality |
| 131056 | Pair rate limit (too many to same recipient) | Space out messages to one recipient |
| 133016 | Register/deregister rate limit (10 per 72h) | Wait 72 hours |

### Message Delivery Errors

| Code | Meaning | Fix |
|---|---|---|
| 131021 | Recipient cannot be sender | Use separate test number |
| 131026 | Message undeliverable | **4 possible causes (Meta does not identify which):** (1) Number not registered on WhatsApp; (2) Recipient has not accepted the latest WhatsApp ToS/Privacy Policy; (3) Recipient is using an outdated WhatsApp client; (4) Sending an authentication template to a +91 India number (not supported). Remove from list; do not retry. |
| 131047 | Re-engagement message: free-form (non-template) send attempted outside the 24h customer-service window | Use an approved template instead (templates are allowed any time; only free-form text is gated by the 24h window) |
| 131049 | Per-user marketing frequency cap (also: US number marketing block since April 2025) | Recipient has hit Meta's per-user daily marketing cap across all businesses. Do NOT retry immediately — wait at least 24h. **Also** returned for ALL marketing template sends to US (+1) numbers since April 1, 2025 (permanent pause, still in effect mid-2026). Switch to utility template (exempt from cap) or wait 24h and retry. |
| 131051 | Unsupported message type | Check API docs for supported types |
| 131052 | Media download error | Verify media URL/ID accessibility |
| 131053 | Media upload error | Check format, size, configuration |
| 130472 | Experiment holdout (~1% of users per region, since June 2023) | Marketing template blocked for experiment participants. Not billed. Do not retry directly. Exceptions where delivery IS allowed even for experiment participants: (1) user messaged your business in last 24h (CSW open), (2) active marketing conversation ongoing, (3) user arrived via CTWA/free-entry-point ad. Affects marketing templates only. |

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
| 130497 | Business account restricted from messaging users in this country | **Brazil (+55) and Indonesia (+62): permanently restricted for foreign-number senders since September 2025 — the tier scaling path does NOT help here; use a locally-registered number.** For other markets, two causes: (1) Cross-border restriction — your WABA number's registered country does not match the recipient's; may clear by completing the messaging tier scaling path (up to 30 days); (2) Restricted content — sending prohibited goods/services to a country where they're not allowed. Fix: a locally-registered number for the target market, or review the WhatsApp Commerce Policy. |
| 133005 | 2FA PIN mismatch | Verify PIN; reset via WhatsApp Manager |
| 133010 | Phone not registered | Complete registration |
| 1005 | Number on deprecated on-premises API | Migrate to Cloud API (on-prem API shut down October 23, 2025) |
| 131000 | Unknown error (something went wrong) | Transient server-side error. Retryable — implement exponential backoff. If persists >5 minutes, check Meta status page. |
| 131005 | Permission denied | Token missing required permission (`whatsapp_business_messaging` or `whatsapp_business_management`). Re-generate token with correct permissions. |
| 131008 | Required parameter missing | API request is missing a required field. Fix the request payload. Not retryable. |
| 131009 | Invalid parameter value | A parameter value does not meet requirements. Fix the request payload. Not retryable. |
| 131016 | Service temporarily unavailable | Transient. Retryable with exponential backoff. Check Meta status page if persistent. |

### Delivery / Send Errors (common in broadcasts)

| Code | Meaning | Interpretation / Fix |
|---|---|---|
| 131026 | Message undeliverable | Recipient can't receive: number not on WhatsApp, hasn't accepted WhatsApp ToS, or invalid. LIST-QUALITY signal — a BSP upload marking a row "valid" checks FORMAT only, NOT WhatsApp-registration. Remove these numbers; do not retry. |
| 131049 | "Not delivered to maintain healthy ecosystem engagement" | Meta's marketing-message throttle / per-user frequency cap. Common on NEW numbers (low trust) and recipients with marketing fatigue. NOT a block/report and NOT a hard penalty — it eases as the number's quality/engagement builds. Mitigate with high engagement (warm contacts) + slow ramp, not by resending. |

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
        const nonRetryable = [131021, 131026, 130472, 130497, 132001, 132007, 132016, 133010, 368, 131031];
        // Delayed retryable (after 24h+): [131049]
        // Transient retryable (immediate backoff): [131000, 131016, 2]
        if (nonRetryable.includes(error.code)) {
          throw error;
        }

        // Rate limit: exponential backoff
        if ([4, 130429, 131048, 131056].includes(error.code)) {
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

