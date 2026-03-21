import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-ad-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectBase = `${appUrl}/admin`;

  if (error || !code) {
    const msg = encodeURIComponent(error || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?line_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('line_oauth_state')?.value;
  const paletteId = cookieStore.get('line_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?line_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  cookieStore.delete('line_oauth_state');
  cookieStore.delete('line_oauth_palette_id');

  const clientId = process.env.LINE_ADS_CLIENT_ID || process.env.LINE_CHANNEL_ID || '';
  const clientSecret = process.env.LINE_ADS_CLIENT_SECRET || process.env.LINE_CHANNEL_SECRET || '';
  const redirectUri = `${appUrl}/api/oauth/line/callback`;

  try {
    // アクセストークン取得
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'LINE認証に失敗しました。');
    }

    // プロフィール取得
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    // 設定保存
    await upsertSettings(paletteId, {
      lineConnected: true,
      lineAccessToken: tokenData.access_token,
      lineRefreshToken: tokenData.refresh_token || undefined,
      lineUserId: profile.userId || undefined,
    });

    const displayName = profile.displayName || 'connected';
    return NextResponse.redirect(
      `${redirectBase}?line_connected=1&paletteId=${encodeURIComponent(paletteId)}&line_user=${encodeURIComponent(displayName)}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'LINE連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?line_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
