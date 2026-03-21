import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getCampaignsByPaletteId, createCampaign } from '../_lib/pal-ad-store';
import { generateMockCopies, calculateAllocation, type CampaignGoal, type ChannelId } from '../_lib/mock-data';

export async function GET() {
  try {
    const store = await cookies();
    const session = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'customer' || isExpired(session) || !session.customerId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const campaigns = await getCampaignsByPaletteId(session.customerId, 20);
    return NextResponse.json({ success: true, campaigns });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const store = await cookies();
    const session = parseSessionValue(store.get(MAIN_SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'customer' || isExpired(session) || !session.customerId) {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const body = await req.json();
    const goal = body.goal as CampaignGoal;
    const channels = body.channels as ChannelId[];
    const budget = Number(body.budget) || 50000;
    const periodDays = Number(body.periodDays) || 30;

    if (!goal || !channels?.length) {
      return NextResponse.json({ success: false, error: '目的と媒体を指定してください' }, { status: 400 });
    }

    const allocation = calculateAllocation(channels, budget);
    const copies = generateMockCopies(goal, channels);
    const destination = body.destination || { type: 'url', url: '', label: '' };

    const campaign = await createCampaign({
      paletteId: session.customerId,
      goal,
      channels,
      budget,
      periodDays,
      allocation,
      status: 'draft',
      copies,
      mediaUrls: [],
      videoJobId: null,
      destination,
      performance: [],
    });

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
