// ===== 型定義 =====

export type CampaignGoal = 'visit' | 'friends' | 'recruit';
export type CampaignStatus = 'draft' | 'reviewing' | 'active' | 'paused' | 'completed';
export type ChannelId = 'google' | 'instagram' | 'tiktok' | 'x' | 'youtube' | 'indeed' | 'line';

export type ChannelAllocation = {
  channelId: ChannelId;
  budget: number;
  percentage: number;
};

export type ChannelCopy = {
  channelId: ChannelId;
  headline: string;
  body: string;
  cta: string;
};

export type DailyPerformance = {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
};

export type DestinationType = 'url' | 'pal_studio' | 'line' | 'phone' | 'map';

export type CampaignDestination = {
  type: DestinationType;
  url?: string;
  label: string;
};

export type Campaign = {
  id: string;
  paletteId: string;
  goal: CampaignGoal;
  channels: ChannelId[];
  budget: number;
  periodDays: number;
  allocation: ChannelAllocation[];
  status: CampaignStatus;
  copies: ChannelCopy[];
  mediaUrls: string[];
  videoJobId: string | null;
  destination: CampaignDestination;
  performance: DailyPerformance[];
  createdAt: string;
  updatedAt: string;
};

export type AdSettings = {
  id: string;
  paletteId: string;
  walletBalance: number;
  googleConnected: boolean;
  metaConnected: boolean;
  tiktokConnected: boolean;
  xConnected: boolean;
  indeedConnected: boolean;
  lineConnected: boolean;
  createdAt: string;
  updatedAt: string;
};

// ===== チャネル情報 =====

export type ChannelInfo = {
  id: ChannelId;
  name: string;
  nameEn: string;
  description: string;
  strength: string;
  format: string;
  color: string;
  icon: string;
};

export const CHANNELS: ChannelInfo[] = [
  {
    id: 'google',
    name: 'Google広告',
    nameEn: 'Google Ads',
    description: 'マップ・検索・ディスプレイ',
    strength: '「今、近くで店を探している」層',
    format: 'マップピン・検索広告',
    color: '#4285F4',
    icon: 'MapPin',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    nameEn: 'Instagram',
    description: 'フィード・リール動画',
    strength: '「ビジュアルで欲しくなる」層',
    format: 'フィード・リール・ストーリーズ',
    color: '#E4405F',
    icon: 'Instagram',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    nameEn: 'TikTok',
    description: '縦型フルスクリーン動画',
    strength: '「流行に敏感な若年層・爆発力」',
    format: 'インフィード動画',
    color: '#000000',
    icon: 'Play',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    nameEn: 'X',
    description: 'プロモポスト',
    strength: '「リアルタイム性・二次拡散」',
    format: 'プロモツイート・トレンド',
    color: '#1DA1F2',
    icon: 'MessageCircle',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    nameEn: 'YouTube',
    description: 'インストリーム動画',
    strength: '「テレビ代わりの視聴・高認知」',
    format: 'インストリーム・ショート',
    color: '#FF0000',
    icon: 'Youtube',
  },
  {
    id: 'indeed',
    name: 'Indeed / 求人BOX',
    nameEn: 'Indeed',
    description: '採用テキスト・バナー',
    strength: '「仕事を探している」層',
    format: 'テキスト・バナー広告',
    color: '#2164F3',
    icon: 'Briefcase',
  },
  {
    id: 'line',
    name: 'LINE広告',
    nameEn: 'LINE Ads',
    description: 'トークリスト・ニュース',
    strength: '「全世代の生活動線」',
    format: 'トークリスト・ニュースタブ',
    color: '#06C755',
    icon: 'MessageSquare',
  },
];

// ===== 目的プリセット =====

export type GoalInfo = {
  id: CampaignGoal;
  label: string;
  description: string;
  icon: string;
  recommendedChannels: ChannelId[];
};

