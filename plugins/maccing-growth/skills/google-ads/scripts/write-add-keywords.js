/**
 * Add keywords to an existing ad group.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below
 *   4. Click "Preview" to validate, then "Run"
 *
 * Match types:
 *   "BROAD"  → broad match
 *   "PHRASE" → "phrase match"
 *   "EXACT"  → [exact match]
 *
 * AdsApp.mutateAll() sends all operations in a single batch request,
 * which is faster and uses fewer quota units than looping with mutate().
 */

var CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  adGroupId: "REPLACE_AD_GROUP_ID",   // Numeric ID from the ad group URL
  keywords: [
    { text: "example keyword one", matchType: "BROAD" },
    { text: "example keyword two", matchType: "PHRASE" },
    { text: "example keyword three", matchType: "EXACT" }
  ]
};

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  Logger.log(
    "Adding " + CONFIG.keywords.length + " keyword(s) to ad group: " + CONFIG.adGroupId
  );

  var adGroupResource =
    "customers/" + CONFIG.customerId + "/adGroups/" + CONFIG.adGroupId;

  var operations = CONFIG.keywords.map(function(kw) {
    return {
      adGroupCriterionOperation: {
        create: {
          adGroup: adGroupResource,
          status: "ENABLED",
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
        "  Added [" + kw.matchType + "] " + kw.text +
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
