/**
 * Create a Responsive Search Ad (RSA) in an existing ad group.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below
 *   4. Click "Preview" to validate, then "Run"
 *
 * Requirements:
 *   - The ad group must already exist
 *   - At least 3 headlines and 2 descriptions are required
 *   - The ad is created in PAUSED status for safety; change to ENABLED when ready
 */

var CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  adGroupId: "REPLACE_AD_GROUP_ID",   // Numeric ID from the ad group URL
  headlines: [                         // Min 3, max 15
    "Headline One",
    "Headline Two",
    "Headline Three"
  ],
  descriptions: [                      // Min 2, max 4
    "Description line one here.",
    "Description line two here."
  ],
  finalUrl: "https://example.com",
  path1: "path1",                      // Optional display path (max 15 chars each)
  path2: "path2"
};

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  Logger.log("Creating RSA in ad group: " + CONFIG.adGroupId);

  var adGroupResource =
    "customers/" + CONFIG.customerId + "/adGroups/" + CONFIG.adGroupId;

  var result = AdsApp.mutate({
    adGroupAdOperation: {
      create: {
        adGroup: adGroupResource,
        status: "PAUSED",
        ad: {
          responsiveSearchAd: {
            headlines: CONFIG.headlines.map(function(text) {
              return { text: text };
            }),
            descriptions: CONFIG.descriptions.map(function(text) {
              return { text: text };
            }),
            path1: CONFIG.path1,
            path2: CONFIG.path2
          },
          finalUrls: [CONFIG.finalUrl]
        }
      }
    }
  });

  if (result.isSuccessful()) {
    Logger.log("RSA created successfully.");
    Logger.log("Resource name: " + result.getResourceName());
    Logger.log(
      "Note: ad is PAUSED — update status to ENABLED when ready to serve."
    );
  } else {
    Logger.log("ERROR: Failed to create RSA.");
    var errors = result.getErrorMessages();
    for (var i = 0; i < errors.length; i++) {
      Logger.log("  [" + (i + 1) + "] " + errors[i]);
    }
  }
}
