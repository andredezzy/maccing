# Global Automation Doctrine

This is the canonical, platform-agnostic automation doctrine for the maccing-growth plugin. All platform-specific skills defer to this file for all cross-cutting automation rules (`meta` via `reference/browser-automation.md`; `google-ads` and `tiktok-ads` via `reference/automation.md`; `ycloud` via `reference/api-automation.md`). Read this document in full before executing any automation task. The rules here are normative — they are not suggestions, and deviation requires an explicit documented reason.

---

## 1. Decision Tree: Official-Surface-First

Every automation task must be assigned to the highest rung the task allows. Never use a lower rung when a higher one is available.

```
┌─────────────────────────────────────────────────────────────────┐
│              AUTOMATION SURFACE SELECTION                       │
│                                                                 │
│   Task identified                                               │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────────────────────────────────┐                   │
│  │  Does the platform expose an official   │                   │
│  │  API, Scripts SDK, or native automation │                   │
│  │  surface for this task?                 │                   │
│  └─────────────────────────────────────────┘                   │
│        │                                                        │
│    YES  │                          NO                           │
│        ▼                           │                            │
│  ┌───────────────────┐             │                            │
│  │  RUNG 1           │             ▼                            │
│  │  Official Surface │   ┌──────────────────────────────────┐  │
│  │  API / Scripts /  │   │  Is the task read-only (no real- │  │
│  │  SDK              │   │  world change committed)?        │  │
│  └───────────────────┘   │                                  │  │
│   ↑ Always prefer        └──────────────────────────────────┘  │
│                                    │                            │
│                                YES │              NO            │
│                                    ▼               │            │
│                          ┌──────────────────┐      │            │
│                          │  RUNG 2          │      ▼            │
│                          │  Antidetect      │  ┌───────────┐   │
│                          │  Browser         │  │  RUNG 3   │   │
│                          │  (AdsPower)      │  │  Operator │   │
│                          └──────────────────┘  │  (manual) │   │
│                                                └───────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Rung 1 — Official Surface (API / Scripts / SDK):** Any task that can be completed via the platform's own programmatic interface must use it. This is the fastest, most reliable, and safest rung. Each platform skill names its official surface (e.g., Google Ads Scripts, Meta Marketing API, TikTok Marketing API, BSP REST API).

**Rung 2 — Antidetect Browser (AdsPower):** Used only when no official API or SDK covers the task. An in-browser session is required to access surfaces that are UI-only or that require a hydrated authenticated session. Within this rung, always prefer an in-page `fetch()` via `evaluate-script` over navigated reads (see §5 and §6).

**Rung 3 — Operator (manual):** Any action that commits a real-world change — a send, a publish, a login, a password change, a 2FA confirmation, an account setting submit — must be executed by a human operator. The agent prepares, the operator confirms and fires. There is no exception to this rule.

---

## 2. Antidetect Tooling (Rung 2 Only)

When a task reaches Rung 2, use the official AdsPower tooling. Install it once per project, then rely on it for all browser-rung operations.

**Install the skill:**
```
npx skills add AdsPower/adspower-browser
```

**MCP server:** `local-api-mcp-typescript` — this is the connected `adspower-local-api` MCP available in this environment. All `adspower-local-api` MCP calls in §6 and §7 reference this server.

**CLI:** `ads …` — scriptable automation for profile management and session control.

**Do not re-document the AdsPower API here.** The authoritative API reference is at [localapi-doc-en.adspower.com](https://localapi-doc-en.adspower.com). Defer to it for parameter details, return shapes, and error codes.

---

## 3. Prime Directive: Human-Like, Undetectable

This is the most important section. Every Rung 2 operation must be invisible to platform detection systems. The goal is not to avoid detection by being clever — it is to produce browser behavior that is statistically indistinguishable from an ordinary human user. Treat each of the following as a distinct attack vector with a required countermeasure.

### 3a. `navigator.webdriver` / CDP Hooks

**Vector:** Platforms probe `navigator.webdriver` to detect automated browsers. A truthy value immediately signals a bot.

**Countermeasure:** Rely on the AdsPower antidetect kernel — it is specifically built to suppress `navigator.webdriver` and primary CDP hook signals. Do not attempt to patch this manually; the kernel handles it.

#### Verification

After every `navigate` call, immediately run `evaluate-script` with the following assertion before proceeding:

```javascript
// Must return false. If true, abort — the kernel has regressed.
navigator.webdriver === false
```

If the assertion returns `true` (or is not `false`), **abort the session and surface a warning**: the kernel's `navigator.webdriver` suppression has regressed. Do not proceed with any reads on that profile until the issue is resolved.

**Do NOT check `window.cdc_*`** — those are ChromeDriver-specific artifacts and are irrelevant to AdsPower's kernel. Checking them adds noise and may itself be a fingerprinting signal.

**Residual acknowledged risk:** The AdsPower kernel suppresses `navigator.webdriver` and the primary CDP hook signals. However, suppression of the lower-level `Runtime.enable` attachment-timing signal is **not documented** in AdsPower's published masking list. Treat this as a residual risk on high-scrutiny surfaces (e.g., platforms with active bot-detection investment). Do **not** attempt to probe or test this risk using `debugger`-timing tricks or `outerWidth`-gap checks — those techniques detect a docked DevTools panel, not a WebSocket CDP attachment, and running them actively harms the behavioral fingerprint.

---

### 3b. Request-Sequence Ordering (CRITICAL)

**Vector:** Platforms log outbound request timelines. A page that emits an unusual XHR as the very first outbound call is a strong automation signal — no real user loads a page and immediately fires a programmatic API request before any of the page's own initialization traffic.

**Countermeasure:** After every `navigate`, wait for the page's own initialization XHRs to complete before the agent issues its own fetch. The required sequence is:

1. `navigate` to target URL.
2. Wait until `document.readyState === 'complete'` (poll via `evaluate-script`).
3. Add a randomized jitter delay of **2–4 seconds** (not a fixed sleep — randomize within this window).
4. Only then execute the agent's `fetch()` call.

The agent's call must **never** be the first outbound request after a page load.

---

### 3c. Timing Floors (Minimum, Mandatory)

These are **minimums, not suggestions**. Violating them degrades the behavioral fingerprint and risks detection. No automation script may operate below these floors regardless of time pressure.

| Parameter | Minimum Floor |
|---|---|
| Inter-navigation delay | **4 seconds** between any two `navigate` calls |
| Time-on-page before data read | **3 seconds** after `document.readyState === 'complete'` before executing a fetch |
| Consecutive navigations before idle pause | After **5** consecutive navigations, insert a **30–60 second** idle pause |
| Daily session envelope | No more than **30 minutes** of active browser-session time per profile per day |

Add randomization above these floors — always vary delays randomly between the floor value and approximately 2× the floor. A perfectly uniform inter-navigation delay is itself a tell.

---

### 3d. Behavioral Tells — Scope Qualifier

**This section applies to navigated sessions only.** For the pure in-page `fetch()` recipe (§6), mouse simulation, typing cadence, dwell time, and scroll events are **not needed** — an in-page `fetch()` via `evaluate-script` is executed within the page's own JavaScript context and is indistinguishable from the page's own XHR traffic. There is no DOM interaction to observe.

**Exception:** If a target platform gates its API on `navigator.userActivation.hasBeenActive` (checking that a user has interacted with the page), prepend a synthetic `evaluate-script` that clicks on an inert element (e.g., the page body or a non-functional DOM node) before the fetch. This satisfies the activation gate without introducing meaningful behavioral signal.

For **navigated sessions** (where the agent is genuinely browsing pages rather than just fetching), enable AdsPower's built-in humanization settings (mouse curve, typing cadence, scroll behavior). Defer to the official AdsPower skill for configuration details.

---

### 3e. Message Dispatch — Second Delay Axis

When dispatching messages in a batch (e.g., bulk notification sends, campaign broadcast batches), the inter-send interval must be randomized. A uniform cadence across a broadcast batch is a detectable pattern. Apply per-message jitter — vary delays meaningfully, not just ±50ms.

---

### 3f. TLS Fingerprint (JA3/JA3S)

**Vector:** An external HTTP client (e.g., Node.js `fetch`, `axios`, `curl`, Python `requests`) exposes a non-browser TLS stack. TLS fingerprinting (JA3/JA3S) can identify the client as non-browser automation even when other signals pass.

**Countermeasure:** The in-page `fetch()` mandate in §6 eliminates this entirely. When `fetch()` is executed inside `evaluate-script`, it runs inside the Chrome process and uses Chrome's native TLS stack — indistinguishable from a user-initiated XHR. Never issue authenticated reads from an external HTTP client.

---

### 3g. Headless Mode

Always run with `headless=0` for **any browser session (Rung 2)**. A headless browser exposes additional detection vectors (screen dimensions, font enumeration, GPU fingerprint). This does not apply to Rung 1 (official API/SDK), which uses no browser. Within Rung 2 there is no exception — even for purely programmatic in-page operations.

---

## 4. Keep-Open / No Rapid Cycling

**Never open a browser profile and immediately close it.** Opening a profile, executing a single action, and closing it is an unnatural behavioral pattern and a recognized automation signal. It also destroys the session warming value of a long-lived profile.

**The correct pattern:**
- Prefer connecting to an already-open profile (`get-opened-browser` checks for this).
- If you must start a profile, keep it open and batch all reads into a single contiguous window — aim for under 30 minutes per session.
- Do **not** spread thin automated fetches across a full day as a strategy for appearing more human. Concentrated sessions that look like a person sitting down to work are less suspicious than a steady heartbeat of automated calls.
- Do **not** add synthetic mouse-movement heartbeats or periodic scroll events between reads to "keep the session alive." Periodic mechanical events with inhuman precision are themselves detectable patterns.

**Critical distinction — tab close vs profile close:**

A tab close (`window.close()` called inside `evaluate-script` at the end of a read) is **permitted and correct**. It is not the same as closing the browser profile. The distinction is:

- `window.close()` via `evaluate-script` → closes the specific tab. [OK] Do this at the end of every read.
- `close-browser` MCP call → closes the entire profile session. [DO NOT] **Never call this between reads.** Profile closure is an operator-controlled action, not an automated one.

Between reads in the same session, simply open a new page (`open-new-page`) on the same connected profile.

---

## 5. Two-Axis Hybrid Split

Automation authority is divided along two axes. Understanding which axis an action falls on determines whether the agent may execute it autonomously.

### Axis 1 — Antidetect Profile Management

Actions: creating profiles, assigning proxies, configuring fingerprints, listing profiles, moving profiles between groups.

**Who executes:** Agent (fully autonomous).

**Why:** These operations happen entirely within the local AdsPower installation. The target platform has no visibility into them. There is no behavioral signal to detect.

Use the official `adspower-local-api` MCP or the `ads` CLI for all profile management operations.

### Axis 2 — In-Property Actions on a Platform

Actions that occur inside a platform's authenticated surface (ad dashboards, BSP consoles, campaign managers, messaging platforms).

| Action type | Who executes |
|---|---|
| **Reads** — fetching metrics, pulling campaign data, reading message logs, exporting reports | Agent |
| **Commits** — logins, sending messages, publishing campaigns, submitting forms, 2FA/password operations, account setting changes, bulk actions that trigger delivery | **Operator only** |

**Read method preference — ALWAYS prefer the API over the DOM.** Anything obtainable from an API (the official API/key, or the dashboard's own backend endpoint) is strictly better than reading rendered DOM. An API read is structured, stable, complete (no pagination/virtualization gaps, no truncated UI), and carries far less detection and breakage risk than scraping markup. **If a value is reachable by API, never read it from the DOM.** Ranked order, best first:

1. **Rung 1 — official API / API key** (e.g. `api.ycloud.com/v2` with `X-API-Key`, a platform Marketing API). No browser at all → lowest risk, most stable. Use this whenever the datum exists on the official API.
2. **Rung 2 — backend `fetch()` via `evaluate-script`** against the dashboard's own endpoints (session-cookie auth, same-origin from inside the logged-in profile). Use this for data the official API does not expose but the dashboard UI does — the UI got it from a backend call, so call that endpoint directly. **Discover the endpoint** (watch what the page fetches, or probe a few candidate paths read-only for a `code:0`/SUCCESS response) rather than scraping what it rendered. An in-page fetch also has zero behavioral fingerprint and, with no `navigate`, avoids the request-sequence-ordering risk (see §3b, §3d, §3f).
3. **DOM scrape — LAST resort only.** Read rendered elements only when **no** endpoint exists for the datum at all (neither official API nor a discoverable backend call). It is brittle (markup changes, virtualized/lazy lists, truncation) and higher-risk. When you do fall back to the DOM, document in a code comment WHY no API path was available.

Never reach for the DOM because it is the first thing you tried in the browser — exhaust the API paths (1 then 2) first.

**Agent reads are always operator-initiated.** There is no autonomous scheduling of browser-session reads. Cron jobs, self-triggering loops, and background polling via the browser rung are prohibited. An operator must initiate each read session.

---

## 6. Proven MCP Read Recipe

This is the validated sequence for performing a credentialed in-page data read via the `adspower-local-api` MCP. Follow it exactly. Deviations — even seemingly innocuous ones like skipping `connect-browser-with-ws` — will cause errors.

Use generic placeholders below: `<profile-id>`, `<dashboard-url>`, `<api-endpoint-path>`.

```
Step 1: get-opened-browser
  └─ Input: { id: "<profile-id>" }
  └─ Capture: ws.puppeteer (the WebSocket debugger URL)
  └─ If the profile is not open, surface an explicit error — do not auto-open.

