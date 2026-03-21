import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertSettings } from '../../../_lib/pal-ad-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const fbError = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3105';
  const redirectBase = `${appUrl}/admin`;

  if (fbError || !code) {
    const msg = encodeURIComponent(fbError || '認可がキャンセルされました。');
    return NextResponse.redirect(`${redirectBase}?ig_error=${msg}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get('ig_oauth_state')?.value;
  const paletteId = cookieStore.get('ig_oauth_palette_id')?.value || '';

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${redirectBase}?ig_error=${encodeURIComponent('不正なリクエストです（state不一致）。')}`);
  }

  cookieStore.delete('ig_oauth_state');
  cookieStore.delete('ig_oauth_palette_id');

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

  try {
    // 短命トークン取得
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString()
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'アクセストークンの取得に失敗しました。');
    }

    // 長命トークン（60日）に交換
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: tokenData.access_token,
        }).toString()
    );
    const longTokenData = await longTokenRes.json();
    const longToken = longTokenData.access_token || tokenData.access_token;

    // 広告アカウント取得
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?` +
        new URLSearchParams({ fields: 'id,name,account_status', access_token: longToken }).toString()
    );
    const adAccountsData = await adAccountsRes.json();
    const adAccounts = adAccountsData.data || [];

    // IGビジネスアカウント取得
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?` +
        new URLSearchParams({
          fields: 'id,name,instagram_business_account{id,name,username}',
          access_token: longToken,
        }).toString()
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];
    const igAccounts = pages
      .filter((p: Record<string, unknown>) => (p.instagram_business_account as Record<string, unknown>)?.id)
      .map((p: Record<string, unknown>) => {
        const ig = p.instagram_business_account as Record<string, string>;
        return { pageId: p.id, pageName: p.name, igId: ig.id, igName: ig.username || ig.name };
      });

    // 設定保存
    const settings: Record<string, unknown> = { metaConnected: true };
    if (longToken) settings.metaAccessToken = longToken;
    if (adAccounts.length > 0) settings.metaAdAccountId = adAccounts[0].id;
    if (igAccounts.length > 0) {
      settings.igBusinessAccountId = igAccounts[0].igId;
    }

    await upsertSettings(paletteId, settings);

    const igUser = igAccounts[0]?.igName || 'connected';
    const adCount = adAccounts.length;
    return NextResponse.redirect(
      `${redirectBase}?ig_connected=1&paletteId=${encodeURIComponent(paletteId)}&ig_user=${encodeURIComponent(igUser)}&ad_accounts=${adCount}`
    );
  } catch (err: unknown) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : 'Meta連携に失敗しました。');
    return NextResponse.redirect(`${redirectBase}?ig_error=${msg}&paletteId=${encodeURIComponent(paletteId)}`);
  }
}
