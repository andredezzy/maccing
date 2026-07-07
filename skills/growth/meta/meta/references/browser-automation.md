# Meta Automation Reference

Meta-specific automation. Global doctrine (decision tree, AdsPower tooling, undetectability, keep-open, Hybrid split, the MCP read recipe, fallback ladder): `../../../growth/reference/automation.md`.

---

## 1. Meta's Official Surface (Rung 1)

**Marketing API / Graph API** — Meta's programmatic interface for ad management, campaign creation, audience targeting, and performance reporting. This is the top rung. Any task covered by the Marketing API must use it — never drop to a browser rung when an API call will do.

Use the official SDK (`facebook-nodejs-business-sdk` or direct Graph API calls) with a System User token scoped to the relevant Business Manager asset.

---

## 2. What Requires the Antidetect Browser (Rung 2)

The following surfaces have no Marketing API coverage and require an authenticated browser session via AdsPower:

- **Business Manager management UI** — account structure, user roles, BM-level settings that are not exposed via Graph API.
- **WhatsApp Manager surfaces** — phone number management, template submission status review, messaging limits display.
- **BSP dashboard backend reads** (e.g., YCloud) — campaign analytics, delivery metrics, opt-out counts. The BSP dashboard is a third-party backend; it is not reachable via the Meta Marketing API. See §3 below.

For all of the above, apply the full MCP read recipe from global §6 and the undetectability requirements from global §3.

---

## 3. BSP Dashboard Backend: Session-Cookie Authentication

BSP dashboards (e.g., YCloud) authenticate their backend endpoints by **session cookie**, not by the public API key. The public API key cannot reach the dashboard-backend analytics endpoints — it only reaches the BSP's public REST API, which has a different (and narrower) data surface.

The only way to reach the dashboard-backend read endpoints is from inside the BM's own AdsPower profile, where the operator's session cookie is already present.

**Read pattern (from inside `evaluate-script` on the logged-in dashboard page):**

```javascript
(async () => {
  const response = await fetch('<bsp-dashboard-endpoint>', {
    credentials: 'include'   // sends the profile's session cookie
  });
  return await response.json();
})()
```

Follow the global MCP read recipe (global §6) exactly. The navigate target is the BSP dashboard URL. Once the page is loaded and the readyState + jitter requirements are satisfied (global §3b / §3c), the `fetch()` above will carry the authenticated session.

Do not attempt to replicate or extract the session cookie for use outside the browser. The in-page fetch keeps everything inside Chrome's native context, which also eliminates the TLS fingerprint risk (global §3f).

---

## 4. Meta BM Is High-Sensitivity: Request-Sequence Is Critical

Meta's Business Manager and associated BSP dashboards are high-scrutiny surfaces with active bot-detection investment. Treat every dashboard or API read as requiring a preceding human page-visit to seed the request sequence.

Specifically: before issuing any `fetch()` from inside a BM or BSP dashboard page, ensure the page's own initialization XHRs have completed. Do not make the agent's fetch the first outbound call after a page load. This is the global §3b requirement — it is mandatory on all surfaces, but especially on high-sensitivity ones like Meta BM where anomalous request ordering has been confirmed as a risk-control trigger.

---

## 5. Own-Profile Rule (Mandatory)

Any automation touching a Business Manager's accounts — including BM management surfaces and BSP dashboard reads for accounts registered under that BM — **must run through that BM's own AdsPower profile**. "Own profile" means:

- The same proxy exit IP as the BM's normal operator access.
- The same browser fingerprint as that profile.
- Ideally, the same long-lived logged-in session (not a freshly created or cleared profile).

**Never use a clean browser or a host-IP browser session for BM-associated automation.** An IP or fingerprint mismatch between automated reads and normal operator access is a textbook risk-control trigger. BSP accounts in particular have been false-positive-suspended when automated reads originate from a different IP than the operator's usual access.

The own-profile rule is also the only way to reach session-cookie dashboard endpoints (§3 above) — without the operator's existing session, the dashboard backend returns 401 or redirects to login.

---

## 6. Agent-vs-Operator Visibility Gotcha

A profile the agent opens via the `adspower-local-api` MCP is an **automation-only context**. It is not a window the operator sees or can interact with unless the operator separately opens that profile from the AdsPower GUI.

This creates a hard split:

**For READS:** The agent drives the full sequence and reports the result — values, screenshots, parsed JSON. The operator does not need to touch the browser; they receive the output.

**For CONFIG and judgment actions:** The operator opens the profile from the AdsPower GUI and acts directly in the browser window. The agent's role is guidance only — surface the relevant URL, describe the exact action needed, and wait. The agent must NOT hand off "I opened the page, now you act on it" through an API-launched instance, because the operator has no visibility into that instance. An API-launched profile is a headless-equivalent from the operator's perspective.

---

## 7. Meta Read/Commit Split

Applies on top of the global Two-Axis Hybrid Split (global §5).

| Action | Who executes |
|---|---|
| Marketing API reads (campaign metrics, delivery stats, audience insights) | Agent (Rung 1) |
| BSP dashboard reads (delivery analytics, opt-out counts) | Agent (Rung 2, in-profile fetch per §3) |
| BM management reads (user lists, asset assignments) | Agent (Rung 2) |
| Ad creation, campaign publish, budget changes | Operator |
| Embedded Signup flows (WhatsApp Business Account onboarding) | Operator |
| Template submissions and status changes | Operator |
| Security changes, 2FA operations, password resets | Operator |
| Any bulk action that triggers delivery | Operator |
