/**
 * Update the Final URL of an existing ad.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below — you need the ad group ID AND the ad ID
 *   4. Click "Preview" to validate, then "Run"
 *
 * How to find the ad ID:
 *   In the Google Ads UI, go to Ads → hover over the ad →
 *   the URL will contain "adId=XXXXXXXXX".
 *
 * The updateMask "ad.finalUrls" ensures only the Final URL is overwritten;
 * all other ad fields (headlines, descriptions, paths) remain unchanged.
 */

const CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  adGroupId: "REPLACE_AD_GROUP_ID", // Numeric ID from the ad group URL
  adId: "REPLACE_AD_ID", // Numeric ID from the ad URL
  newFinalUrl: "https://example.com/new-landing-page",
};

// ─── Main ────────────────────────────────────────────────────────────────────

function _main() {
  Logger.log(`Updating Final URL for ad: ${CONFIG.adId}`);
  Logger.log(`New URL: ${CONFIG.newFinalUrl}`);

  const adGroupAdResource = `customers/${CONFIG.customerId}/adGroupAds/${CONFIG.adGroupId}~${CONFIG.adId}`;

  const result = AdsApp.mutate({
    adGroupAdOperation: {
      update: {
        resourceName: adGroupAdResource,
        ad: {
          finalUrls: [CONFIG.newFinalUrl],
        },
      },
      updateMask: "ad.finalUrls",
    },
  });

  if (result.isSuccessful()) {
    Logger.log("Final URL updated successfully.");
    Logger.log(`Resource name: ${result.getResourceName()}`);
    Logger.log(`New Final URL: ${CONFIG.newFinalUrl}`);
  } else {
    Logger.log("ERROR: Failed to update Final URL.");
    const errors = result.getErrorMessages();
    for (let i = 0; i < errors.length; i++) {
      Logger.log(`  [${i + 1}] ${errors[i]}`);
    }
  }
}
