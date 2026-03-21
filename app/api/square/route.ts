import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { chargeWalletDb } from '../_lib/pal-ad-wallet-db';

// Square Web Payments SDK を使ったチャージフロー
// POST /api/square — Square決済後にウォレットにチャージ
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
    const sourceId = body.sourceId; // Square Web Payments SDK から取得した nonce
    const amount = Number(body.amount);
    const paletteId = body.paletteId || session.customerId || '';

    if (!sourceId || !amount || amount <= 0 || !paletteId) {
      return NextResponse.json({ success: false, error: '決済情報が不足しています' }, { status: 400 });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    const baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    if (!accessToken || !locationId) {
      return NextResponse.json({ success: false, error: 'Square設定が未構成です' }, { status: 500 });
    }

    // Square Payments API で決済を実行
    const paymentRes = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: `pal_ad_${paletteId}_${Date.now()}`,
        amount_money: {
          amount: amount, // 日本円はそのまま（小数点なし）
          currency: 'JPY',
        },
        location_id: locationId,
        note: `Pal Ad ウォレットチャージ (${paletteId})`,
      }),
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok || paymentData.errors) {
      const errorMsg = paymentData.errors?.[0]?.detail || 'Square決済に失敗しました';
      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const payment = paymentData.payment;
    const squarePaymentId = payment?.id || '';

    // ウォレットにチャージ
    const chargeResult = await chargeWalletDb(
      paletteId,
      amount,
      `Square決済チャージ (${squarePaymentId.slice(-8)})`,
      squarePaymentId,
    );

    return NextResponse.json({
      success: true,
      balance: chargeResult.balance,
      transactionId: chargeResult.transactionId,
      squarePaymentId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/square — Square設定情報（フロントエンド用）
export async function GET() {
  const appId = process.env.SQUARE_APPLICATION_ID || '';
  const locationId = process.env.SQUARE_LOCATION_ID || '';
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';

  return NextResponse.json({
    appId,
    locationId,
    environment,
    configured: !!(appId && locationId),
  });
}
