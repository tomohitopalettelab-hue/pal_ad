import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { getCampaignsByPaletteId } from '../../_lib/pal-ad-store';

export async function GET(req: Request) {
  try {
    const store = await cookies();
    const session = parseSessionValue(store.get(SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'admin' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '管理者認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paletteId = searchParams.get('paletteId');
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です' }, { status: 400 });
    }

    const campaigns = await getCampaignsByPaletteId(paletteId, 50);
    return NextResponse.json({ success: true, campaigns });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
