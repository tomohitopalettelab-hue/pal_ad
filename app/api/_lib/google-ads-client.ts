// Google Ads API REST client
// https://developers.google.com/google-ads/api/rest/overview

const API_VERSION = 'v17';

type GoogleAdsConfig = {
  accessToken: string;
  developerToken: string;
  customerId: string; // 数字のみ（ハイフンなし）
  managerCustomerId?: string;
};

const getConfig = (accessToken: string, customerId: string): GoogleAdsConfig => ({
  accessToken,
  developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
  customerId: customerId.replace(/-/g, ''),
  managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID?.replace(/-/g, ''),
});

const apiCall = async (config: GoogleAdsConfig, endpoint: string, body: unknown) => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.accessToken}`,
    'developer-token': config.developerToken,
    'Content-Type': 'application/json',
  };
  if (config.managerCustomerId) {
    headers['login-customer-id'] = config.managerCustomerId;
  }

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${config.customerId}/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
};

// ===== キャンペーン作成フロー =====

export type GoogleAdsCampaignInput = {
  name: string;
  budgetAmountMicros: number; // 予算（マイクロ単位: 1円 = 1,000,000）
  startDate: string; // YYYY-MM-DD
  endDate: string;
  headlines: string[]; // 最大15個
  descriptions: string[]; // 最大4個
  finalUrl: string;
  targetLocationIds?: string[]; // ロケーションID
};

export const createGoogleAdsCampaign = async (
  accessToken: string,
  customerId: string,
  input: GoogleAdsCampaignInput,
): Promise<{ success: boolean; campaignId?: string; error?: string }> => {
  const config = getConfig(accessToken, customerId);

  try {
    // 1. キャンペーン予算を作成
    const budgetResult = await apiCall(config, 'campaignBudgets:mutate', {
      operations: [{
        create: {
          name: `${input.name} Budget`,
          amountMicros: String(input.budgetAmountMicros),
          deliveryMethod: 'STANDARD',
        },
      }],
    });

    if (budgetResult.error) {
      return { success: false, error: budgetResult.error?.message || 'キャンペーン予算の作成に失敗しました' };
    }
    const budgetResourceName = budgetResult.results?.[0]?.resourceName;
    if (!budgetResourceName) {
      return { success: false, error: 'キャンペーン予算のリソース名が取得できませんでした' };
    }

    // 2. キャンペーンを作成
    const campaignResult = await apiCall(config, 'campaigns:mutate', {
      operations: [{
        create: {
          name: input.name,
          advertisingChannelType: 'SEARCH',
          status: 'PAUSED', // まず一時停止で作成
          campaignBudget: budgetResourceName,
          startDate: input.startDate.replace(/-/g, ''),
          endDate: input.endDate.replace(/-/g, ''),
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: true,
            targetContentNetwork: false,
          },
        },
      }],
    });

    if (campaignResult.error) {
      return { success: false, error: campaignResult.error?.message || 'キャンペーンの作成に失敗しました' };
    }
    const campaignResourceName = campaignResult.results?.[0]?.resourceName;
    if (!campaignResourceName) {
      return { success: false, error: 'キャンペーンのリソース名が取得できませんでした' };
    }

    // 3. 広告グループを作成
    const adGroupResult = await apiCall(config, 'adGroups:mutate', {
      operations: [{
        create: {
          name: `${input.name} - Ad Group`,
          campaign: campaignResourceName,
          type: 'SEARCH_STANDARD',
          status: 'ENABLED',
          cpcBidMicros: '1000000', // ¥1 CPC
        },
      }],
    });

    if (adGroupResult.error) {
      return { success: false, error: adGroupResult.error?.message || '広告グループの作成に失敗しました' };
    }
    const adGroupResourceName = adGroupResult.results?.[0]?.resourceName;

    // 4. レスポンシブ検索広告を作成
    if (adGroupResourceName) {
      const headlines = input.headlines.slice(0, 15).map((text, i) => ({
        text: text.slice(0, 30),
        pinnedField: i === 0 ? 'HEADLINE_1' : undefined,
      }));
      const descriptions = input.descriptions.slice(0, 4).map(text => ({
        text: text.slice(0, 90),
      }));

      await apiCall(config, 'adGroupAds:mutate', {
        operations: [{
          create: {
            adGroup: adGroupResourceName,
            status: 'ENABLED',
            ad: {
              responsiveSearchAd: {
                headlines,
                descriptions,
              },
              finalUrls: [input.finalUrl],
            },
          },
        }],
      });
    }

    // キャンペーンIDを抽出
    const campaignId = campaignResourceName.split('/').pop() || '';

    return { success: true, campaignId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Google Ads APIエラー' };
  }
};

// ===== YouTube動画キャンペーン作成フロー =====

export type GoogleAdsVideoCampaignInput = {
  name: string;
  budgetAmountMicros: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  videoUrl: string; // YouTube動画URL
  headline: string;
  description: string;
  finalUrl: string;
  companionBannerUrl?: string;
  targetLocationIds?: string[];
};

// YouTube URLからVideo IDを抽出
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

export const createGoogleAdsVideoCampaign = async (
  accessToken: string,
  customerId: string,
  input: GoogleAdsVideoCampaignInput,
): Promise<{ success: boolean; campaignId?: string; error?: string }> => {
  const config = getConfig(accessToken, customerId);

  try {
    // 1. キャンペーン予算を作成
    const budgetResult = await apiCall(config, 'campaignBudgets:mutate', {
      operations: [{
        create: {
          name: `${input.name} Budget`,
          amountMicros: String(input.budgetAmountMicros),
          deliveryMethod: 'STANDARD',
        },
      }],
    });

    if (budgetResult.error) {
      return { success: false, error: budgetResult.error?.message || '予算の作成に失敗' };
    }
    const budgetResourceName = budgetResult.results?.[0]?.resourceName;
    if (!budgetResourceName) {
      return { success: false, error: '予算リソース名が取得できません' };
    }

    // 2. VIDEOキャンペーンを作成
    const campaignResult = await apiCall(config, 'campaigns:mutate', {
      operations: [{
        create: {
          name: input.name,
          advertisingChannelType: 'VIDEO',
          status: 'PAUSED',
          campaignBudget: budgetResourceName,
          startDate: input.startDate.replace(/-/g, ''),
          endDate: input.endDate.replace(/-/g, ''),
          videoBrandSafetySuitability: 'EXPANDED_INVENTORY',
        },
      }],
    });

    if (campaignResult.error) {
      return { success: false, error: campaignResult.error?.message || 'VIDEOキャンペーンの作成に失敗' };
    }
    const campaignResourceName = campaignResult.results?.[0]?.resourceName;
    if (!campaignResourceName) {
      return { success: false, error: 'キャンペーンリソース名が取得できません' };
    }

    // 3. 動画広告グループを作成
    const adGroupResult = await apiCall(config, 'adGroups:mutate', {
      operations: [{
        create: {
          name: `${input.name} - Video Ad Group`,
          campaign: campaignResourceName,
          type: 'VIDEO_TRUE_VIEW_IN_STREAM',
          status: 'ENABLED',
          cpcBidMicros: '5000000', // ¥5 CPV
        },
      }],
    });

    if (adGroupResult.error) {
      return { success: false, error: adGroupResult.error?.message || '動画広告グループの作成に失敗' };
    }
    const adGroupResourceName = adGroupResult.results?.[0]?.resourceName;

    // 4. YouTube動画アセットを作成し、動画広告を入稿
    if (adGroupResourceName) {
      const videoId = extractYouTubeVideoId(input.videoUrl);
      if (!videoId) {
        return { success: false, error: 'YouTube動画URLが無効です' };
      }

      await apiCall(config, 'adGroupAds:mutate', {
        operations: [{
          create: {
            adGroup: adGroupResourceName,
            status: 'ENABLED',
            ad: {
              videoAd: {
                video: {
                  youtubeVideoId: videoId,
                },
                inStream: {
                  actionButtonLabel: input.headline.slice(0, 10),
                  actionHeadline: input.headline.slice(0, 15),
                },
              },
              finalUrls: [input.finalUrl],
              displayUrl: input.finalUrl.replace(/^https?:\/\//, '').slice(0, 35),
            },
          },
        }],
      });
    }

    const campaignId = campaignResourceName.split('/').pop() || '';
    return { success: true, campaignId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'YouTube広告APIエラー' };
  }
};

// ===== キャンペーンを有効化 =====
export const enableGoogleAdsCampaign = async (
  accessToken: string,
  customerId: string,
  campaignId: string,
): Promise<{ success: boolean; error?: string }> => {
  const config = getConfig(accessToken, customerId);
  const resourceName = `customers/${config.customerId}/campaigns/${campaignId}`;

  const result = await apiCall(config, 'campaigns:mutate', {
    operations: [{
      update: {
        resourceName,
        status: 'ENABLED',
      },
      updateMask: 'status',
    }],
  });

  if (result.error) {
    return { success: false, error: result.error?.message };
  }
  return { success: true };
};
