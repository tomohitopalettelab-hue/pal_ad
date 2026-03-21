import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-ad-store';

// Indeed OAuth 2.0 callback
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectBase = `${appUrl}/admin`;

  if (error || !code) {
    const msg = encodeURIComponent(error || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?indeed_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('indeed_oauth_state')?.value;
  const paletteId = cookieStore.get('indeed_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?indeed_error=${encodeURIComponent('不正なリクエストです。')}`);
  }

  cookieStore.delete('indeed_oauth_state');
  cookieStore.delete('indeed_oauth_palette_id');

  const clientId = process.env.INDEED_CLIENT_ID!;
  const clientSecret = process.env.INDEED_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/indeed/callback`;

  try {
    const tokenRes = await fetch('https://apis.indeed.com/oauth/v2/tokens', {
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
      throw new Error(tokenData.error_description || 'Indeed認証に失敗しました。');
    }

    await upsertSettings(paletteId, {
      indeedConnected: true,
      indeedAccessToken: tokenData.access_token,
      indeedRefreshToken: tokenData.refresh_token || undefined,
    });

    return NextResponse.redirect(
      `${redirectBase}?indeed_connected=1&paletteId=${encodeURIComponent(paletteId)}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Indeed連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?indeed_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
