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
    return NextResponse.redirect(`${redirectBase}?gads_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('gads_oauth_state')?.value;
  const paletteId = cookieStore.get('gads_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?gads_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  cookieStore.delete('gads_oauth_state');
  cookieStore.delete('gads_oauth_palette_id');

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  try {
    // アクセストークン + リフレッシュトークン取得
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Google認証に失敗しました。');
    }

    // Google Ads アカウント一覧取得（REST API）
    let customerIds: string[] = [];
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (devToken) {
      try {
        const customersRes = await fetch(
          'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'developer-token': devToken,
            },
          }
        );
        const customersData = await customersRes.json();
        customerIds = (customersData.resourceNames || []).map((r: string) => r.replace('customers/', ''));
      } catch {
        // 開発者トークンがない or エラーの場合はスキップ
      }
    }

    // 設定保存
    await upsertSettings(paletteId, {
      googleConnected: true,
      googleAccessToken: tokenData.access_token,
      googleRefreshToken: tokenData.refresh_token || undefined,
      googleAdCustomerId: customerIds[0] || undefined,
    });

    return NextResponse.redirect(
      `${redirectBase}?gads_connected=1&paletteId=${encodeURIComponent(paletteId)}&accounts=${customerIds.length}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Google Ads連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?gads_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
