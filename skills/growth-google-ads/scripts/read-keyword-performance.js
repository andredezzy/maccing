/**
 * Keyword Performance Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Fetches keyword-level performance metrics and Quality Score components
 * for the last 30 days across all active campaigns.
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function _main() {
  const query =
    "SELECT " +
    "  ad_group_criterion.criterion_id, " +
    "  ad_group_criterion.keyword.text, " +
    "  ad_group_criterion.keyword.match_type, " +
    "  ad_group_criterion.status, " +
    "  ad_group_criterion.system_serving_status, " +
    "  ad_group_criterion.approval_status, " +
    "  ad_group_criterion.cpc_bid_micros, " +
    "  ad_group_criterion.effective_cpc_bid_micros, " +
    "  ad_group_criterion.quality_info.quality_score, " +
    "  ad_group_criterion.quality_info.search_predicted_ctr, " +
    "  ad_group_criterion.quality_info.ad_relevance, " +
    "  ad_group_criterion.quality_info.landing_page_experience, " +
    "  ad_group_criterion.final_urls, " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  ad_group.status, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  campaign.status, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions, " +
    "  metrics.conversions_value, " +
    "  metrics.conversion_rate, " +
    "  metrics.average_cpc, " +
    "  metrics.cost_per_conversion, " +
    "  metrics.search_impression_share, " +
    "  metrics.search_rank_lost_impression_share " +
    "FROM keyword_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND ad_group_criterion.status != 'REMOVED' " +
    "  AND campaign.status != 'REMOVED' " +
    "ORDER BY metrics.impressions DESC";

  const keywords = [];
  const results = AdsApp.search(query);

  while (results.hasNext()) {
    const row = results.next();
    const kw = row.adGroupCriterion;
    const metrics = row.metrics;

    keywords.push({
      criterionId: kw.criterionId,
      text: kw.keyword.text,
      matchType: kw.keyword.matchType,
      status: kw.status,
      systemServingStatus: kw.systemServingStatus,
      approvalStatus: kw.approvalStatus,
      cpcBidMicros: kw.cpcBidMicros,
      cpcBidUsd: (kw.cpcBidMicros / 1000000).toFixed(2),
      effectiveCpcBidMicros: kw.effectiveCpcBidMicros,
      effectiveCpcBidUsd: (kw.effectiveCpcBidMicros / 1000000).toFixed(2),
      finalUrls: kw.finalUrls || [],
      qualityScore: {
        score: kw.qualityInfo.qualityScore,
        searchPredictedCtr: kw.qualityInfo.searchPredictedCtr,
        adRelevance: kw.qualityInfo.adRelevance,
        landingPageExperience: kw.qualityInfo.landingPageExperience,
      },
      adGroup: {
        id: row.adGroup.id,
        name: row.adGroup.name,
        status: row.adGroup.status,
      },
      campaign: {
        id: row.campaign.id,
        name: row.campaign.name,
        status: row.campaign.status,
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
        costPerConversionUsd: (metrics.costPerConversion / 1000000).toFixed(2),
        searchImpressionShare: metrics.searchImpressionShare,
        searchRankLostImpressionShare: metrics.searchRankLostImpressionShare,
      },
    });
  }

  const output = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    dateRange: "LAST_30_DAYS",
    totalKeywords: keywords.length,
    keywords: keywords,
  };

  Logger.log(JSON.stringify(output, null, 2));
}
