## Contents

1. [The Three-Tool Read-Only Automation Concept](#the-three-tool-read-only-automation-concept)
2. [Access method (MANDATORY): run from inside the disposable BM's AdsPower profile](#access-method-mandatory)
3. [Automation loop (closes the template A/B decision)](#automation-loop)

---

## The Three-Tool Read-Only Automation Concept

YCloud exposes two distinct API surfaces:

1. **Public REST API** (`api.ycloud.com/v2`, `X-API-Key` auth) — for per-message status, template
   approval, phone quality, wallet balance. Real-time for `sendDirectly` API sends; campaign messages
   appear with HOURS of lag (see console-and-operations.md for the full lag gotcha).

2. **Dashboard backend API** (`www.ycloud.com/api/...`, SESSION cookie auth) — for per-campaign
   analytics, per-button opt-out counts (`buttons[].count`), and campaign-level `unsubscribeNums`.
   This surface is undocumented and only reachable from inside a logged-in browser session.

3. **Campaign UI Analytics/Logs tab** — the human-readable view of the same dashboard backend data.
   Use this for real-time campaign monitoring when the public API is lagging.

The read-only automation pattern combines tools 1 and 2 (monitor + evaluate) to make decisions that
the agent REPORTS but NEVER acts on directly through these surfaces — the agent reads, the operator
or a separate API-direct send does the acting. This split keeps the automation safe: the dashboard
backend is read-only, the agent never triggers sends through it.

---

## Access method (MANDATORY): run from inside the disposable BM's AdsPower profile

Per the browser-automation isolation rule, NEVER replay the cookie from a host-IP curl (hitting the
dashboard from a different IP than the account normally uses is a risk-control trigger, and this BSP
account was already false-positive-suspended once). Instead drive the SAME AdsPower profile that
operates the disposable BM, where YCloud is already logged in on the correct proxy, and call the
endpoints from inside that page (same origin, the cookie and proxy are applied automatically, nothing
to extract or store):

```python
import json, urllib.request
from playwright.sync_api import sync_playwright

ADS = "http://local.adspower.net:50325"
ws = json.load(urllib.request.urlopen(
    f"{ADS}/api/v1/browser/start?user_id=<PROFILE_ID>&headless=0"))["data"]["ws"]["puppeteer"]
with sync_playwright() as p:
    page = p.chromium.connect_over_cdp(ws).contexts[0].pages[0]
    if "ycloud.com" not in page.url:
        page.goto("https://www.ycloud.com/", wait_until="domcontentloaded")
    data = page.evaluate("""async () => {
        const r = await fetch('/api/whatsapp/batch/search', {method:'POST', credentials:'include',
            headers:{'Content-Type':'application/json'}, body: JSON.stringify({pageNo:1, pageSize:50})});
        return await r.json();
    }""")
```

The `SESSION` cookie expires, so the AdsPower profile must stay logged in (re-login inside the profile
when it does). The endpoints are undocumented and can change without notice. Read-only evaluation only,
never send through these.

**AdsPower-CDP isolation pointer:** The isolation rule applies to ALL automation touching the disposable
BM's accounts — not just YCloud. Any automation that touches Meta Business Manager or the BSP dashboard
must run through the SAME AdsPower antidetect profile that operates that disposable BM (same proxy exit
IP, same fingerprint, same already-logged-in session). Start the profile via the AdsPower local API
(`GET http://local.adspower.net:50325/api/v1/browser/start?user_id=<id>` returns a CDP `ws.puppeteer`
endpoint plus `debug_port`) and connect to THAT browser over CDP (`playwright.connect_over_cdp`), never
launch a fresh Playwright or host browser. For native profile control, install AdsPower's official MCP
server: `claude mcp add adspower-local-api -e PORT=50325 -- npx -y local-api-mcp-typescript` (repo
`AdsPower/local-api-mcp-typescript`). Official docs: localapi-doc-en.adspower.com and
github.com/AdsPower/localAPI.

---

## Automation loop (closes the template A/B decision)

This makes the DECISIVE metric, per-template opt-out, fully automatable on the correct proxy:
1. `batch/search` to list campaigns, each with `templateName`, `unsubscribeNums`, and counts.
2. `batch/activity/analytics` per campaign for the exact funnel plus `buttons[]` opt-out.
3. Group by `templateName`, sum sent / delivered / read / failed / opt-out per template, compute
   opt-out% = opt-outs / sent, and prefer the lower-opt-out template (audience friction is the #1
   quality-rating driver). For example, a template at 6% opt-out beats one at 18% even when their
   delivery and read rates are near-tied.