export const GOALS: GoalInfo[] = [
  {
    id: 'visit',
    label: '来店を増やす',
    description: '近隣の潜在顧客に店舗を認知させ、実際の来店につなげます。',
    icon: 'Store',
    recommendedChannels: ['google', 'instagram', 'line'],
  },
  {
    id: 'friends',
    label: '友だちを増やす',
    description: 'LINE公式アカウントの友だち登録を促進し、リピート顧客を育成します。',
    icon: 'Users',
    recommendedChannels: ['instagram', 'tiktok', 'line'],
  },
  {
    id: 'recruit',
    label: 'スタッフを募集する',
    description: '求職者に効率よくリーチし、応募数を最大化します。',
    icon: 'UserPlus',
    recommendedChannels: ['indeed', 'instagram', 'x'],
  },
];

// ===== ターゲットペルソナ =====

export type PersonaPreset = {
  id: string;
  label: string;
  ageRange: string;
  gender: string;
  interests: string[];
};

export const PERSONA_PRESETS: PersonaPreset[] = [
  { id: 'housewife', label: '主婦層', ageRange: '30-50', gender: '女性', interests: ['料理', '子育て', '家事', '節約'] },
  { id: 'salaryman', label: 'サラリーマン', ageRange: '25-55', gender: '男性', interests: ['ビジネス', 'ランチ', '健康'] },
  { id: 'genz', label: 'Z世代', ageRange: '18-27', gender: '全性別', interests: ['SNS', 'トレンド', 'エンタメ'] },
  { id: 'jobseeker', label: '求職者', ageRange: '18-45', gender: '全性別', interests: ['転職', '副業', 'キャリア'] },
];

// ===== モックコピー生成結果 =====

export const generateMockCopies = (goal: CampaignGoal, channels: ChannelId[]): ChannelCopy[] => {
  const goalLabels: Record<CampaignGoal, string> = {
    visit: '来店促進',
    friends: '友だち獲得',
    recruit: 'スタッフ募集',
  };
  const goalText = goalLabels[goal];

  const templates: Record<ChannelId, (g: string) => ChannelCopy> = {
    google: (g) => ({
      channelId: 'google',
      headline: `【${g}】お近くの人気店`,
      body: '地元で愛される当店の魅力を体験してください。初回限定の特別割引も実施中！',
      cta: '経路を表示',
    }),
    instagram: (g) => ({
      channelId: 'instagram',
      headline: `${g}キャンペーン実施中`,
      body: '映える店内と、こだわりのメニュー。フォロー＆いいねで特典GET。プロフィールのリンクから詳細をチェック',
      cta: '詳しくはこちら',
    }),
    tiktok: (g) => ({
      channelId: 'tiktok',
      headline: `【話題沸騰】${g}`,
      body: '今バズってるこのお店、知ってる？ 一度行ったらリピ確定。スワイプで詳細をチェック！',
      cta: '今すぐチェック',
    }),
    x: (g) => ({
      channelId: 'x',
      headline: `${g}のお知らせ`,
      body: `当店では${g}のための特別キャンペーンを実施中。RTで参加できるプレゼント企画も。詳細はリプ欄へ`,
      cta: '詳細を見る',
    }),
    youtube: (g) => ({
      channelId: 'youtube',
      headline: `${g}動画CM`,
      body: '「ここに来てよかった」そう思える瞬間を、15秒の動画でお届けします。',
      cta: 'チャンネル登録',
    }),
    indeed: (g) => ({
      channelId: 'indeed',
      headline: `【急募】${g}`,
      body: '未経験歓迎・週2日〜OK！アットホームな職場で一緒に働きませんか？交通費支給・まかない付き。',
      cta: '応募する',
    }),
    line: (g) => ({
      channelId: 'line',
      headline: `${g}｜LINE限定`,
      body: 'LINE友だち追加で、今すぐ使えるクーポンをプレゼント。お得な情報を見逃さないで！',
      cta: '友だち追加',
    }),
  };

  return channels.map((ch) => templates[ch](goalText));
};

// ===== モック予算配分 =====

