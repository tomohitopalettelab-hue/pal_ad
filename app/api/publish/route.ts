import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getCampaignById, updateCampaign, getSettingsByPaletteId } from '../_lib/pal-ad-store';
import { createGoogleAdsCampaign, type GoogleAdsCampaignInput } from '../_lib/google-ads-client';
import { createMetaAdsCampaign, type MetaAdsCampaignInput } from '../_lib/meta-ads-client';

const GOAL_OBJECTIVES: Record<string, string> = {
  visit: 'OUTCOME_TRAFFIC',
  friends: 'OUTCOME_LEADS',
  recruit: 'OUTCOME_TRAFFIC',
};

// POST /api/publish — キャンペーンを各媒体に配信
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const mainSession = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    const adminSession = parseSessionValue(store.get(SESSION_COOKIE_NAME)?.value);
    const session = mainSession || adminSession;
    if (!session || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const campaignId = body.campaignId;
    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId が必要です' }, { status: 400 });
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'キャンペーンが見つかりません' }, { status: 404 });
    }

    const settings = await getSettingsByPaletteId(campaign.paletteId);
    const results: Record<string, { success: boolean; platformCampaignId?: string; error?: string }> = {};

    // 配信先URL
    const finalUrl = campaign.destination?.url || 'https://palette-lab.com';

    // 日予算を計算
    const dailyBudget = Math.max(1, Math.round(campaign.budget / Math.max(1, campaign.periodDays)));

    // 開始日・終了日
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = new Date(Date.now() + campaign.periodDays * 86400000).toISOString().slice(0, 10);

    // ===== Google広告 =====
    if (campaign.channels.includes('google')) {
      const googleToken = (settings as Record<string, unknown>)?.googleAccessToken as string;
      const googleCustomerId = (settings as Record<string, unknown>)?.googleAdCustomerId as string;

      if (googleToken && googleCustomerId) {
        const googleCopy = campaign.copies.find(c => c.channelId === 'google');
        const input: GoogleAdsCampaignInput = {
          name: `Pal Ad - ${campaign.goal} - ${campaign.id}`,
          budgetAmountMicros: dailyBudget * 1000000,
          startDate,
          endDate,
          headlines: [
            googleCopy?.headline || '店舗広告',
            googleCopy?.cta || '詳しくはこちら',
            'お得な情報',
          ],
          descriptions: [
            googleCopy?.body || '地域密着の広告配信',
            'Palette Lab提供',
          ],
          finalUrl,
        };

        const googleResult = await createGoogleAdsCampaign(googleToken, googleCustomerId, input);
        results.google = {
          success: googleResult.success,
          platformCampaignId: googleResult.campaignId,
          error: googleResult.error,
        };
      } else {
        results.google = { success: false, error: 'Google Ads未接続です。管理画面から接続してください。' };
      }
    }

    // ===== Meta (Instagram/FB) =====
    if (campaign.channels.includes('instagram')) {
      const metaToken = (settings as Record<string, unknown>)?.metaAccessToken as string;
      const metaAdAccountId = (settings as Record<string, unknown>)?.metaAdAccountId as string;

      if (metaToken && metaAdAccountId) {
        const igCopy = campaign.copies.find(c => c.channelId === 'instagram');
        const input: MetaAdsCampaignInput = {
          name: `Pal Ad - ${campaign.goal} - ${campaign.id}`,
          objective: (GOAL_OBJECTIVES[campaign.goal] || 'OUTCOME_TRAFFIC') as MetaAdsCampaignInput['objective'],
          dailyBudget,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + campaign.periodDays * 86400000).toISOString(),
          headline: igCopy?.headline || '広告',
          body: igCopy?.body || '',
          linkUrl: finalUrl,
        };

        const metaResult = await createMetaAdsCampaign(metaToken, metaAdAccountId, input);
        results.instagram = {
          success: metaResult.success,
          platformCampaignId: metaResult.campaignId,
          error: metaResult.error,
        };
      } else {
        results.instagram = { success: false, error: 'Meta Ads未接続です。管理画面から接続してください。' };
      }
    }

    // ===== 未接続の媒体 =====
    for (const ch of campaign.channels) {
      if (!results[ch]) {
        results[ch] = { success: false, error: `${ch}の広告API連携は準備中です` };
      }
    }

    // キャンペーンステータスを更新
    const anySuccess = Object.values(results).some(r => r.success);
    await updateCampaign(campaignId, {
      status: anySuccess ? 'active' : campaign.status,
    });

    return NextResponse.json({
      success: true,
      results,
      publishedChannels: Object.entries(results).filter(([, r]) => r.success).map(([ch]) => ch),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
