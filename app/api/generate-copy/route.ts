import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { parseSessionValue, MAIN_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, isExpired } from '../../../lib/auth-session';
import { generateMockCopies, type CampaignGoal, type ChannelId, type ChannelCopy } from '../_lib/mock-data';

const GOAL_LABELS: Record<CampaignGoal, string> = {
  visit: '来店促進',
  friends: 'LINE友だち獲得',
  recruit: 'スタッフ募集',
};

const CHANNEL_CONTEXT: Record<ChannelId, { name: string; tone: string; maxLen: number }> = {
  google: { name: 'Google広告（検索/マップ/ディスプレイ）', tone: 'ベネフィット・解決型。検索意図に直結する具体的な訴求', maxLen: 90 },
  instagram: { name: 'Instagram（フィード/リール/ストーリーズ）', tone: '映え・共感型。ビジュアルを引き立てる短くエモーショナルな文体', maxLen: 200 },
  tiktok: { name: 'TikTok', tone: 'バズり・トレンド型。若者言葉OK、テンポよく、スワイプを止める冒頭', maxLen: 150 },
  x: { name: 'X (Twitter)', tone: 'リアルタイム・拡散型。RT・引用したくなる共感や驚き、短文', maxLen: 140 },
  youtube: { name: 'YouTube（インストリーム/ショート）', tone: '認知・説得型。最初の5秒で惹きつけ、ストーリー性を持たせる', maxLen: 150 },
  indeed: { name: 'Indeed / 求人BOX', tone: '求人訴求型。条件を明確に、未経験歓迎・待遇を前面に', maxLen: 200 },
  line: { name: 'LINE広告（トークリスト/ニュース）', tone: '生活密着・お得型。クーポンや限定感でタップを誘導', maxLen: 150 },
};

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
    const businessType = body.businessType || '店舗';
    const businessName = body.businessName || '';
    const keywords = body.keywords || '';

    if (!goal || !channels?.length) {
      return NextResponse.json({ success: false, error: '目的と媒体を指定してください' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY_API;
    if (!apiKey) {
      // フォールバック: モックコピー
      const copies = generateMockCopies(goal, channels);
      return NextResponse.json({ success: true, copies, source: 'mock' });
    }

    const openai = new OpenAI({ apiKey });
    const goalText = GOAL_LABELS[goal];

    const channelInstructions = channels.map(ch => {
      const ctx = CHANNEL_CONTEXT[ch];
      return `
### ${ctx.name} (channelId: "${ch}")
- トーン: ${ctx.tone}
- headline: 最大30文字。目を引く一行
- body: 最大${ctx.maxLen}文字。媒体のトーンに合わせた本文
- cta: 最大10文字。行動を促すボタンテキスト`;
    }).join('\n');

    const systemPrompt = `あなたは日本の店舗向け広告コピーライターです。
与えられた広告目的と媒体ごとに、最適化されたキャッチコピーを生成してください。

## ルール
- 日本語で書く
- 各媒体の特性に合わせてトーンを変える
- 具体的で行動を促す文言にする
- 絵文字は控えめに（1〜2個まで）
- JSONで返す。余計なテキストは不要`;

    const userPrompt = `## 広告情報
- 目的: ${goalText}
- 業種: ${businessType}${businessName ? `（${businessName}）` : ''}${keywords ? `\n- キーワード: ${keywords}` : ''}

## 生成対象の媒体
${channelInstructions}

## 出力形式
以下のJSON配列を返してください:
[
  { "channelId": "xxx", "headline": "...", "body": "...", "cta": "..." },
  ...
]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    let copies: ChannelCopy[];

    try {
      const parsed = JSON.parse(content);
      // response_format: json_object だとルートオブジェクトが返る場合がある
      const arr = Array.isArray(parsed) ? parsed : (parsed.copies || parsed.results || parsed.data || []);
      copies = arr.map((item: Record<string, string>) => ({
        channelId: item.channelId as ChannelId,
        headline: String(item.headline || ''),
        body: String(item.body || ''),
        cta: String(item.cta || ''),
      }));

      // 欠けているチャネルがあればモックで補完
      const generatedIds = new Set(copies.map(c => c.channelId));
      const missing = channels.filter(ch => !generatedIds.has(ch));
      if (missing.length > 0) {
        copies.push(...generateMockCopies(goal, missing));
      }
    } catch {
      // JSON パース失敗時はモックにフォールバック
      copies = generateMockCopies(goal, channels);
      return NextResponse.json({ success: true, copies, source: 'mock' });
    }

    return NextResponse.json({ success: true, copies, source: 'openai' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました';
    // エラー時もモックで返す
    try {
      const body = await req.clone().json().catch(() => ({}));
      const copies = generateMockCopies(body.goal, body.channels || []);
      return NextResponse.json({ success: true, copies, source: 'mock', warning: message });
    } catch {
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }
}
