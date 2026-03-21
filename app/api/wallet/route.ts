import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getWalletBalance, getTransactionsDb, chargeWalletDb, spendFromWalletDb } from '../_lib/pal-ad-wallet-db';

// GET /api/wallet — 残高と取引履歴を取得
export async function GET(req: Request) {
  try {
    const store = await cookies();
    const mainSession = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    const adminSession = parseSessionValue(store.get(SESSION_COOKIE_NAME)?.value);
    const session = mainSession || adminSession;
    if (!session || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paletteId = searchParams.get('paletteId') || session.customerId || '';
    if (!paletteId) {
      return NextResponse.json({ success: false, error: 'paletteId が必要です' }, { status: 400 });
    }

    const balance = await getWalletBalance(paletteId);
    const transactions = await getTransactionsDb(paletteId, 50);

    const totalCharged = transactions.filter(t => t.type === 'charge').reduce((s, t) => s + t.amount, 0);
    const totalSpent = transactions.filter(t => t.type === 'spend').reduce((s, t) => s + Math.abs(t.amount), 0);

    return NextResponse.json({
      success: true,
      wallet: { balance, totalCharged, totalSpent },
      transactions,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/wallet — チャージまたは引き落とし
export async function POST(req: Request) {
  try {
    const store = await cookies();
    const mainSession = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    const adminSession = parseSessionValue(store.get(SESSION_COOKIE_NAME)?.value);
    const session = mainSession || adminSession;
    if (!session || isExpired(session)) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action as 'charge' | 'spend';
    const paletteId = body.paletteId || session.customerId || '';
    const amount = Number(body.amount);
    const description = body.description || '';
    const campaignId = body.campaignId;
    const squarePaymentId = body.squarePaymentId;

    if (!paletteId || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'paletteId と正の金額が必要です' }, { status: 400 });
    }

    if (action === 'charge') {
      const result = await chargeWalletDb(paletteId, amount, description, squarePaymentId);
      return NextResponse.json({ success: true, balance: result.balance, transactionId: result.transactionId });
    }

    if (action === 'spend') {
      const result = await spendFromWalletDb(paletteId, amount, description, campaignId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, balance: result.balance, transactionId: result.transactionId });
    }

    return NextResponse.json({ success: false, error: 'action は "charge" または "spend" を指定してください' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
