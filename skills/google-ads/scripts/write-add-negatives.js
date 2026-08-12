/**
 * Add negative keywords at the campaign level.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below
 *   4. Click "Preview" to validate, then "Run"
 *
 * Notes:
 *   - These are campaign-level negatives (block entire campaign from showing).
 *   - To add ad-group-level negatives, replace campaignCriterionOperation with
 *     adGroupCriterionOperation and change the resource path accordingly.
 *   - matchType for negatives is typically "BROAD" (matches all variants).
 *     Use "PHRASE" or "EXACT" to narrow the exclusion scope.
 */

const CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  campaignId: "REPLACE_CAMPAIGN_ID", // Numeric ID from the campaign URL
  keywords: [
    { text: "free", matchType: "BROAD" },
    { text: "cheap alternatives", matchType: "PHRASE" },
    { text: "competitor brand name", matchType: "EXACT" },
  ],
};

// ─── Main ────────────────────────────────────────────────────────────────────

function _main() {
  Logger.log(`Adding ${CONFIG.keywords.length} negative keyword(s) to campaign: ${CONFIG.campaignId}`);

  const campaignResource = `customers/${CONFIG.customerId}/campaigns/${CONFIG.campaignId}`;

  const operations = CONFIG.keywords.map((kw) => ({
    campaignCriterionOperation: {
      create: {
        campaign: campaignResource,
        negative: true,
        keyword: {
          text: kw.text,
          matchType: kw.matchType,
        },
      },
    },
  }));

  const results = AdsApp.mutateAll(operations);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < results.length; i++) {
    const kw = CONFIG.keywords[i];
    const result = results[i];

    if (result.isSuccessful()) {
      successCount++;
      Logger.log(`  Added negative [${kw.matchType}] ${kw.text} → ${result.getResourceName()}`);
    } else {
      failureCount++;
      Logger.log(`  FAILED [${kw.matchType}] ${kw.text}`);
      const errors = result.getErrorMessages();
      for (let j = 0; j < errors.length; j++) {
        Logger.log(`    Error: ${errors[j]}`);
      }
    }
  }

  Logger.log(`Done. ${successCount} added, ${failureCount} failed.`);
}
