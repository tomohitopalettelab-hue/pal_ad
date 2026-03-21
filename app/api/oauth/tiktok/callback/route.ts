import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-ad-store';

// TikTok OAuth callback
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const authCode = searchParams.get('auth_code');
  const state = searchParams.get('state');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectBase = `${appUrl}/admin`;

  if (!authCode) {
    const msg = encodeURIComponent('TikTok認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?tt_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('tt_oauth_state')?.value;
  const paletteId = cookieStore.get('tt_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?tt_error=${encodeURIComponent('不正なリクエストです。')}`);
  }

  cookieStore.delete('tt_oauth_state');
  cookieStore.delete('tt_oauth_palette_id');

  const appId = process.env.TIKTOK_APP_ID!;
  const appSecret = process.env.TIKTOK_APP_SECRET!;

  try {
    // アクセストークン取得
    const tokenRes = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: authCode }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.data?.access_token;

    if (!accessToken) {
      throw new Error(tokenData?.message || 'TikTokアクセストークンの取得に失敗しました。');
    }

    // 広告アカウント情報取得
    const advertiserIds = tokenData?.data?.advertiser_ids || [];

    await upsertSettings(paletteId, {
      tiktokConnected: true,
      tiktokAccessToken: accessToken,
      tiktokAdvertiserId: advertiserIds[0] || undefined,
    });

    return NextResponse.redirect(
      `${redirectBase}?tt_connected=1&paletteId=${encodeURIComponent(paletteId)}&accounts=${advertiserIds.length}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'TikTok連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?tt_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
