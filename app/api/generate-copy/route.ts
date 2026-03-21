import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { generateMockCopies, type CampaignGoal, type ChannelId } from '../_lib/mock-data';

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
    const goal = body.goal as CampaignGoal;
    const channels = body.channels as ChannelId[];

    if (!goal || !channels?.length) {
      return NextResponse.json({ success: false, error: '目的と媒体を指定してください' }, { status: 400 });
    }

    // Phase 1: モックコピー生成
    // Phase 2: OpenAI / Google Gemini でAI生成に置き換え
    const copies = generateMockCopies(goal, channels);

    return NextResponse.json({ success: true, copies });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
