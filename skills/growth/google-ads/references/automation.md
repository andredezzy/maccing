# Google Ads Automation Reference

This file is a platform-specific extension. Read the global doctrine first — all cross-cutting automation rules (surface selection decision tree, antidetect discipline, timing floors, proven MCP read recipe, fallback ladder) are defined there and are not repeated here:

**Global doctrine:** [`../../growth/reference/automation.md`](../../growth/reference/automation.md)

---

## 1. Primary Surface — Scripts and API (Rung 1)

Google Ads automation defaults to **Rung 1** for almost every task. Two official surfaces cover the vast majority of needs:

### Google Ads Scripts

JavaScript that runs **inside Google's cloud infrastructure** on Google's own servers. Scripts are authored in the Google Ads UI (Tools → Scripts), scheduled by the operator (hourly, daily, or manually triggered), and executed server-side — there is no browser session, no fingerprint surface, and no antidetect concern whatsoever.

The primary API is `AdsApp` — the top-level namespace for all Ads Scripts operations.

Common `AdsApp` entry points:

| Task | API |
|---|---|
| Iterate campaigns | `AdsApp.campaigns()` |
| Iterate ad groups | `AdsApp.adGroups()` |
| Iterate keywords | `AdsApp.keywords()` |
| Iterate ads | `AdsApp.ads()` |
| Access Shopping | `AdsApp.shoppingAdGroups()` |
| Send email reports | `MailApp.sendEmail(…)` |
| Write to Sheets | `SpreadsheetApp.openByUrl(…)` |

Scripts run under the authenticated Google account that owns the script. No credentials to manage, no session to maintain.

### Google Ads API

The REST/gRPC API for programmatic campaign management at scale — the same surface used by large agency tooling. Suitable for bulk operations, external integrations, and anything that outgrows the Scripts environment.

Authentication uses OAuth 2.0 service accounts or user credentials. The developer token is required.

---

## 2. Anti-Abuse Signals Reinforce API-First

Google's advertising UI actively defends against automation:

- **reCAPTCHA** is present on sign-in and several high-value UI surfaces — programmatic login flows will hit it.
- **Suspicious UI activity** (abnormal click cadences, unusual navigation patterns, off-hours bulk actions via the UI) is a documented account suspension trigger.

These signals make UI automation not just technically harder but actively risky to the account. There is no reCAPTCHA or account-risk surface when using Scripts (server-side) or the Google Ads API (server-to-server). This is the principal reason Google Ads defaults to Rung 1 with essentially no exceptions.

**Operating model:** Scripts are scheduled from the Google Ads Scripts console by the operator. The agent authors or edits the script; the operator pastes it in and schedules it. The agent does not drive the Scripts console itself.

---

## 3. Narrow UI Carve-Out — Recommendations Page Only

The **Recommendations page** (Google Ads → Recommendations) is the only confirmed surface that has no API coverage. Accepting, dismissing, or reviewing automated recommendations requires a browser session.

For this carve-out:

- Use **Playwriter** (the host browser, via `mcp__plugin_playwright_playwright__*` tools) — NOT AdsPower.
- The Recommendations page is not a fingerprint-sensitive surface. It does not require an antidetect profile — it is accessed from the operator's own authenticated browser session, no different from the operator reviewing it manually.
- No AdsPower profile is warranted here. Do not create one for this purpose.

If some future Google surface proves to be fingerprint-sensitive (e.g., a new UI surface that actively detects automation), apply the global AdsPower discipline at that point. As of now, no Google Ads surface other than the standard UI has warranted antidetect tooling.

**This carve-out is intentionally narrow.** Do not generalize it into a second parallel UI-automation path for Google. Every task that has an API or Scripts equivalent must use it.

---

## 4. Read / Commit Split (Google-Specific Examples)

Following the global Axis 2 definition:

| Task | Surface | Who executes |
|---|---|---|
| Pull campaign performance metrics | Google Ads Scripts (`AdsApp`) or Ads API | Agent |
| Generate keyword report | Google Ads Scripts (`AdsApp.keywords()`) | Agent |
| Create / modify campaigns in bulk | Google Ads API | Operator confirms; agent prepares payload |
| Accept a Recommendation | Recommendations page via Playwriter | Operator confirms click |
| Pause / enable a campaign | Google Ads API | Operator confirms |
| Change bidding strategy | Google Ads API | Operator confirms |

---

## 5. No Antidetect Profiles for Google Ads

There is no AdsPower profile for Google Ads in the standard operating model. Because all reads and the overwhelming majority of writes go through Scripts (server-side) or the Google Ads API (server-to-server), there is no browser session to protect.

The Recommendations carve-out uses the host browser. If a genuine need for an antidetect profile arises (which has not occurred in practice), document the specific surface and apply the full global antidetect discipline before proceeding.
