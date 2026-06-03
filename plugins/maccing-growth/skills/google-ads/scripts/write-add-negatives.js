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

var CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  campaignId: "REPLACE_CAMPAIGN_ID",   // Numeric ID from the campaign URL
  keywords: [
    { text: "free", matchType: "BROAD" },
    { text: "cheap alternatives", matchType: "PHRASE" },
    { text: "competitor brand name", matchType: "EXACT" }
  ]
};

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  Logger.log(
    "Adding " + CONFIG.keywords.length + " negative keyword(s) to campaign: " +
    CONFIG.campaignId
  );

  var campaignResource =
    "customers/" + CONFIG.customerId + "/campaigns/" + CONFIG.campaignId;

  var operations = CONFIG.keywords.map(function(kw) {
    return {
      campaignCriterionOperation: {
        create: {
          campaign: campaignResource,
          negative: true,
          keyword: {
            text: kw.text,
            matchType: kw.matchType
          }
        }
      }
    };
  });

  var results = AdsApp.mutateAll(operations);

  var successCount = 0;
  var failureCount = 0;

  for (var i = 0; i < results.length; i++) {
    var kw = CONFIG.keywords[i];
    var result = results[i];

    if (result.isSuccessful()) {
      successCount++;
      Logger.log(
        "  Added negative [" + kw.matchType + "] " + kw.text +
        " → " + result.getResourceName()
      );
    } else {
      failureCount++;
      Logger.log("  FAILED [" + kw.matchType + "] " + kw.text);
      var errors = result.getErrorMessages();
      for (var j = 0; j < errors.length; j++) {
        Logger.log("    Error: " + errors[j]);
      }
    }
  }

  Logger.log(
    "Done. " + successCount + " added, " + failureCount + " failed."
  );
}
