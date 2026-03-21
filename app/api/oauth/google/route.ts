import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectUri = `${appUrl}/api/oauth/google/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID が設定されていません。' }, { status: 500 });
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('gads_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('gads_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const scope = [
    'https://www.googleapis.com/auth/adwords',
  ].join(' ');

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(url.toString());
}
