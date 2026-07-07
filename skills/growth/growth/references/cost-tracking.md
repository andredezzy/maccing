# Global Cost-Tracking Doctrine

This is the canonical, platform-agnostic cost-tracking doctrine for the maccing-growth plugin. All platform-specific skills (`meta`, `google-ads`, `tiktok-ads`, `ycloud`, and others) and all project state files follow the rules here. Read this document in full before logging any cost event or presenting a spend projection. The rules here are normative — they are not suggestions, and deviation requires an explicit documented reason.

---

## 1. The Ledger Schema

Every spend event is recorded as a single row in a flat append-only cost ledger. The schema has exactly **8 columns**. There is no `total` column — roll-ups compute `SUM(qty × unit)` on demand; storing the product would be a derived, redundant field.

| date  | class     | item            | qty | unit  | cur | balance-after | note                      |
|-------|-----------|-----------------|-----|-------|-----|---------------|---------------------------|
| 06-05 | PER-MSG   | broadcast-day-N | 100 | 0.06  | USD | 4.20          | marketing template        |
| 06-04 | WALLET    | top-up          | 1   | 10.00 | USD | 14.80         | before broadcast          |
| 05-18 | RECURRING | esim-mo         | 1   | XX.XX | BRL | —             | provider                  |
| 05-10 | ONE-TIME  | chip            | 1   | XX.XX | BRL | —             | new number onboarding     |
| 05-09 | WALLET    | ads-topup       | 1   | 50.00 | BRL | 72.50         | google ads credit         |
| 05-08 | ADS       | ads-google      | 1   | 18.00 | BRL | —             | may 1–7 spend             |

**Column semantics:**

- **`date`** — calendar date the event occurred, formatted `MM-DD`. For recurring charges, use the actual billing date.
- **`class`** — one value from the closed 5-class enum in §2.
- **`item`** — a sub-item from that class's open item list (see §2). New items are added as channels onboard — they extend the list but do not add a new class.
- **`qty`** — dimensionless count of units. For a single payment event set `qty=1`; for a message broadcast set `qty` to the number of messages sent.
- **`unit`** — cost per unit in `cur`. Use `0` for zero-cost audit rows (see `WA-SVC-FREE` in §2).
- **`cur`** — `USD` or `BRL`. Never aggregate across currencies. Keep separate ledger columns or separate ledger tables per currency — never sum USD and BRL.
- **`balance-after`** — the wallet or credit balance after this event; see §3 for exact semantics. Use `—` (a literal em-dash character) when no wallet applies.
- **`note`** — free-text context: delivery window, template category, campaign label, member snapshot, or any other relevant detail. Keep it concise.

**Derivable spend:** `spend = qty × unit`. Never add a `total` or `spend` column to the ledger — it is always derivable and storing it invites staleness.

---

## 2. The `class` Enum

The class set is **closed** — exactly five values, listed below. The item lists under each class are **open** — they grow as new channels, providers, or ad platforms onboard, without changing the enum.

### `ONE-TIME`
Single-occurrence setup costs paid once per asset. Record on the date of purchase.

Items: `BM`, `PROFILE`, `DOMAIN`, `CHIP`, `CARD`

Use `balance-after = —` for all one-time rows (no recurring wallet is drawn from).

---

### `RECURRING`
Subscription or billing-period charges. Record **once per billing period** using the actual billing date as `date`. A row counts within the MTD (month-to-date) window of its `date` field — if the billing date falls on the 28th, the row appears in that month's MTD, not the next. Seed existing subscriptions using their real billing date so historical months are accurate.

Items: `PROXY`, `ESIM`, `BSP`, `DOMAIN-RENEW`

Use `balance-after = —` unless the charge draws from a tracked USD or BRL wallet.

---

### `PER-MSG`
Per-message charges from the BSP or messaging platform. Each broadcast or messaging event produces one row. `qty` = number of messages sent in that event; `unit` = per-message rate.

Items: `WA-MKT`, `WA-UTL`, `WA-AUTH`, `WA-SVC-FREE`

**`WA-SVC-FREE` rows are zero-cost audit records.** Set `unit = 0`. These rows are send-event audit entries — the delivery happened, cost was $0 (free service window), but the event must still be recorded for CPDM denominators and delivery tracking. The CPDM denominator comes from the dashboard's delivered count, **not** from `SUM(qty)` across ledger rows.

---

