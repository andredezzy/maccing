/**
 * Campaign Performance Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Fetches campaign-level performance metrics for the last 30 days.
 * Covers: example campaigns across search + investment funnels
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function main() {
  var query =
    "SELECT " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  campaign.status, " +
    "  campaign.advertising_channel_type, " +
    "  campaign.bidding_strategy_type, " +
    "  campaign.target_cpa.target_cpa_micros, " +
    "  campaign.maximize_conversions.target_cpa_micros, " +
    "  campaign_budget.amount_micros, " +
    "  campaign_budget.delivery_method, " +
    "  campaign_budget.has_recommended_budget, " +
    "  campaign_budget.recommended_budget_amount_micros, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions, " +
    "  metrics.conversions_value, " +
    "  metrics.cost_per_conversion, " +
    "  metrics.conversion_rate, " +
    "  metrics.average_cpc, " +
    "  metrics.average_cpm, " +
    "  metrics.search_impression_share, " +
    "  metrics.search_budget_lost_impression_share, " +
    "  metrics.search_rank_lost_impression_share " +
    "FROM campaign " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND campaign.status != 'REMOVED' " +
    "ORDER BY metrics.cost_micros DESC";

  var campaigns = [];
  var results = AdsApp.search(query);

  while (results.hasNext()) {
    var row = results.next();
    var campaign = row.campaign;
    var budget = row.campaignBudget;
    var metrics = row.metrics;

    campaigns.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      channelType: campaign.advertisingChannelType,
      biddingStrategyType: campaign.biddingStrategyType,
      targetCpaMicros:
        (campaign.targetCpa && campaign.targetCpa.targetCpaMicros) ||
        (campaign.maximizeConversions && campaign.maximizeConversions.targetCpaMicros) ||
        null,
      budget: {
        amountMicros: budget.amountMicros,
        amountUsd: (budget.amountMicros / 1000000).toFixed(2),
        deliveryMethod: budget.deliveryMethod,
        hasRecommendedBudget: budget.hasRecommendedBudget,
        recommendedAmountMicros: budget.recommendedBudgetAmountMicros
      },
      metrics: {
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        ctr: metrics.ctr,
        costMicros: metrics.costMicros,
        costUsd: (metrics.costMicros / 1000000).toFixed(2),
        conversions: metrics.conversions,
        conversionsValue: metrics.conversionsValue,
        costPerConversionMicros: metrics.costPerConversion,
        costPerConversionUsd: (metrics.costPerConversion / 1000000).toFixed(2),
        conversionRate: metrics.conversionRate,
        averageCpcMicros: metrics.averageCpc,
        averageCpcUsd: (metrics.averageCpc / 1000000).toFixed(2),
        averageCpmMicros: metrics.averageCpm,
        searchImpressionShare: metrics.searchImpressionShare,
        searchBudgetLostImpressionShare: metrics.searchBudgetLostImpressionShare,
        searchRankLostImpressionShare: metrics.searchRankLostImpressionShare
      }
    });
  }

  var output = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    dateRange: "LAST_30_DAYS",
    totalCampaigns: campaigns.length,
    campaigns: campaigns
  };

  Logger.log(JSON.stringify(output, null, 2));
}
