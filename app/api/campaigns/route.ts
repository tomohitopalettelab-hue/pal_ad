import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { getCampaignsByPaletteId, createCampaign, spendFromWallet } from '../_lib/pal-ad-store';
import { generateMockCopies, calculateAllocation, type CampaignGoal, type ChannelId, type ChannelCopy } from '../_lib/mock-data';

const GOAL_LABELS: Record<CampaignGoal, string> = {
  visit: '来店促進',
  friends: 'LINE友だち獲得',
  recruit: 'スタッフ募集',
};

const CHANNEL_CONTEXT: Record<ChannelId, { name: string; tone: string; maxLen: number }> = {
  google: { name: 'Google広告', tone: 'ベネフィット・解決型', maxLen: 90 },
  instagram: { name: 'Instagram', tone: '映え・共感型', maxLen: 200 },
  tiktok: { name: 'TikTok', tone: 'バズり・トレンド型', maxLen: 150 },
  x: { name: 'X', tone: 'リアルタイム・拡散型', maxLen: 140 },
  youtube: { name: 'YouTube', tone: '認知・説得型', maxLen: 150 },
  indeed: { name: 'Indeed', tone: '求人訴求型', maxLen: 200 },
  line: { name: 'LINE広告', tone: '生活密着・お得型', maxLen: 150 },
};

async function generateAICopies(goal: CampaignGoal, channels: ChannelId[]): Promise<ChannelCopy[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY_API;
  if (!apiKey) return generateMockCopies(goal, channels);

  try {
    const openai = new OpenAI({ apiKey });
    const goalText = GOAL_LABELS[goal];

    const channelList = channels.map(ch => {
      const ctx = CHANNEL_CONTEXT[ch];
      return `- ${ctx.name} (channelId:"${ch}"): トーン=${ctx.tone}, body最大${ctx.maxLen}文字`;
    }).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'あなたは日本の店舗向け広告コピーライター。媒体ごとに最適化されたキャッチコピーをJSON配列で返す。日本語で書く。',
        },
        {
          role: 'user',
          content: `目的: ${goalText}\n媒体:\n${channelList}\n\nJSON配列を返して: [{"channelId":"xxx","headline":"最大30文字","body":"本文","cta":"最大10文字"},...]`,
        },
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : (parsed.copies || parsed.results || parsed.data || []);
    const copies: ChannelCopy[] = arr.map((item: Record<string, string>) => ({
      channelId: item.channelId as ChannelId,
      headline: String(item.headline || ''),
      body: String(item.body || ''),
      cta: String(item.cta || ''),
    }));

    // 欠けているチャネルをモックで補完
    const generated = new Set(copies.map(c => c.channelId));
    const missing = channels.filter(ch => !generated.has(ch));
    if (missing.length > 0) copies.push(...generateMockCopies(goal, missing));

    return copies;
  } catch {
    return generateMockCopies(goal, channels);
  }
}

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
    const copies = await generateAICopies(goal, channels);
    const destination = body.destination || { type: 'url', url: '', label: '' };

    // ウォレットから予算を引き落とし
    const goalLabels: Record<string, string> = { visit: '来店促進', friends: '友だち獲得', recruit: 'スタッフ募集' };
    const spendResult = await spendFromWallet(
      session.customerId,
      budget,
      `${goalLabels[goal] || goal}キャンペーン 広告費`,
    );

    const campaign = await createCampaign({
      paletteId: session.customerId,
      goal,
      channels,
      budget,
      periodDays,
      allocation,
      status: spendResult.success ? 'reviewing' : 'draft',
      copies,
      mediaUrls: [],
      videoJobId: null,
      destination,
      performance: [],
    });

    // 引き落とし成功時はtransactionにcampaignIdを紐付け
    if (spendResult.success && spendResult.transaction) {
      spendResult.transaction.campaignId = campaign.id;
    }

    return NextResponse.json({
      success: true,
      campaign,
      walletDeducted: spendResult.success,
      walletError: spendResult.error || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
