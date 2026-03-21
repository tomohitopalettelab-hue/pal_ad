import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// X (Twitter) Ads API OAuth 2.0
// https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.X_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectUri = `${appUrl}/api/oauth/x/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'X_CLIENT_ID が設定されていません。' }, { status: 500 });
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  const state = randomUUID();
  const codeVerifier = randomUUID() + randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('x_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('x_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('x_oauth_verifier', codeVerifier, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  // PKCE: code_challenge = code_verifier (plain method)
  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'tweet.read users.read ads.read ads.write offline.access');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeVerifier);
  url.searchParams.set('code_challenge_method', 'plain');

  return NextResponse.redirect(url.toString());
}
