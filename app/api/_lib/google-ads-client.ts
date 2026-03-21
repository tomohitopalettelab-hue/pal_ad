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
