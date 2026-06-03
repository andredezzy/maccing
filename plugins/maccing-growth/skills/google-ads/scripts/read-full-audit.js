/**
 * Full Account Audit Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Runs a comprehensive audit of all campaigns, ad groups, ads, keywords,
 * search terms, and conversion actions. Outputs a single JSON object to Logger.
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function main() {
  var audit = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    campaigns: queryCampaigns(),
    adGroups: queryAdGroups(),
    ads: queryAds(),
    keywords: queryKeywords(),
    searchTerms: querySearchTerms(),
    conversionActions: queryConversionActions()
  };

  Logger.log(JSON.stringify(audit, null, 2));
}

function queryCampaigns() {
  var rows = [];
  var query =
    "SELECT " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  campaign.status, " +
    "  campaign.advertising_channel_type, " +
    "  campaign.bidding_strategy_type, " +
    "  campaign_budget.amount_micros, " +
    "  campaign_budget.delivery_method, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions, " +
    "  metrics.average_cpc " +
    "FROM campaign " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND campaign.status != 'REMOVED' " +
    "ORDER BY metrics.cost_micros DESC";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    rows.push({
      id: row.campaign.id,
      name: row.campaign.name,
      status: row.campaign.status,
      channelType: row.campaign.advertisingChannelType,
      biddingStrategy: row.campaign.biddingStrategyType,
      budgetAmountMicros: row.campaignBudget.amountMicros,
      budgetDeliveryMethod: row.campaignBudget.deliveryMethod,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      ctr: row.metrics.ctr,
      costMicros: row.metrics.costMicros,
      costUsd: (row.metrics.costMicros / 1000000).toFixed(2),
      conversions: row.metrics.conversions,
      averageCpcMicros: row.metrics.averageCpc,
      averageCpcUsd: (row.metrics.averageCpc / 1000000).toFixed(2)
    });
  }
  return rows;
}

function queryAdGroups() {
  var rows = [];
  var query =
    "SELECT " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  ad_group.status, " +
    "  ad_group.type, " +
    "  ad_group.cpc_bid_micros, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions " +
    "FROM ad_group " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND ad_group.status != 'REMOVED' " +
    "ORDER BY metrics.cost_micros DESC";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    rows.push({
      id: row.adGroup.id,
      name: row.adGroup.name,
      status: row.adGroup.status,
      type: row.adGroup.type,
      cpcBidMicros: row.adGroup.cpcBidMicros,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      ctr: row.metrics.ctr,
      costMicros: row.metrics.costMicros,
      conversions: row.metrics.conversions
    });
  }
  return rows;
}

function queryAds() {
  var rows = [];
  var query =
    "SELECT " +
    "  ad_group_ad.ad.id, " +
    "  ad_group_ad.ad.type, " +
    "  ad_group_ad.status, " +
    "  ad_group_ad.ad_strength, " +
    "  ad_group_ad.ad.final_urls, " +
    "  ad_group_ad.ad.responsive_search_ad.headlines, " +
    "  ad_group_ad.ad.responsive_search_ad.descriptions, " +
    "  ad_group_ad.ad.responsive_search_ad.path1, " +
    "  ad_group_ad.ad.responsive_search_ad.path2, " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions " +
    "FROM ad_group_ad " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND ad_group_ad.status != 'REMOVED' " +
    "ORDER BY metrics.impressions DESC";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    var ad = row.adGroupAd.ad;
    var rsa = ad.responsiveSearchAd || {};
    rows.push({
      id: ad.id,
      type: ad.type,
      status: row.adGroupAd.status,
      adStrength: row.adGroupAd.adStrength,
      finalUrls: ad.finalUrls || [],
      headlines: rsa.headlines || [],
      descriptions: rsa.descriptions || [],
      path1: rsa.path1 || "",
      path2: rsa.path2 || "",
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      ctr: row.metrics.ctr,
      costMicros: row.metrics.costMicros,
      conversions: row.metrics.conversions
    });
  }
  return rows;
}

function queryKeywords() {
  var rows = [];
  var query =
    "SELECT " +
    "  ad_group_criterion.keyword.text, " +
    "  ad_group_criterion.keyword.match_type, " +
    "  ad_group_criterion.status, " +
    "  ad_group_criterion.quality_info.quality_score, " +
    "  ad_group_criterion.cpc_bid_micros, " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.average_cpc, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions " +
    "FROM keyword_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND ad_group_criterion.status != 'REMOVED' " +
    "ORDER BY metrics.impressions DESC";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    var kw = row.adGroupCriterion;
    rows.push({
      text: kw.keyword.text,
      matchType: kw.keyword.matchType,
      status: kw.status,
      qualityScore: kw.qualityInfo ? kw.qualityInfo.qualityScore : null,
      cpcBidMicros: kw.cpcBidMicros,
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      ctr: row.metrics.ctr,
      averageCpcMicros: row.metrics.averageCpc,
      averageCpcUsd: (row.metrics.averageCpc / 1000000).toFixed(2),
      costMicros: row.metrics.costMicros,
      conversions: row.metrics.conversions
    });
  }
  return rows;
}

function querySearchTerms() {
  var rows = [];
  var query =
    "SELECT " +
    "  search_term_view.search_term, " +
    "  search_term_view.status, " +
    "  ad_group.id, " +
    "  ad_group.name, " +
    "  campaign.id, " +
    "  campaign.name, " +
    "  metrics.impressions, " +
    "  metrics.clicks, " +
    "  metrics.ctr, " +
    "  metrics.cost_micros, " +
    "  metrics.conversions, " +
    "  metrics.average_cpc " +
    "FROM search_term_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "ORDER BY metrics.clicks DESC " +
    "LIMIT 500";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    rows.push({
      searchTerm: row.searchTermView.searchTerm,
      status: row.searchTermView.status,
      adGroupId: row.adGroup.id,
      adGroupName: row.adGroup.name,
      campaignId: row.campaign.id,
      campaignName: row.campaign.name,
      impressions: row.metrics.impressions,
      clicks: row.metrics.clicks,
      ctr: row.metrics.ctr,
      costMicros: row.metrics.costMicros,
      costUsd: (row.metrics.costMicros / 1000000).toFixed(2),
      conversions: row.metrics.conversions,
      averageCpcMicros: row.metrics.averageCpc,
      averageCpcUsd: (row.metrics.averageCpc / 1000000).toFixed(2)
    });
  }
  return rows;
}

function queryConversionActions() {
  var rows = [];
  var query =
    "SELECT " +
    "  conversion_action.id, " +
    "  conversion_action.name, " +
    "  conversion_action.status, " +
    "  conversion_action.category, " +
    "  conversion_action.type, " +
    "  conversion_action.counting_type, " +
    "  conversion_action.value_settings.default_value, " +
    "  conversion_action.value_settings.always_use_default_value, " +
    "  conversion_action.attribution_model_settings.attribution_model, " +
    "  conversion_action.click_through_lookback_window_days, " +
    "  conversion_action.view_through_lookback_window_days, " +
    "  conversion_action.primary_for_goal, " +
    "  conversion_action.tag_snippets " +
    "FROM conversion_action " +
    "WHERE conversion_action.status != 'REMOVED'";

  var results = AdsApp.search(query);
  while (results.hasNext()) {
    var row = results.next();
    var ca = row.conversionAction;
    rows.push({
      id: ca.id,
      name: ca.name,
      status: ca.status,
      category: ca.category,
      type: ca.type,
      countingType: ca.countingType,
      defaultValue: ca.valueSettings.defaultValue,
      alwaysUseDefaultValue: ca.valueSettings.alwaysUseDefaultValue,
      attributionModel: ca.attributionModelSettings.attributionModel,
      clickThroughLookbackWindowDays: ca.clickThroughLookbackWindowDays,
      viewThroughLookbackWindowDays: ca.viewThroughLookbackWindowDays,
      primaryForGoal: ca.primaryForGoal,
      tagSnippets: ca.tagSnippets || []
    });
  }
  return rows;
}
