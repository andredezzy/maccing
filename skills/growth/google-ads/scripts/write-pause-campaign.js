/**
 * Pause or resume a campaign by updating its status.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below
 *   4. Click "Preview" to validate, then "Run"
 *
 * Valid values for newStatus:
 *   "PAUSED"  → stop the campaign from serving
 *   "ENABLED" → resume a paused campaign
 *
 * The updateMask tells the API which field(s) to overwrite.
 * Only "status" is changed; all other campaign settings remain untouched.
 */

const CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  campaignId: "REPLACE_CAMPAIGN_ID", // Numeric ID from the campaign URL
  newStatus: "PAUSED", // "PAUSED" or "ENABLED"
};

// ─── Main ────────────────────────────────────────────────────────────────────

function _main() {
  Logger.log(`Updating campaign ${CONFIG.campaignId} status to: ${CONFIG.newStatus}`);

  const campaignResource = `customers/${CONFIG.customerId}/campaigns/${CONFIG.campaignId}`;

  const result = AdsApp.mutate({
    campaignOperation: {
      update: {
        resourceName: campaignResource,
        status: CONFIG.newStatus,
      },
      updateMask: "status",
    },
  });

  if (result.isSuccessful()) {
    Logger.log("Campaign status updated successfully.");
    Logger.log(`Resource name: ${result.getResourceName()}`);
    Logger.log(`New status: ${CONFIG.newStatus}`);
  } else {
    Logger.log("ERROR: Failed to update campaign status.");
    const errors = result.getErrorMessages();
    for (let i = 0; i < errors.length; i++) {
      Logger.log(`  [${i + 1}] ${errors[i]}`);
    }
  }
}
