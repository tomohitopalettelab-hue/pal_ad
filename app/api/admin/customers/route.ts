import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, SESSION_COOKIE_NAME, isExpired } from '../../../../lib/auth-session';
import { listPalAdAccountsFromPalDb } from '../../_lib/pal-ad-accounts';

export async function GET() {
  try {
    const store = await cookies();
    const session = parseSessionValue(store.get(SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'admin' || isExpired(session)) {
      return NextResponse.json({ success: false, error: '管理者認証が必要です' }, { status: 401 });
    }

    const accounts = await listPalAdAccountsFromPalDb();
    return NextResponse.json({ success: true, accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
