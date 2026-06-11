/**
 * Ad Details Script
 * Customer ID: YOUR_CUSTOMER_ID | Manager ID: YOUR_MANAGER_ID
 *
 * Fetches full creative details for all responsive search ads:
 * headlines, descriptions, display URL paths, final URLs, ad strength,
 * and performance metrics for the last 30 days.
 *
 * Usage: Tools → Scripts → New script → paste → Preview/Run
 */

function _main() {
  const query =
    "SELECT " +
    "  ad_group_ad.ad.id, " +
    "  ad_group_ad.ad.type, " +
    "  ad_group_ad.status, " +
    "  ad_group_ad.ad_strength, " +
    "  ad_group_ad.policy_summary.approval_status, " +
    "  ad_group_ad.policy_summary.review_status, " +
    "  ad_group_ad.ad.final_urls, " +
    "  ad_group_ad.ad.final_mobile_urls, " +
    "  ad_group_ad.ad.tracking_url_template, " +
    "  ad_group_ad.ad.responsive_search_ad.headlines, " +
    "  ad_group_ad.ad.responsive_search_ad.descriptions, " +
    "  ad_group_ad.ad.responsive_search_ad.path1, " +
    "  ad_group_ad.ad.responsive_search_ad.path2, " +
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
    "  metrics.average_cpc " +
    "FROM ad_group_ad " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "  AND ad_group_ad.status != 'REMOVED' " +
    "  AND campaign.status != 'REMOVED' " +
    "ORDER BY metrics.impressions DESC";

  const ads = [];
  const results = AdsApp.search(query);

  while (results.hasNext()) {
    const row = results.next();
    const adGroupAd = row.adGroupAd;
    const ad = adGroupAd.ad;
    const rsa = ad.responsiveSearchAd || {};
    const policy = adGroupAd.policySummary || {};
    const metrics = row.metrics;

    ads.push({
      id: ad.id,
      type: ad.type,
      status: adGroupAd.status,
      adStrength: adGroupAd.adStrength,
      policy: {
        approvalStatus: policy.approvalStatus,
        reviewStatus: policy.reviewStatus,
      },
      creative: {
        headlines: (rsa.headlines || []).map((h) => ({
          text: h.text,
          pinnedField: h.pinnedField || null,
        })),
        descriptions: (rsa.descriptions || []).map((d) => ({
          text: d.text,
          pinnedField: d.pinnedField || null,
        })),
        path1: rsa.path1 || "",
        path2: rsa.path2 || "",
        finalUrls: ad.finalUrls || [],
        finalMobileUrls: ad.finalMobileUrls || [],
        trackingUrlTemplate: ad.trackingUrlTemplate || null,
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
        averageCpcMicros: metrics.averageCpc,
        averageCpcUsd: (metrics.averageCpc / 1000000).toFixed(2),
      },
    });
  }

  const output = {
    timestamp: new Date().toISOString(),
    customerId: "YOUR_CUSTOMER_ID",
    dateRange: "LAST_30_DAYS",
    totalAds: ads.length,
    adStrengthDistribution: ads.reduce((acc, ad) => {
      const strength = ad.adStrength || "UNKNOWN";
      acc[strength] = (acc[strength] || 0) + 1;
      return acc;
    }, {}),
    ads: ads,
  };

  Logger.log(JSON.stringify(output, null, 2));
}