Step 2: connect-browser-with-ws                          ← REQUIRED
  └─ Input: { ws: "<ws.puppeteer string captured in step 1>" }
     (ws.puppeteer is the WebSocket URL string returned by step 1,
      e.g. "ws://127.0.0.1:9222/devtools/browser/…")
  └─ REQUIRED before any evaluate-script call.
     Skipping this step causes "Browser not connected" errors.

Step 2.5: evaluate-script — reuse-in-place check        ← NEW: avoid tab churn
  └─ Script: location.origin
  └─ If it ALREADY equals <dashboard-origin> (the connected page is
     already on the logged-in dashboard — e.g. a read tab still open
     from earlier this session, or the operator is parked there):
     SKIP steps 3–5 + 7, run the fetch (step 8) IN PLACE, and SKIP
     step 9. This is the no-new-tab, no-navigation, no-disruption
     path — PREFER it whenever the connected page is already on the
     dashboard origin. Do NOT window.close() in this case: you did
     not open this tab, it may be the operator's.
  └─ Otherwise (current page is NOT the dashboard origin): fall through
     to step 3 and open your OWN tab.
  └─ ⚠️ The connected page is simply whatever tab was ACTIVE when CDP
     attached — often an UNRELATED site the operator has focused (e.g.
     another platform). A non-dashboard origin here does NOT mean no
     dashboard tab exists; the operator may have one open in ANOTHER
     tab. This MCP cannot enumerate or switch to those other tabs, so
     do not try to "find" them — just open your own tab (step 3). The
     read works regardless (see step 8: it is a backend `fetch()`, not
     a DOM scrape, so it does not need the operator's rendered UI).

Step 3: open-new-page                                    ← only if step 2.5 fell through
  └─ Capture: the new page's tab id
  └─ Creates a blank tab the AGENT owns (cleanly closable in step 9).
     The MCP cannot reliably target the operator's specific existing
     tab, so the agent works in its own tab rather than hijack one.
     This is also why an extra tab may briefly appear during a read —
     it self-closes in step 9.

Step 4: evaluate-script — assert blank tab              ← Safety check
  └─ Script: location.href === 'about:blank'
  └─ If this returns false, ABORT and surface an error.
     Never proceed on a non-blank tab — you would be hijacking
     the operator's active browsing session.

Step 5: navigate
  └─ Input: { url: "<dashboard-url>" }
  └─ This navigates to the target origin. The profile's existing
     authenticated session is profile-wide — no login needed.

Step 6: evaluate-script — assert navigator.webdriver    ← §3a kernel check
  └─ Script: navigator.webdriver === false
  └─ If this returns true (or anything other than false), ABORT
     immediately and surface a warning: the antidetect kernel's
     navigator.webdriver suppression has regressed. Do not
     proceed with any reads on this profile until resolved.

Step 7: Wait for readyState + jitter                     ← §3b/§3c timing requirement
  └─ evaluate-script: document.readyState === 'complete'
     Poll until true (max ~15s, then error).
  └─ Then: randomized 3–6s dwell before proceeding.
     (Satisfies the §3c 3s time-on-page floor and also covers
      the §3b 2–4s post-navigate jitter intent — conservative
      and comfortably above both minima.)

Step 8: evaluate-script — in-page fetch                 ← The actual read
  └─ Script (async IIFE):
     (async () => {
       const response = await fetch('<api-endpoint-path>', {
         credentials: 'include'   // sends the profile's cookies
       });
       return await response.json();
     })()
  └─ evaluate-script both returns values AND awaits Promises.
     This uses Chrome's native TLS stack (see §3f).
  └─ Capture the returned JSON for processing.
  └─ This is a BACKEND `fetch()`, NOT a DOM read — it works in ANY
     logged-in tab on the dashboard origin, even one that rendered
     blank/unhydrated (a freshly-opened background tab often does not
     mount the SPA UI). So PREFER the backend endpoint over scraping
     rendered elements; never block on the page's UI appearing. Probe
     a few candidate endpoint paths (read-only GET/POST with
     credentials) to find the one returning `code:0`/SUCCESS rather
     than guessing blindly or relying on the DOM.

Step 9: window.close()   (ONLY the tab the agent opened in step 3)
  └─ evaluate-script: window.close()
  └─ Closes the AGENT's own tab. Does NOT close the profile.
  └─ SKIP entirely if step 2.5 reused the operator's page — never
     close a tab you did not open.
  └─ Verify it closed: window.close() is silently blocked for contexts
     the script did not open. Agent-opened pages normally close fine,
     but confirm best-effort (a follow-up read should no longer target
     it); if a stray tab lingered, surface a note so the operator can
     close it rather than leaving silent clutter.

--- Additional reads in the same session: if a dashboard read tab is  ---
--- still open, REUSE it (step 2.5 path) instead of opening a new one  ---
--- each time. Do NOT call close-browser between reads.                ---
```

This recipe satisfies:
- §3a (navigator.webdriver check — step 6 aborts if the kernel has regressed)
- §3b (request-sequence ordering — page init XHRs fire during steps 5–7 before the agent fetch in step 8)
- §3c (timing floors — 3–6s dwell in step 7 satisfies the 3s time-on-page floor; also satisfies the §3b 2–4s jitter intent)
- §3d (no behavioral simulation needed — in-page fetch has no DOM interaction)
- §3f (TLS fingerprint — Chrome native TLS used in step 8)
- §4 (tab close, not profile close — step 9 uses `window.close()`, not `close-browser`)

---

## 7. Fallback Ladder

When the primary MCP tooling is unavailable or insufficient, descend the ladder in order. Never skip rungs.

```
Rung A: MCP (interactive)
  └─ adspower-local-api MCP tools
  └─ Fully interactive; supports evaluate-script for in-page fetches
  └─ Preferred for all agent-driven reads

Rung B: CLI (ads …, scriptable)
  └─ The AdsPower CLI (ads command)
  └─ Scriptable; suitable for batch profile management
  └─ Does NOT expose an in-page-fetch or evaluate-script equivalent.
     For in-page reads, fall back to Rung A (MCP) or treat as operator-manual.
  └─ Defer to official AdsPower docs for CLI syntax

Rung C: Raw local API (last resort)
  └─ Direct HTTP calls to the AdsPower local API endpoint
  └─ SCOPE: Profile management only (open, close, list, create, configure)
  └─ CANNOT substitute for a credentialed in-page fetch.
     For dashboard-backend reads, the ladder collapses to Rung A or B —
     raw local API has no evaluate-script equivalent and cannot
     execute JavaScript inside an authenticated page context.
  └─ If neither Rung A nor Rung B is available for a read task,
     the read is operator-manual. Surface an explicit error — never
     silently skip a read that cannot be automated.
```

**All rungs require AdsPower to be running** with a live, open profile session. If AdsPower is not running or the target profile is not open, surface an explicit error and stop. Do not attempt to auto-start AdsPower or auto-open profiles — that is an operator action.

**`headless=0` applies to every browser session (Rung 2).** See §3g.

**Never hand-roll a Playwright `connect_over_cdp` script** as a substitute for the AdsPower MCP tooling. Playwright CDP connections bypass the antidetect kernel's session context and fingerprint management, defeating the purpose of using AdsPower in the first place.

---

## 8. Platform-Specific References

Each platform skill maintains its own platform-specific automation reference that holds:

- The platform's official surface (Rung 1) — API, SDK, or Scripts
- Which tasks require Rung 2 (antidetect browser) and why
- The read/commit split for that platform's specific actions (concrete examples of what is agent-OK vs operator-only)
- Any platform-specific detection risks or timing adjustments beyond the floors in §3c

**These files defer to this global doctrine.** They do not repeat the universal rules — they extend them. When a platform rule conflicts with this document, this document governs unless the platform-specific file explicitly documents a justified exception.

Platform reference locations:
- `skills/growth/meta/meta/reference/browser-automation.md`
- `skills/growth/google-ads/reference/automation.md`
- `skills/growth/tiktok-ads/reference/automation.md`
- `skills/growth/platforms/ycloud/ycloud/reference/api-automation.md`