### `WALLET`
Cash movements into a tracked wallet or credit balance.

Items:
- `TOP-UP` — a USD wallet credit (e.g., BSP balance). `cur = USD`. `balance-after` = new USD wallet balance after the top-up lands.
- `ADS-TOPUP` — a Google Ads credit top-up. `cur = BRL`. `balance-after` = new BRL ad-account credit balance after the top-up is confirmed. Query the live credit balance via Ads Scripts or the Google Ads API at record time — **never copy a stale ledger value** as the new `balance-after`.

---

### `ADS`
Periodic ad spend on a paid channel. Record one row per period (daily, weekly, or per-flight — choose a cadence and keep it consistent). Set `qty = 1` and `unit = <actual-spend>` so that `SUM(qty × unit)` equals exact spend even when actual spend diverges from a prorated budget (e.g., paused days, delivery shortfall, over-delivery).

Items: `ADS-GOOGLE`, `ADS-META`, `ADS-TIKTOK`

An `ADS` row **may** hold the remaining ad-account credit in `balance-after` only if the live value is readable at record time via the official API or Scripts surface. If it is not immediately readable, use `—` and do not estimate.

---

## 3. `balance-after` Semantics

`balance-after` tracks the wallet or credit balance at the moment of the event. The rules by class:

| Class       | `balance-after` meaning                                                                                                                                    |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `WALLET`    | Wallet balance immediately after this event. `TOP-UP` rows → USD wallet balance; `ADS-TOPUP` rows → BRL ad-account credit balance, queried live from the API at record time. |
| `PER-MSG`   | USD wallet balance after this deduction. Derived from the previous balance minus spend.                                                                    |
| `ADS`       | BRL ad-account credit remaining IF readable from the API at record time; else `—`.                                                                         |
| `ONE-TIME`  | Always `—`. No recurring wallet is drawn from.                                                                                                             |
| `RECURRING` | Always `—` unless the charge draws from a tracked wallet.                                                                                                  |

**USD and BRL are never linked.** A USD `balance-after` on a `PER-MSG` row and a BRL `balance-after` on an `ADS-TOPUP` row are independent balance columns for independent wallets. Never derive one from the other.

---

## 4. Append-Only + Correction Rule

The ledger is **append-only by default**, with one explicit exception:

**If a committed row contains an error** (wrong `unit`, wrong `qty`, wrong `date`, wrong `balance-after`), **edit it in place** and commit the correction. Git history is the audit trail — the original erroneous value is preserved in history, and the correction is visible as a diff. Do **not** add reversal rows, zero-out rows, or "correction" rows. A ledger with correction rows is harder to roll up correctly and creates ambiguity about which row represents truth.

This rule applies to all ledger files in all project states. The only legitimate case for a new row is a new real-world event.

---

## 5. Iron Laws: Present-Before / Record-After

These rules govern the agent's behavior around every spend-committing action. There is no exception.

### Law 1 — Present Before Any Spend-Committing Action

Before executing or facilitating any of the following:

- A broadcast send (any channel, any template category)
- A wallet top-up (USD BSP wallet or BRL ad-account credit)
- A one-time purchase (BM, PROXY, ESIM, DOMAIN, CHIP, CARD)
- **Any spend-committing ad budget change** — creating a campaign or ad group, increasing a budget, extending a flight date, or reactivating a paused campaign or ad group

The agent **must present** all of the following in a single pre-action block before the operator takes any action:

1. **Projected cost** — `qty × unit` expressed as `<qty> × <unit> <cur> = <total>`. If `qty` is variable (e.g., broadcast list not yet finalized), state the estimate and its basis.
2. **Source wallet or budget** — which wallet or ad-account credit this draws from, and its current balance (queried live for ADS top-ups via Google Ads Scripts/API; use the latest ledger row for BSP wallet).
3. **Projected `balance-after`** — what the balance will be after the event, derived from current balance minus projected cost.
4. **Cost-per-outcome:**
   - **CPDM always** — projected CPDM = projected spend ÷ expected delivered count (use recent CPDM as baseline).
   - **Cost-per-join when member snapshots exist** — if before/after member count is trackable, surface the current member count and the implied cost-per-join at expected conversion.
   - **For ADS budget raises specifically** — also surface: prior-period CPA (cost per acquisition), whether dayparting is currently set (yes/no), and current ROAS if available.
