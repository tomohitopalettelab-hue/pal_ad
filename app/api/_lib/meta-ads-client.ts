// Meta (Facebook/Instagram) Ads API client
// https://developers.facebook.com/docs/marketing-apis

const API_VERSION = 'v19.0';

export type MetaAdsCampaignInput = {
  name: string;
  objective: 'OUTCOME_TRAFFIC' | 'OUTCOME_AWARENESS' | 'OUTCOME_ENGAGEMENT' | 'OUTCOME_LEADS';
  dailyBudget: number; // 日予算（円）
  startTime?: string; // ISO 8601
  endTime?: string;
  headline: string;
  body: string;
  linkUrl: string;
  imageUrl?: string;
  targetAgeMin?: number;
  targetAgeMax?: number;
  targetGenders?: number[]; // 1=male, 2=female
  targetLocations?: { key: string; name: string }[];
};

// ===== キャンペーン作成フロー =====

export const createMetaAdsCampaign = async (
  accessToken: string,
  adAccountId: string,
  input: MetaAdsCampaignInput,
): Promise<{ success: boolean; campaignId?: string; error?: string }> => {
  // adAccountIdが "act_" で始まっていない場合は付与
  const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  try {
    // 1. キャンペーン作成
    const campaignRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${accountId}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          objective: input.objective,
          status: 'PAUSED',
          special_ad_categories: [],
          access_token: accessToken,
        }),
      },
    );
    const campaignData = await campaignRes.json();
    if (campaignData.error) {
      return { success: false, error: campaignData.error.message };
    }
    const campaignId = campaignData.id;

    // 2. 広告セット作成
    const targeting: Record<string, unknown> = {};
    if (input.targetAgeMin) targeting.age_min = input.targetAgeMin;
    if (input.targetAgeMax) targeting.age_max = input.targetAgeMax;
    if (input.targetGenders?.length) targeting.genders = input.targetGenders;
    if (input.targetLocations?.length) {
      targeting.geo_locations = {
        countries: ['JP'],
        location_types: ['home', 'recent'],
      };
    } else {
      targeting.geo_locations = { countries: ['JP'] };
    }

    const adSetRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${accountId}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${input.name} - Ad Set`,
          campaign_id: campaignId,
          daily_budget: input.dailyBudget,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'LINK_CLICKS',
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          targeting,
          status: 'PAUSED',
          ...(input.startTime && { start_time: input.startTime }),
          ...(input.endTime && { end_time: input.endTime }),
          access_token: accessToken,
        }),
      },
    );
    const adSetData = await adSetRes.json();
    if (adSetData.error) {
      return { success: false, error: adSetData.error.message };
    }
    const adSetId = adSetData.id;

    // 3. 広告クリエイティブ作成
    const creativeRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${accountId}/adcreatives`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${input.name} - Creative`,
          object_story_spec: {
            link_data: {
              link: input.linkUrl,
              message: input.body,
              name: input.headline,
              ...(input.imageUrl && { picture: input.imageUrl }),
            },
          },
          access_token: accessToken,
        }),
      },
    );
    const creativeData = await creativeRes.json();
    if (creativeData.error) {
      // クリエイティブ作成失敗でもキャンペーンIDは返す
      return { success: true, campaignId, error: `クリエイティブ作成失敗: ${creativeData.error.message}` };
    }
    const creativeId = creativeData.id;

    // 4. 広告作成
    await fetch(
      `https://graph.facebook.com/${API_VERSION}/${accountId}/ads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${input.name} - Ad`,
          adset_id: adSetId,
          creative: { creative_id: creativeId },
          status: 'PAUSED',
          access_token: accessToken,
        }),
      },
    );

    return { success: true, campaignId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Meta Ads APIエラー' };
  }
};
