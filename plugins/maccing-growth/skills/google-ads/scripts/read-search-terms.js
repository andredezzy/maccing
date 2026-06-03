/**
 * Search Terms Report Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Fetches actual search queries that triggered ads in the last 30 days.
 * Essential for identifying negative keyword opportunities and high-intent queries.
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function main() {
  var query =
    "SELECT " +
    "  search_term_view.search_term, " +
    "  search_term_view.status, " +
    "  search_term_view.ad_group, " +
    "  ad_group_criterion.keyword.text, " +
    "  ad_group_criterion.keyword.match_type, " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions, " +
    "  metrics.conversions_value, " +
    "  metrics.conversion_rate, " +
    "  metrics.average_cpc, " +
    "  metrics.cost_per_conversion " +
    "FROM search_term_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "ORDER BY metrics.clicks DESC " +
    "LIMIT 1000";

  var searchTerms = [];
  var results = AdsApp.search(query);

  while (results.hasNext()) {
    var row = results.next();
    var metrics = row.metrics;

    searchTerms.push({
      searchTerm: row.searchTermView.searchTerm,
      status: row.searchTermView.status,
      matchedKeyword: {
        text: row.adGroupCriterion.keyword.text,
        matchType: row.adGroupCriterion.keyword.matchType
      },
      adGroup: {
        id: row.adGroup.id,
        name: row.adGroup.name
      },
      campaign: {
        id: row.campaign.id,
        name: row.campaign.name
      },
      metrics: {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: metrics.ctr,
        costMicros: metrics.costMicros,
        costUsd: (metrics.costMicros / 1000000).toFixed(2),
        conversions: metrics.conversions,
        conversionsValue: metrics.conversionsValue,
        conversionRate: metrics.conversionRate,
        averageCpcMicros: metrics.averageCpc,
        averageCpcUsd: (metrics.averageCpc / 1000000).toFixed(2),
        costPerConversionMicros: metrics.costPerConversion,
        costPerConversionUsd: (metrics.costPerConversion / 1000000).toFixed(2)
      }
    });
  }

  // Surface top waste (clicks but zero conversions) for easy LLM analysis
  var wastedSpend = searchTerms.filter(function (st) {
    return st.metrics.clicks > 5 && st.metrics.conversions === 0;
  });

  // Surface converting terms
  var convertingTerms = searchTerms.filter(function (st) {
    return st.metrics.conversions > 0;
  });

  var output = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    dateRange: "LAST_30_DAYS",
    totalSearchTerms: searchTerms.length,
    summary: {
      convertingTermsCount: convertingTerms.length,
      wastedSpendTermsCount: wastedSpend.length,
      totalCostUsd: (
        searchTerms.reduce(function (sum, st) {
          return sum + st.metrics.costMicros;
        }, 0) / 1000000
      ).toFixed(2),
      totalConversions: searchTerms.reduce(function (sum, st) {
        return sum + st.metrics.conversions;
      }, 0)
    },
    searchTerms: searchTerms,
    wastedSpendTerms: wastedSpend,
    convertingTerms: convertingTerms
  };

  Logger.log(JSON.stringify(output, null, 2));
}
