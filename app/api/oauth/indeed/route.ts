import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// Indeed OAuth 2.0
// https://developer.indeed.com/docs/authorization/
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paletteId = searchParams.get('paletteId') || '';

  const clientId = process.env.INDEED_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectUri = `${appUrl}/api/oauth/indeed/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'INDEED_CLIENT_ID が設定されていません。' }, { status: 500 });
  }
  if (!paletteId) {
    return NextResponse.json({ error: 'paletteId が必要です。' }, { status: 400 });
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('indeed_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });
  cookieStore.set('indeed_oauth_palette_id', paletteId, { httpOnly: true, maxAge: 600, path: '/', sameSite: 'lax' });

  const url = new URL('https://secure.indeed.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'employer_access');

  return NextResponse.redirect(url.toString());
}
