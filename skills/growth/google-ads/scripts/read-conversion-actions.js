/**
 * Conversion Actions Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Fetches all conversion action configurations including category, type,
 * counting mode, attribution model, lookback windows, and tag snippets.
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function _main() {
  const query =
    "SELECT " +
    "  conversion_action.id, " +
    "  conversion_action.name, " +
    "  conversion_action.status, " +
    "  conversion_action.category, " +
    "  conversion_action.type, " +
    "  conversion_action.counting_type, " +
    "  conversion_action.primary_for_goal, " +
    "  conversion_action.include_in_conversions_metric, " +
    "  conversion_action.value_settings.default_value, " +
    "  conversion_action.value_settings.default_currency_code, " +
    "  conversion_action.value_settings.always_use_default_value, " +
    "  conversion_action.attribution_model_settings.attribution_model, " +
    "  conversion_action.attribution_model_settings.data_driven_model_status, " +
    "  conversion_action.click_through_lookback_window_days, " +
    "  conversion_action.view_through_lookback_window_days, " +
    "  conversion_action.phone_call_duration_seconds, " +
    "  conversion_action.tag_snippets " +
    "FROM conversion_action " +
    "ORDER BY conversion_action.name ASC";

  const conversionActions = [];
  const results = AdsApp.search(query);

  while (results.hasNext()) {
    const row = results.next();
    const ca = row.conversionAction;

    conversionActions.push({
      id: ca.id,
      name: ca.name,
      status: ca.status,
      category: ca.category,
      type: ca.type,
      countingType: ca.countingType,
      primaryForGoal: ca.primaryForGoal,
      includeInConversionsMetric: ca.includeInConversionsMetric,
      value: {
        defaultValue: ca.valueSettings.defaultValue,
        defaultCurrencyCode: ca.valueSettings.defaultCurrencyCode,
        alwaysUseDefaultValue: ca.valueSettings.alwaysUseDefaultValue,
      },
      attribution: {
        model: ca.attributionModelSettings.attributionModel,
        dataDrivenModelStatus: ca.attributionModelSettings.dataDrivenModelStatus,
      },
      lookbackWindows: {
        clickThroughDays: ca.clickThroughLookbackWindowDays,
        viewThroughDays: ca.viewThroughLookbackWindowDays,
      },
      phoneCallDurationSeconds: ca.phoneCallDurationSeconds || null,
      tagSnippets: (ca.tagSnippets || []).map((snippet) => ({
        type: snippet.type,
        pageFormat: snippet.pageFormat,
        globalSiteTagSnippet: snippet.globalSiteTagSnippet,
        eventSnippet: snippet.eventSnippet,
      })),
    });
  }

  const output = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    totalConversionActions: conversionActions.length,
    activeCount: conversionActions.filter((ca) => ca.status === "ENABLED").length,
    conversionActions: conversionActions,
  };

  Logger.log(JSON.stringify(output, null, 2));
}
