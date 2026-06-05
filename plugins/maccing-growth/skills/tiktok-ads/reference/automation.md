# TikTok Ads Automation Reference

This file is a platform-specific extension. Read the global doctrine first — all cross-cutting automation rules (surface selection decision tree, antidetect discipline, timing floors, proven MCP read recipe, fallback ladder) are defined there and are not repeated here:

**Global doctrine:** [`../../growth/reference/automation.md`](../../growth/reference/automation.md)

---

> **Status: dormant / suspended.** TikTok Ads is not currently active. This is a scaffold. Fill in concrete surface specifics, account identifiers, and operating procedures on reactivation.

---

## 1. Primary Surface — TikTok Marketing API (Rung 1)

The **TikTok Marketing API** is the official programmatic surface for campaign management, reporting, and audience operations. All tasks that the Marketing API covers must use it — never the UI.

Authentication uses OAuth 2.0 with an app-level access token. The advertiser ID (`advertiser_id`) is required on most requests.

Relevant API areas (fill in endpoint details on reactivation):

- Campaign management (`/open_api/v1.3/campaign/…`)
- Ad group and ad management
- Reporting and insights (`/open_api/v1.3/report/…`)
- Audience management

---

## 2. UI Automation — Aggressive Bot Detection

TikTok Ads Manager employs aggressive bot detection. If a task ever requires UI automation (i.e., it has no Marketing API coverage), apply the **full global AdsPower discipline**:

- Use an AdsPower antidetect profile with an appropriately assigned proxy.
- Follow the global fallback ladder (MCP → CLI → raw local API).
- Follow the global undetectability doctrine (§3a–§3g of the global doctrine): `navigator.webdriver` assertion, request-sequence ordering, timing floors, headless=0.
- Treat any commit action (publish, send, submit) as Rung 3 — operator-only.

Do not attempt UI automation without antidetect tooling on TikTok. The detection surface is active and the risk of account-level action is high.

---

## 3. Specifics to Document on Reactivation

On reactivation, fill in:

- Active advertiser account ID(s)
- App credentials location (where the OAuth app ID and secret are stored)
- AdsPower profile IDs assigned to TikTok, if any UI automation is needed
- Concrete read/commit split table for the specific tasks being automated
- Any platform-specific timing adjustments beyond the global §3c floors
