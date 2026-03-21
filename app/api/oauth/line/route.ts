import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.LINE_ADS_CLIENT_ID || process.env.LINE_CHANNEL_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectUri = `${appUrl}/api/oauth/line/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'LINE_ADS_CLIENT_ID が設定されていません。' }, { status: 500 });
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('line_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('line_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  // LINE Login v2.1 OAuth
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'profile openid');

  return NextResponse.redirect(url.toString());
}
