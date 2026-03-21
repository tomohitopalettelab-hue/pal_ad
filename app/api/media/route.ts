import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { buildPalDbUrl } from '../_lib/pal-db-client';

export async function GET(req: Request) {
  try {
    const store = await cookies();
    const session = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'customer' || isExpired(session) || !session.customerId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const url = buildPalDbUrl(`/api/media?paletteId=${encodeURIComponent(session.customerId)}`);
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
