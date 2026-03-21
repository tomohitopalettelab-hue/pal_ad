import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-ad-store';

// X (Twitter) OAuth 2.0 callback
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectBase = `${appUrl}/admin`;

  if (error || !code) {
    const msg = encodeURIComponent(error || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?x_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('x_oauth_state')?.value;
  const paletteId = cookieStore.get('x_oauth_palette_id')?.value || '';
  const codeVerifier = cookieStore.get('x_oauth_verifier')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?x_error=${encodeURIComponent('不正なリクエストです。')}`);
  }

  cookieStore.delete('x_oauth_state');
  cookieStore.delete('x_oauth_palette_id');
  cookieStore.delete('x_oauth_verifier');

  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/x/callback`;

  try {
    // アクセストークン取得
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(tokenData.error_description || 'X認証に失敗しました。');
    }

    await upsertSettings(paletteId, {
      xConnected: true,
      xAccessToken: tokenData.access_token,
      xRefreshToken: tokenData.refresh_token || undefined,
    });

    return NextResponse.redirect(
      `${redirectBase}?x_connected=1&paletteId=${encodeURIComponent(paletteId)}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'X連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?x_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