5. **At least one cheaper alternative when one exists:**
   - Utility vs marketing template category (utility is cheaper per message; use it when the message qualifies).
   - CSW (Click-to-Scan-QR) or CTWA (Click-to-WhatsApp) free-window routes that could reduce PER-MSG cost.
   - MM Lite (Meta-managed messaging) if applicable and available on the BSP plan.
   - Trimming cold-number percentage from the list to cut dead-number waste (dead numbers cost the same per message but deliver zero value).
   - For ADS raises: dayparting to concentrate budget in high-conversion windows; geo trimming to remove low-ROAS regions.

**For a Google Ads top-up specifically:** query the live BRL credit balance via Ads Scripts or the Google Ads API before presenting. Never use a stale ledger `balance-after` value — ad spend debits the balance continuously and the ledger lags.

### Law 2 — The Operator Commits the Spend

The agent presents; the operator acts. The agent does **not** execute any spend-committing action: it does not send broadcasts, does not click "Top Up", does not submit campaign budget changes, does not purchase assets. Every spend-committing action is operator-executed. There is no exception to this rule (see also the Automation Doctrine's Rung 3 rule).

### Law 3 — Record Immediately After Confirmation, Then Re-Derive the Summary

After the operator confirms the action occurred (via screenshot, "sent", "topped up", "done", or equivalent signal), the agent does the following **in the same turn**:

1. **Write the ledger row immediately.** Use the wallet delta for `unit` and compute `balance-after` from the confirmed event. Delivery context, template category, campaign label, and member snapshot (if available) go in `note`.
2. **Re-derive and rewrite the root `## Cost Summary`** from all leaf ledgers. The Cost Summary is always a derived view — it is never hand-edited or copy-pasted. See §7 for the Cost Summary convention.

**CPDM does not block the row write.** Campaign delivery statistics (delivered count) lag hours behind a send event. CPDM refreshes on the next dashboard read and does not hold up the row write. Write the row with the spend data; update CPDM when delivery stats are available.

### Law 4 — No Permission Gate

The agent must **never** insert a `y/n` permission prompt between presenting the pre-action block and waiting for the operator to act. Present the full block, then wait. The operator's action is the permission. A `y/n` gate adds friction without adding safety — the operator has already seen all the relevant information in the presentation block.

---

## 6. Metrics and Optimization

### CPDM — Cost Per Delivered Message

**Fully automated** once delivery data is available.

```
CPDM = total_wallet_spend_in_period ÷ delivered_count_from_dashboard
```

- `total_wallet_spend_in_period` — `SUM(qty × unit)` for `PER-MSG` rows in the period (per currency).
- `delivered_count_from_dashboard` — the delivered count read from the BSP health dashboard. This is the authoritative denominator. **Do not use `SUM(qty)` from the ledger** — ledger qty counts messages sent (including undelivered); the dashboard count is confirmed delivered.
- CPDM is computed per currency. USD CPDM and BRL CPDM are separate metrics; they are never averaged or summed.

CPDM refreshes on each dashboard read. It does not update in real time.

### Cost-Per-Join

**Manual — not API-derivable.**

The platform does not report URL-button taps or group join events back to the BSP or any automation surface. Join counts must be measured by the operator by recording the member count before and after the broadcast. The operator records these snapshots in the relevant broadcast row's `note` field:

```
note: "marketing template | members_before=420 | members_after=437"
```

Once both snapshots are in `note`, cost-per-join is computable:

```
cost-per-join = spend_for_that_broadcast ÷ (members_after − members_before)
```

The agent derives this value from the note fields when asked. If only one snapshot is present, cost-per-join cannot yet be computed — surface this clearly rather than estimating.

### Per-Channel Optimization Lever Checklist

When reviewing spend efficiency or preparing a pre-action presentation, run through the relevant checklist for the active channel:

**WhatsApp / BSP**
- Template category: utility vs marketing — utility costs less per message; use it whenever the content qualifies (transactional, account-related, or service-context messages).
- CSW (Click-to-Scan-QR) and CTWA (Click-to-WhatsApp) free windows — messages initiated within a 24-hour free window cost $0; route eligible conversations through these entry points.
- MM Lite (Meta-managed messaging) — lower effective cost for marketing messages on qualifying BSP plans; verify eligibility before the next broadcast.
- Volume tiers — higher monthly volume often unlocks lower per-message unit costs; project when the next tier break is reached.
- List quality — dead numbers (disconnected, never-delivered) consume spend with zero delivery value. Trimming them from the list before a broadcast directly reduces waste. Surface the estimated cold-number percentage when it is known.
- Opt-out reduction — high opt-out rates on marketing templates can trigger Meta quality rating downgrades, which restrict template usage. Monitor opt-out rate; consider message frequency, timing, and relevance.

**Paid Ads (Google, Meta, TikTok)**
- Target CPA / Target ROAS bidding — automated bidding strategies with explicit targets outperform manual CPC when there is sufficient conversion history (≥30 conversions in 30 days per campaign).
- Dayparting — concentrate budget in high-conversion hours; pause or reduce bids during low-conversion windows. Always check whether dayparting is active before recommending a budget increase.
- Geo trimming — remove or reduce bids for regions with below-average ROAS. Surface a geo breakdown when CPA data is available.
- Pause low-ROAS placements, ad sets, or ad groups — budget allocated to confirmed low-performers should be reallocated to confirmed high-performers before any overall budget increase.

**Infrastructure**
- Right-size proxy and eSIM plans — audit monthly usage against plan limits; downgrade over-provisioned plans before the next billing date.
- Rotate cheap TLDs — `.com.br`, `.net`, `.info` have significantly different renewal costs; use cheaper TLDs where brand requirements allow.
- One card per BM — consolidate payment methods to the minimum necessary to avoid redundant card fees and simplify reconciliation.

---

## 7. Root `## Cost Summary` Convention

Every project state file that contains a cost ledger must also contain a `## Cost Summary` section. This section is **derived** — it is always rewritten by the agent from the leaf ledger rows; it is never hand-edited and never copy-pasted from a previous period.

### Structure

The Cost Summary contains:

1. **Per-account subtotals** — one row per `(account × currency)` pair. If there are two accounts (e.g., a BSP account and a Google Ads account), each gets its own subtotal line.
2. **USD and BRL are always on separate lines** — they are never summed, never converted, never averaged. The Cost Summary must make the currency split visually unambiguous.
3. **MTD definition** — MTD = the calendar month that contains `today`. Rows with a `date` in prior months do not contribute to the MTD subtotal unless the summary explicitly labels them as an all-time or prior-period figure.
4. **CPDM line** — one CPDM line per currency. Computed as `SUM(PER-MSG qty × unit for MTD) ÷ delivered_count_from_latest_dashboard_read`.

### Example format (synthetic values)

```markdown
## Cost Summary

_Last updated: 06-05. MTD = June. Delivered count from dashboard read 06-05._

| account        | class        | MTD spend | cur |
|----------------|--------------|-----------|-----|
| <account-A>    | PER-MSG      | 6.00      | USD |
| <account-A>    | WALLET top-up| 10.00     | USD |
| <account-B>    | ADS-GOOGLE   | 36.00     | BRL |
| <account-B>    | ADS-TOPUP    | 50.00     | BRL |

USD wallet balance-after (latest): 4.20
BRL ad-account credit (latest): 72.50

CPDM (USD, June): 6.00 ÷ 95 delivered = 0.063 USD/msg
CPDM (BRL): — (no BRL messaging spend this month)
```

### When to rewrite

The Cost Summary is rewritten **every time a leaf ledger row is appended**, in the same turn, immediately after the row write (Law 3, §5). It is also rewritten after any dashboard read that updates the delivered count used in CPDM. The summary is never allowed to lag the ledger by more than one turn.

---

## 8. Platform-Specific References

Each platform skill may maintain a `cost-tracking.md` in its own `reference/` directory. These files:

- Define the specific items list for that platform's class rows (e.g., Google Ads items, Meta items).
- Document the live balance query method (e.g., the Ads Scripts snippet for querying BRL credit balance).
- Hold the platform's CPDM or CPA benchmarks for pre-action presentations.
- Note any platform-specific billing quirks (credit expiry, proration, currency conversion on invoice).

**These files defer to this global doctrine.** They do not repeat the universal rules — they extend them. When a platform rule conflicts with this document, this document governs unless the platform-specific file explicitly documents a justified exception.

Platform reference locations (extend as new channels onboard):
- `skills/growth/google-ads/reference/cost-tracking.md`
- `skills/growth/meta/reference/cost-tracking.md`
- `skills/growth/tiktok-ads/reference/cost-tracking.md`
- `skills/growth/ycloud/reference/cost-tracking.md`
