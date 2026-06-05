## 6. Sending Messages at Scale

### Throughput Tiers

| Level | Speed | Upgrade Trigger |
|---|---|---|
| Standard | 80 messages/second (MPS) | Default for all verified numbers |
| Coexistence | 20 MPS | When number also uses WhatsApp Business App |
| High Volume | Up to 1,000 MPS | Automatic when eligible |

**Auto-upgrade to 1,000 MPS requires:**
1. Portfolio messaging tier must be Unlimited
2. Must message 100,000+ unique users in a 24-hour period
3. Quality rating must be Yellow or Green (not Red)

Upgrade is automatic (takes ~1 minute) and triggers a `THROUGHPUT_UPGRADE` webhook event. No cost for higher throughput.

### Messaging Limit Tiers (Daily Unique Users)

**Since October 7, 2025: limits apply per Business Portfolio, not per phone number.**

| Tier | Daily Unique Users | Notes |
|---|---|---|
| 0 (Unverified) | 250 | Before business verification |
| 1 | 2,000 | After business verification (raised from 1,000 on Oct 7, 2025); empirically confirmed in production on a live WABA |
| 2 | 10,000 | First scaling milestone |
| 3 | 100,000 | Established brands |
| 4 | Unlimited | Enterprise |

**Upcoming (Q1-Q2 2026 rollout, not yet universal):** Meta announced removal of the 2K and 10K intermediate tiers for verified businesses. Once fully deployed, business verification would jump a portfolio directly to 100K/day. A verified-BM WABA observed in production (May 2026) was still at 2,000/day — treat as a pending rollout, not a completed change.

**Tier upgrade logic:**
- Meta evaluates every **6 hours** (changed from 24-48h in 2025)
- Upgrade triggered when: at least 50% of current limit used within any 7-day window AND quality rating is **Green or Yellow (not Red)**
- **Standing goal: ALWAYS ramp toward the NEXT tier, but HEALTHILY (quality first, never volume-at-all-costs).** Treat tier advancement as a continuous objective, not a fixed daily volume, yet a HEALTHY ramp: increase at most ~+20-50%/day (no spikes), only to opted-in / engaged audiences, with a proven low-opt-out template, monitoring quality EVERY day. A bigger limit earned by burning quality is worthless (Red blocks the upgrade and cuts the limit anyway). Each tier unlocks at ~50% utilization (unique business-initiated customers) over a rolling 7-day window at Green/Yellow quality, so keep increasing daily volume (within the warming + quality limits) until the next tier triggers, then repeat for the tier after. WhatsApp Manager > Messaging Limits shows a live progress counter toward the next tier (e.g. "183 / 1,000 unique customers in the last 7 days"). Push it every day, but the moment quality drifts toward Red, hold volume, the limit and the quality compound, never trade quality for volume.
- All phone numbers in the same Business Portfolio share **one combined limit** (draws from the same pool — one number consuming capacity reduces what others can use in that 24-hour window)
- **Portfolio risk:** quality issues (high block/report rates) on any number in the portfolio can affect the shared limit for all other numbers
- **IMPORTANT:** New numbers inherit the portfolio tier limit instantly (Oct 2025), but quality rating starts at zero. The inherited limit is the ceiling, NOT the Day-1 target — warm the number regardless.

### Quality Rating System

| Rating | Color | Impact |
|---|---|---|
| High | Green | Full scaling clearance |
| Medium | Yellow | Warning; monitor closely |
| Low | Red | Tier upgrades blocked |

Quality is computed from the last 7 days of user feedback: blocks, spam reports, opt-outs, engagement rates.

**Key change (October 2025):** Red rating no longer triggers automatic tier downgrade (unless accompanied by policy violations). It only blocks advancement. The **Flagged** phone-number status was also fully eliminated in this update — previously, a number with Red quality for 7 days entered a Flagged state that triggered tier downgrade. Under the new system there is no Flagged state: Red quality only blocks advancement and does not reduce an existing tier (absent policy violations).

**Pair Rate Limiting:** Sending too many messages to the same recipient in a short period triggers error 131056. Space out messages to individual users; WhatsApp limits how fast you can message a single number.

### Queue Management for Bulk Sends

```typescript
import PQueue from 'p-queue';

// Respect 80 MPS default throughput
const queue = new PQueue({
  concurrency: 10,
  interval: 1000,
  intervalCap: 80
});

async function sendBulkMessages(recipients: string[], template: TemplateMessage) {
  const results = await Promise.allSettled(
    recipients.map(phone =>
      queue.add(() => sendWhatsAppMessage(phone, template))
    )
  );
  return results;
}
```

### Best Practices for High-Volume Sending

1. **Warm up new numbers:** Start at 50-100 messages/day (internal/warm contacts only), increasing ~20% per day. The Dispatch Infrastructure section has the canonical detailed ramp (50→100→300→500→1,500→2,000). The 500-1,000/day starting volume is too aggressive for a brand-new number and triggers bot-detection signals. Note: inheriting the portfolio tier limit instantly (Oct 2025 change) does NOT eliminate the need to warm — quality rating is per-number and starts at zero.
2. **Test first:** Send to 50-100 internal contacts before full blast
3. **Segment by relevance:** High-relevance sends → lower block rates → quality stays green
4. **Monitor in real-time:** Watch delivery rates, read rates, and opt-out rates during sends
5. **Respect user-level caps:** Meta limits each user to an undisclosed number of marketing messages per day across all businesses (commonly estimated at ~2/day, but Meta does not publish the exact threshold — it is dynamically adjusted). If your message is blocked by this cap, you get error **131049** (not 130472). Error 130472 is a separate mechanism: recipients in Meta's experiment holdout (~1% of users per region, ongoing since 2023) who cannot receive marketing templates unless a 24h CSW is open, a marketing conversation exists, or the user came via CTWA. These are two distinct errors.
6. **Implement exponential backoff:** For 429/rate-limit errors, back off and retry

---

