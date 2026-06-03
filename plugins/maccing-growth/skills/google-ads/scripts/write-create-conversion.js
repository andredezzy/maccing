/**
 * Create a conversion action in Google Ads.
 *
 * How to use:
 *   1. Open Google Ads → Tools → Scripts
 *   2. Paste this script
 *   3. Fill in CONFIG below
 *   4. Click "Preview" to validate, then "Run"
 *
 * Valid values for category:
 *   "PURCHASE"   → sale / transaction
 *   "SIGNUP"     → lead / registration
 *   "PAGE_VIEW"  → landing page view
 *   "OTHER"      → generic action
 *
 * Valid values for countingType:
 *   "ONE_CONVERSION"  → count only the first conversion per click (leads, signups)
 *   "MANY_PER_CLICK"  → count every conversion per click (purchases, add-to-cart)
 *
 * After creation, you still need to add the conversion tag to your website
 * or set up import from Google Analytics / Firebase.
 */

var CONFIG = {
  customerId: "YOUR_CUSTOMER_ID",
  name: "My Conversion Action",        // Descriptive name shown in the UI
  category: "PURCHASE",               // "PURCHASE", "SIGNUP", "PAGE_VIEW", "OTHER"
  countingType: "ONE_CONVERSION"      // "ONE_CONVERSION" or "MANY_PER_CLICK"
};

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  Logger.log("Creating conversion action: " + CONFIG.name);
  Logger.log("  Category: " + CONFIG.category);
  Logger.log("  Counting type: " + CONFIG.countingType);

  var result = AdsApp.mutate({
    conversionActionOperation: {
      create: {
        name: CONFIG.name,
        status: "ENABLED",
        type: "WEBPAGE",
        category: CONFIG.category,
        countingType: CONFIG.countingType,
        viewThroughLookbackWindowDays: 1,
        clickThroughLookbackWindowDays: 30
      }
    }
  });

  if (result.isSuccessful()) {
    Logger.log("Conversion action created successfully.");
    Logger.log("Resource name: " + result.getResourceName());
    Logger.log(
      "Next step: add the conversion tag to your site or link an import source."
    );
  } else {
    Logger.log("ERROR: Failed to create conversion action.");
    var errors = result.getErrorMessages();
    for (var i = 0; i < errors.length; i++) {
      Logger.log("  [" + (i + 1) + "] " + errors[i]);
    }
  }
}