export const calculateAllocation = (channels: ChannelId[], totalBudget: number): ChannelAllocation[] => {
  if (channels.length === 0) return [];
  const basePercent = Math.floor(100 / channels.length);
  const remainder = 100 - basePercent * channels.length;
  return channels.map((ch, i) => {
    const percentage = basePercent + (i < remainder ? 1 : 0);
    return {
      channelId: ch,
      budget: Math.round(totalBudget * percentage / 100),
      percentage,
    };
  });
};

// ===== モックパフォーマンスデータ =====

const generateMockPerformance = (days: number): DailyPerformance[] => {
  const result: DailyPerformance[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push({
      date: d.toISOString().slice(0, 10),
      impressions: Math.floor(Math.random() * 5000) + 500,
      clicks: Math.floor(Math.random() * 300) + 20,
      conversions: Math.floor(Math.random() * 15) + 1,
      spend: Math.floor(Math.random() * 3000) + 500,
    });
  }
  return result;
};

// ===== 遷移先プリセット =====

export type DestinationPreset = {
  type: DestinationType;
  label: string;
  description: string;
  icon: string;
  placeholder?: string;
};

export const DESTINATION_PRESETS: DestinationPreset[] = [
  { type: 'url', label: '外部URL', description: 'ホームページやLP（ランディングページ）へ誘導', icon: 'ExternalLink', placeholder: 'https://example.com' },
  { type: 'pal_studio', label: 'Pal Studio LP', description: 'Pal Studioで作成したページへ誘導', icon: 'Layout' },
  { type: 'line', label: 'LINE友だち追加', description: 'LINE公式アカウントの友だち追加ページへ', icon: 'MessageSquare', placeholder: 'https://lin.ee/xxxxx' },
  { type: 'phone', label: '電話をかける', description: '店舗へ直接電話を発信', icon: 'Phone', placeholder: '090-1234-5678' },
  { type: 'map', label: 'Googleマップ経路案内', description: '店舗への経路を表示', icon: 'MapPin', placeholder: 'https://maps.google.com/...' },
];

// ===== モックキャンペーン =====

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp_demo_001',
    paletteId: 'PAL-0001',
    goal: 'visit',
    channels: ['google', 'instagram', 'line'],
    budget: 100000,
    periodDays: 30,
    allocation: calculateAllocation(['google', 'instagram', 'line'], 100000),
    status: 'active',
    copies: generateMockCopies('visit', ['google', 'instagram', 'line']),
    mediaUrls: [],
    videoJobId: null,
    destination: { type: 'url', url: 'https://example.com/lp/visit', label: '来店キャンペーンLP' },
    performance: generateMockPerformance(14),
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
  },
  {
    id: 'cmp_demo_002',
    paletteId: 'PAL-0001',
    goal: 'friends',
    channels: ['instagram', 'tiktok'],
    budget: 50000,
    periodDays: 14,
    allocation: calculateAllocation(['instagram', 'tiktok'], 50000),
    status: 'completed',
    copies: generateMockCopies('friends', ['instagram', 'tiktok']),
    mediaUrls: [],
    videoJobId: null,
    destination: { type: 'line', url: 'https://lin.ee/demo123', label: 'LINE友だち追加' },
    performance: generateMockPerformance(14),
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'cmp_demo_003',
    paletteId: 'PAL-0001',
    goal: 'recruit',
    channels: ['indeed', 'x'],
    budget: 80000,
    periodDays: 30,
    allocation: calculateAllocation(['indeed', 'x'], 80000),
    status: 'draft',
    copies: generateMockCopies('recruit', ['indeed', 'x']),
    mediaUrls: [],
    videoJobId: null,
    destination: { type: 'url', url: 'https://example.com/recruit', label: '採用ページ' },
    performance: [],
    createdAt: '2026-03-18T00:00:00Z',
    updatedAt: '2026-03-18T00:00:00Z',
  },
];

// ===== モック設定 =====

export const MOCK_SETTINGS: AdSettings[] = [
  {
    id: 'set_demo_001',
    paletteId: 'PAL-0001',
    walletBalance: 250000,
    googleConnected: true,
    metaConnected: true,
    tiktokConnected: false,
    xConnected: true,
    indeedConnected: true,
    lineConnected: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
];
