"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Store, Users, UserPlus, MapPin, Play, MessageCircle, Youtube, Briefcase, MessageSquare,
  ArrowRight, ArrowLeft, Check, Plus, Eye, Pause, BarChart3, TrendingUp, Phone, UserCheck,
  Wallet, Zap, LogOut, ChevronDown, ChevronUp, Sparkles, AlertCircle, Instagram,
  ExternalLink, Layout, Link, Settings2,
} from 'lucide-react';

// ===== 定数 =====
const ACCENT = '#F39800';
const ACCENT_DARK = '#CC7D00';
const BG = '#FDF6ED';

type CampaignGoal = 'visit' | 'friends' | 'recruit';
type CampaignStatus = 'draft' | 'reviewing' | 'active' | 'paused' | 'completed';
type ChannelId = 'google' | 'instagram' | 'tiktok' | 'x' | 'youtube' | 'indeed' | 'line';

type ChannelAllocation = { channelId: ChannelId; budget: number; percentage: number };
type ChannelCopy = { channelId: ChannelId; headline: string; body: string; cta: string };
type DailyPerformance = { date: string; impressions: number; clicks: number; conversions: number; spend: number };
type DestinationType = 'url' | 'pal_studio' | 'line' | 'phone' | 'map';
type CampaignDestination = { type: DestinationType; url?: string; label: string };

type CampaignTargeting = { address: string; lat?: number; lng?: number; radiusKm: number; persona?: string[] };

type Campaign = {
  id: string; paletteId: string; goal: CampaignGoal; channels: ChannelId[];
  budget: number; periodDays: number; allocation: ChannelAllocation[];
  status: CampaignStatus; copies: ChannelCopy[]; mediaUrls: string[];
  videoJobId: string | null; destination: CampaignDestination;
  targeting?: CampaignTargeting;
  performance: DailyPerformance[];
  createdAt: string; updatedAt: string;
};

type AppView = 'login' | 'dashboard' | 'wizard' | 'detail' | 'preview';
type WizardStep = 1 | 2 | 3;

// ===== 遷移先プリセット =====
const DEST_PRESETS: { type: DestinationType; label: string; desc: string; icon: React.ReactNode; placeholder?: string }[] = [
  { type: 'url', label: '外部URL / LP', desc: 'ホームページやランディングページへ誘導', icon: <ExternalLink size={18} />, placeholder: 'https://example.com' },
  { type: 'pal_studio', label: 'Pal Studio LP', desc: 'Pal Studioで作成したページへ誘導', icon: <Layout size={18} /> },
  { type: 'line', label: 'LINE友だち追加', desc: 'LINE公式アカウントの友だち追加ページ', icon: <MessageSquare size={18} />, placeholder: 'https://lin.ee/xxxxx' },
  { type: 'phone', label: '電話をかける', desc: '店舗へ直接電話を発信', icon: <Phone size={18} />, placeholder: '090-1234-5678' },
  { type: 'map', label: 'Googleマップ経路案内', desc: '店舗への経路を表示', icon: <MapPin size={18} />, placeholder: 'https://maps.google.com/...' },
];

// ===== チャネル情報 =====
const CHANNEL_MAP: Record<ChannelId, { name: string; strength: string; color: string; format: string }> = {
  google: { name: 'Google広告', strength: '今、近くで店を探している層', color: '#4285F4', format: 'マップ・検索・ディスプレイ' },
  instagram: { name: 'Instagram', strength: 'ビジュアルで欲しくなる層', color: '#E4405F', format: 'フィード・リール' },
  tiktok: { name: 'TikTok', strength: '流行に敏感な若年層・爆発力', color: '#000000', format: '縦型動画' },
  x: { name: 'X (Twitter)', strength: 'リアルタイム性・二次拡散', color: '#1DA1F2', format: 'プロモポスト' },
  youtube: { name: 'YouTube', strength: 'テレビ代わりの視聴・高認知', color: '#FF0000', format: 'インストリーム動画' },
  indeed: { name: 'Indeed / 求人BOX', strength: '仕事を探している層', color: '#2164F3', format: '採用テキスト・バナー' },
  line: { name: 'LINE広告', strength: '全世代の生活動線', color: '#06C755', format: 'トークリスト・ニュース' },
};

const CHANNEL_ICONS: Record<ChannelId, React.ReactNode> = {
  google: <MapPin size={20} />,
  instagram: <Instagram size={20} />,
  tiktok: <Play size={20} />,
  x: <MessageCircle size={20} />,
  youtube: <Youtube size={20} />,
  indeed: <Briefcase size={20} />,
  line: <MessageSquare size={20} />,
};

// ===== 媒体別配信フォーマット =====
type ChannelFormatOption = { id: string; label: string; desc: string };
const CHANNEL_FORMATS: Record<ChannelId, ChannelFormatOption[]> = {
  google: [
    { id: 'map', label: 'マップ広告', desc: 'Googleマップ上のピン強調・ローカル検索上位' },
    { id: 'search', label: 'リスティング広告', desc: 'Google検索結果の上部にテキスト広告' },
    { id: 'display', label: 'ディスプレイ広告', desc: 'Webサイト・アプリにバナー表示' },
  ],
  instagram: [
    { id: 'feed', label: 'フィード広告', desc: 'タイムラインに写真・動画を表示' },
    { id: 'reel', label: 'リール広告', desc: '縦型ショート動画で高エンゲージメント' },
    { id: 'story', label: 'ストーリーズ広告', desc: 'フルスクリーンの没入型広告' },
  ],
  tiktok: [
    { id: 'infeed', label: 'インフィード広告', desc: 'おすすめフィードに自然に表示' },
    { id: 'topview', label: 'TopView', desc: 'アプリ起動時にフルスクリーン表示' },
  ],
  x: [
    { id: 'promoted', label: 'プロモポスト', desc: 'タイムラインにプロモーション投稿' },
    { id: 'trend', label: 'トレンドテイクオーバー', desc: 'トレンド欄に表示' },
  ],
  youtube: [
    { id: 'instream', label: 'インストリーム広告', desc: '動画再生前後・途中に15〜30秒' },
    { id: 'short', label: 'ショート広告', desc: 'YouTubeショートに縦型動画' },
    { id: 'discovery', label: 'ディスカバリー広告', desc: '検索結果・関連動画に表示' },
  ],
  indeed: [
    { id: 'sponsored', label: 'スポンサー求人', desc: '検索結果の上位に求人を表示' },
    { id: 'display', label: 'ディスプレイ広告', desc: '求人ページにバナーを表示' },
  ],
  line: [
    { id: 'talklist', label: 'トークリスト広告', desc: 'LINEトーク一覧の最上部に表示' },
    { id: 'news', label: 'LINE NEWS広告', desc: 'ニュースタブに記事風広告' },
    { id: 'timeline', label: 'タイムライン広告', desc: 'VOOM（旧タイムライン）に表示' },
  ],
};

const GOAL_INFO: Record<CampaignGoal, { label: string; desc: string; icon: React.ReactNode; channels: ChannelId[] }> = {
  visit: { label: '来店を増やす', desc: '近隣の潜在顧客に店舗を認知させ、来店につなげます', icon: <Store size={32} />, channels: ['google', 'instagram', 'line'] },
  friends: { label: '友だちを増やす', desc: 'LINE公式アカウントの友だち登録を促進します', icon: <Users size={32} />, channels: ['instagram', 'tiktok', 'line'] },
  recruit: { label: 'スタッフを募集する', desc: '求職者に効率よくリーチし、応募数を最大化します', icon: <UserPlus size={32} />, channels: ['indeed', 'instagram', 'x'] },
};

const STATUS_MAP: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-slate-500', bg: 'bg-slate-100' },
  reviewing: { label: '審査中', color: 'text-blue-600', bg: 'bg-blue-50' },
  active: { label: '配信中', color: 'text-green-700', bg: 'bg-green-50' },
  paused: { label: '一時停止', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  completed: { label: '完了', color: 'text-slate-600', bg: 'bg-slate-100' },
};

const formatYen = (n: number) => `¥${n.toLocaleString()}`;
const formatDate = (s: string) => { try { return new Date(s).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }); } catch { return s; } };

// ===== メインコンポーネント =====
export default function MainPage() {
  const [view, setView] = useState<AppView>('login');
  const [paletteId, setPaletteId] = useState('');
  const [accountName, setAccountName] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  // ウィザード
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedGoal, setSelectedGoal] = useState<CampaignGoal | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([]);
  const [budget, setBudget] = useState(50000);
  const [periodDays, setPeriodDays] = useState(30);
  const [destType, setDestType] = useState<DestinationType>('url');
  const [destUrl, setDestUrl] = useState('');
  const [destLabel, setDestLabel] = useState('');
  const [channelFormats, setChannelFormats] = useState<Record<string, string[]>>({});

  // ターゲティング
  const [targetAddress, setTargetAddress] = useState('');
  const [targetRadius, setTargetRadius] = useState(5);
  const [targetPersonas, setTargetPersonas] = useState<string[]>([]);

  // ログイン
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // セッションチェック
  useEffect(() => {
    fetch('/api/main/session').then(r => r.json()).then(data => {
      if (data?.authenticated) {
        setPaletteId(data.paletteId || '');
        setCampaigns(data.campaigns || []);
        setView('dashboard');
        fetch('/api/wallet').then(r => r.json()).then(w => {
          if (w?.wallet) setWalletBalance(w.wallet.balance);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/main/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: loginId, password: loginPw }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) { setLoginError(data?.error || 'ログイン失敗'); return; }
      setPaletteId(data.paletteId || '');
      setAccountName(data.accountName || '');
      // リロードしてセッション取得
      const sessRes = await fetch('/api/main/session');
      const sessData = await sessRes.json();
      setCampaigns(sessData?.campaigns || []);
      fetch('/api/wallet').then(r => r.json()).then(w => {
        if (w?.wallet) setWalletBalance(w.wallet.balance);
      }).catch(() => {});
      setView('dashboard');
    } catch { setLoginError('通信エラー'); } finally { setLoginLoading(false); }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    setView('login');
    setPaletteId('');
    setCampaigns([]);
  };

  const startWizard = () => {
    setWizardStep(1);
    setSelectedGoal(null);
    setSelectedChannels([]);
    setBudget(50000);
    setPeriodDays(30);
    setDestType('url');
    setDestUrl('');
    setDestLabel('');
    setChannelFormats({});
    setTargetAddress('');
    setTargetRadius(5);
    setTargetPersonas([]);
    setView('wizard');
  };

  const toggleChannel = (ch: ChannelId) => {
    setSelectedChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const allocation = useMemo(() => {
    if (!selectedChannels.length) return [];
    const base = Math.floor(100 / selectedChannels.length);
    const rem = 100 - base * selectedChannels.length;
    return selectedChannels.map((ch, i) => {
      const pct = base + (i < rem ? 1 : 0);
      return { channelId: ch, budget: Math.round(budget * pct / 100), percentage: pct };
    });
  }, [selectedChannels, budget]);

  const handleCreateCampaign = useCallback(async () => {
    if (!selectedGoal || !selectedChannels.length) return;
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: selectedGoal, channels: selectedChannels, budget, periodDays,
          destination: { type: destType, url: destUrl || undefined, label: destLabel || DEST_PRESETS.find(d => d.type === destType)?.label || '' },
          targeting: targetAddress ? { address: targetAddress, radiusKm: targetRadius, persona: targetPersonas.length ? targetPersonas : undefined } : undefined,
          channelFormats,
        }),
      });
      const data = await res.json();
      if (data?.campaign) {
        setCampaigns(prev => [data.campaign, ...prev]);
        setSelectedCampaign(data.campaign);
        // ウォレット残高を再取得
        fetch('/api/wallet').then(r => r.json()).then(w => {
          if (w?.wallet) setWalletBalance(w.wallet.balance);
        }).catch(() => {});
        setView('preview');
      }
    } catch { /* エラーハンドリングは後で */ }
  }, [selectedGoal, selectedChannels, budget, periodDays]);

  // サマリー
  const summaryStats = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'active');
    let totalImpressions = 0, totalClicks = 0, totalConversions = 0;
    active.forEach(c => c.performance.forEach(p => {
      totalImpressions += p.impressions;
      totalClicks += p.clicks;
      totalConversions += p.conversions;
    }));
    return { activeCampaigns: active.length, totalImpressions, totalClicks, totalConversions };
  }, [campaigns]);

  // ===== ログイン画面 =====
  if (view === 'login') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: BG }}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
              <span className="text-white text-xs font-black">PA</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-none">Pal Ad</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">広告統合管理</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-5">ログインして広告管理を始めましょう</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ログインID</label>
              <input value={loginId} onChange={e => setLoginId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
                onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`}
                onBlur={e => e.target.style.boxShadow = ''} placeholder="your-login-id" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">パスワード</label>
              <input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
                onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`}
                onBlur={e => e.target.style.boxShadow = ''} placeholder="password" />
            </div>
            {loginError && <p className="text-xs text-red-600">{loginError}</p>}
            <button type="submit" disabled={loginLoading}
              className="w-full py-2.5 rounded-lg text-white text-sm font-bold disabled:opacity-60"
              style={{ backgroundColor: ACCENT }}
              onMouseEnter={e => { if (!loginLoading) (e.target as HTMLButtonElement).style.backgroundColor = ACCENT_DARK; }}
              onMouseLeave={e => (e.target as HTMLButtonElement).style.backgroundColor = ACCENT}>
              {loginLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ===== ダッシュボード =====
  if (view === 'dashboard') {
    return (
      <main className="min-h-screen overflow-y-auto" style={{ backgroundColor: BG }}>
        <div className="max-w-4xl mx-auto p-4">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
                <span className="text-white text-xs font-black">PA</span>
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-800 leading-none">Pal Ad</h1>
                <p className="text-[10px] text-slate-400 font-bold">{accountName || paletteId}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <LogOut size={14} /> ログアウト
            </button>
          </div>

          {/* ウォレット残高 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={18} style={{ color: ACCENT }} />
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Paletteウォレット</p>
                <p className="text-lg font-black text-slate-800">{formatYen(walletBalance)}</p>
              </div>
            </div>
            <button onClick={async () => {
              const res = await fetch('/api/wallet', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'charge', amount: 50000 }),
              });
              const data = await res.json();
              if (data?.balance !== undefined) setWalletBalance(data.balance);
            }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: ACCENT }}>
              + チャージ
            </button>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: '配信中', value: summaryStats.activeCampaigns, icon: <Zap size={16} />, color: '#22c55e' },
              { label: '表示回数', value: summaryStats.totalImpressions.toLocaleString(), icon: <Eye size={16} />, color: '#3b82f6' },
              { label: 'クリック', value: summaryStats.totalClicks.toLocaleString(), icon: <TrendingUp size={16} />, color: ACCENT },
              { label: 'コンバージョン', value: summaryStats.totalConversions.toLocaleString(), icon: <UserCheck size={16} />, color: '#8b5cf6' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <span className="text-[10px] font-bold text-slate-400">{s.label}</span>
                </div>
                <p className="text-xl font-black text-slate-800">{s.value}</p>
              </div>
            ))}
          </div>

          {/* 新規作成ボタン */}
          <button onClick={startWizard}
            className="w-full mb-6 py-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-shadow"
            style={{ backgroundColor: ACCENT }}>
            <Plus size={18} /> 新しい広告を作る
          </button>

          {/* キャンペーン一覧 */}
          <h2 className="text-sm font-bold text-slate-600 mb-3">キャンペーン一覧</h2>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
              <BarChart3 size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">まだキャンペーンがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => {
                const st = STATUS_MAP[c.status];
                const goalInfo = GOAL_INFO[c.goal];
                return (
                  <div key={c.id}
                    onClick={() => { setSelectedCampaign(c); setView('detail'); }}
                    className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ACCENT}15` }}>
                          <span style={{ color: ACCENT }}>{goalInfo.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{goalInfo.label}</p>
                          <p className="text-[10px] text-slate-400">{formatDate(c.createdAt)} ・ {c.periodDays}日間 ・ {formatYen(c.budget)}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex gap-1.5 mt-2.5">
                      {c.channels.map(ch => (
                        <span key={ch} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 text-slate-500"
                          style={{ borderLeft: `2px solid ${CHANNEL_MAP[ch].color}` }}>
                          {CHANNEL_MAP[ch].name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ===== 3ステップウィザード =====
  if (view === 'wizard') {
    return (
      <main className="min-h-screen overflow-y-auto" style={{ backgroundColor: BG }}>
        <div className="w-full max-w-2xl mx-auto p-4">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <ArrowLeft size={14} /> 戻る
            </button>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                    s <= wizardStep ? 'text-white' : 'text-slate-400 bg-slate-200'
                  }`} style={s <= wizardStep ? { backgroundColor: ACCENT } : {}}>
                    {s < wizardStep ? <Check size={12} /> : s}
                  </div>
                  {s < 3 && <div className={`w-8 h-0.5 ${s < wizardStep ? 'bg-[#F39800]' : 'bg-slate-200'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Goal */}
          {wizardStep === 1 && (
            <div>
              <h2 className="text-lg font-black text-slate-800 mb-1">何のために広告を出しますか？</h2>
              <p className="text-xs text-slate-400 mb-6">目的に合わせて最適な配信プランを提案します</p>
              <div className="space-y-3">
                {(Object.entries(GOAL_INFO) as [CampaignGoal, typeof GOAL_INFO['visit']][]).map(([id, g]) => (
                  <button key={id} onClick={() => { setSelectedGoal(id); setSelectedChannels(g.channels); setWizardStep(2); }}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                      selectedGoal === id ? 'border-[#F39800] bg-[#FFF5E6]' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: selectedGoal === id ? `${ACCENT}20` : '#f1f5f9', color: selectedGoal === id ? ACCENT : '#94a3b8' }}>
                        {g.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-800">{g.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{g.desc}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Channel */}
          {wizardStep === 2 && (
            <div>
              <h2 className="text-lg font-black text-slate-800 mb-1">どこに配信しますか？</h2>
              <p className="text-xs text-slate-400 mb-1">おすすめの媒体が選択されています。追加・変更できます</p>
              <p className="text-[10px] text-slate-300 mb-6">{selectedChannels.length}件選択中</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.entries(CHANNEL_MAP) as [ChannelId, typeof CHANNEL_MAP['google']][]).map(([id, ch]) => {
                  const selected = selectedChannels.includes(id);
                  return (
                    <button key={id} onClick={() => toggleChannel(id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selected ? 'border-[#F39800] bg-[#FFF5E6]' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: selected ? `${ch.color}15` : '#f1f5f9', color: selected ? ch.color : '#94a3b8' }}>
                          {CHANNEL_ICONS[id]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{ch.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{ch.strength}</p>
                        </div>
                        {selected && <Check size={16} style={{ color: ACCENT }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* 選択済み媒体の配信フォーマット設定 */}
              {selectedChannels.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">
                    <Settings2 size={14} className="inline mr-1" />配信フォーマット（詳細設定）
                  </h3>
                  <div className="space-y-3">
                    {selectedChannels.map(chId => {
                      const ch = CHANNEL_MAP[chId];
                      const formats = CHANNEL_FORMATS[chId] || [];
                      const selected = channelFormats[chId] || [formats[0]?.id];
                      return (
                        <div key={chId} className="bg-white rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                            <span className="text-xs font-bold text-slate-700">{ch.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {formats.map(f => {
                              const isOn = selected.includes(f.id);
                              return (
                                <button key={f.id}
                                  onClick={() => {
                                    setChannelFormats(prev => {
                                      const cur = prev[chId] || [formats[0]?.id];
                                      const next = isOn
                                        ? cur.filter(x => x !== f.id)
                                        : [...cur, f.id];
                                      return { ...prev, [chId]: next.length ? next : [f.id] };
                                    });
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    isOn
                                      ? 'text-white border-transparent'
                                      : 'text-slate-500 border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                  style={isOn ? { backgroundColor: ch.color } : {}}
                                  title={f.desc}>
                                  {f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setWizardStep(1)}
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  戻る
                </button>
                <button onClick={() => setWizardStep(3)} disabled={selectedChannels.length === 0}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-40"
                  style={{ backgroundColor: ACCENT }}>
                  次へ <ArrowRight size={14} className="inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Budget */}
          {wizardStep === 3 && (
            <div>
              <h2 className="text-lg font-black text-slate-800 mb-1">予算と期間を設定</h2>
              <p className="text-xs text-slate-400 mb-6">媒体への配分は自動で最適化されます</p>

              <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
                <label className="block text-[11px] font-bold text-slate-500 mb-2">総予算</label>
                <p className="text-2xl font-black text-slate-800 mb-2">{formatYen(budget)}</p>
                <input type="range" min={10000} max={1000000} step={10000} value={budget}
                  onChange={e => setBudget(Number(e.target.value))}
                  className="w-full accent-[#F39800]" />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>¥10,000</span><span>¥1,000,000</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
                <label className="block text-[11px] font-bold text-slate-500 mb-2">配信期間</label>
                <div className="flex gap-2">
                  {[7, 14, 30, 60, 90].map(d => (
                    <button key={d} onClick={() => setPeriodDays(d)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                        periodDays === d ? 'text-white' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                      }`} style={periodDays === d ? { backgroundColor: ACCENT } : {}}>
                      {d < 30 ? `${d}日` : `${d / 30}ヶ月`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 配分プレビュー */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
                <p className="text-[11px] font-bold text-slate-500 mb-3">
                  <Sparkles size={12} className="inline mr-1" style={{ color: ACCENT }} />
                  スマート配分プレビュー
                </p>
                {allocation.map(a => (
                  <div key={a.channelId} className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHANNEL_MAP[a.channelId].color }} />
                    <span className="text-xs text-slate-600 flex-1">{CHANNEL_MAP[a.channelId].name}</span>
                    <span className="text-xs font-bold text-slate-800">{formatYen(a.budget)}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">{a.percentage}%</span>
                  </div>
                ))}
                <div className="w-full h-2 rounded-full bg-slate-100 mt-3 overflow-hidden flex">
                  {allocation.map(a => (
                    <div key={a.channelId} style={{ width: `${a.percentage}%`, backgroundColor: CHANNEL_MAP[a.channelId].color }} />
                  ))}
                </div>
              </div>

              {/* 遷移先設定 */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
                <p className="text-[11px] font-bold text-slate-500 mb-3">
                  <Link size={12} className="inline mr-1" style={{ color: ACCENT }} />
                  広告クリック時の遷移先
                </p>
                <div className="space-y-2 mb-3">
                  {DEST_PRESETS.map(d => (
                    <button key={d.type} onClick={() => setDestType(d.type)}
                      className={`w-full p-3 rounded-lg border text-left transition-all flex items-center gap-2.5 ${
                        destType === d.type ? 'border-[#F39800] bg-[#FFF5E6]' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <span style={{ color: destType === d.type ? ACCENT : '#94a3b8' }}>{d.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700">{d.label}</p>
                        <p className="text-[10px] text-slate-400">{d.desc}</p>
                      </div>
                      {destType === d.type && <Check size={14} style={{ color: ACCENT }} />}
                    </button>
                  ))}
                </div>
                {destType !== 'pal_studio' && (
                  <div className="space-y-2">
                    <input value={destUrl} onChange={e => setDestUrl(e.target.value)}
                      placeholder={DEST_PRESETS.find(d => d.type === destType)?.placeholder || 'URLを入力'}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
                      onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`}
                      onBlur={e => e.target.style.boxShadow = ''} />
                    <input value={destLabel} onChange={e => setDestLabel(e.target.value)}
                      placeholder="表示ラベル（例：キャンペーンページ）"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
                      onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`}
                      onBlur={e => e.target.style.boxShadow = ''} />
                  </div>
                )}
                {destType === 'pal_studio' && (
                  <div className="p-3 rounded-lg bg-slate-50 text-center">
                    <Layout size={20} className="mx-auto mb-1 text-slate-400" />
                    <p className="text-[11px] text-slate-500">Pal Studioで作成したLPが自動で設定されます</p>
                  </div>
                )}
              </div>

              {/* サークルターゲティング */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 mb-6">
                <p className="text-[11px] font-bold text-slate-500 mb-3">
                  <MapPin size={12} className="inline mr-1" style={{ color: ACCENT }} />
                  配信エリア（サークルターゲティング）
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">店舗住所</label>
                    <input value={targetAddress} onChange={e => setTargetAddress(e.target.value)}
                      placeholder="例：東京都渋谷区神宮前1-1-1"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none"
                      onFocus={e => e.target.style.boxShadow = `0 0 0 2px ${ACCENT}40`}
                      onBlur={e => e.target.style.boxShadow = ''} />
                  </div>

                  {/* 地図表示 */}
                  {targetAddress && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <iframe
                        width="100%" height="200" style={{ border: 0 }}
                        loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}&q=${encodeURIComponent(targetAddress)}&zoom=13`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">配信半径</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={1} max={30} step={1} value={targetRadius}
                        onChange={e => setTargetRadius(Number(e.target.value))}
                        className="flex-1 accent-[#F39800]" />
                      <span className="text-sm font-black text-slate-800 w-16 text-right">{targetRadius}km</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                      <span>1km</span><span>15km</span><span>30km</span>
                    </div>
                  </div>

                  {/* ペルソナ選択 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-2">ターゲットペルソナ</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'housewife', label: '主婦層', age: '30-50' },
                        { id: 'salaryman', label: 'サラリーマン', age: '25-55' },
                        { id: 'genz', label: 'Z世代', age: '18-27' },
                        { id: 'jobseeker', label: '求職者', age: '18-45' },
                      ].map(p => {
                        const isOn = targetPersonas.includes(p.id);
                        return (
                          <button key={p.id}
                            onClick={() => setTargetPersonas(prev =>
                              isOn ? prev.filter(x => x !== p.id) : [...prev, p.id]
                            )}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                              isOn ? 'text-white border-transparent' : 'text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                            style={isOn ? { backgroundColor: ACCENT } : {}}>
                            {p.label}
                            <span className="text-[9px] ml-1 opacity-70">{p.age}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setWizardStep(2)}
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  戻る
                </button>
                <button onClick={handleCreateCampaign}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold shadow-md"
                  style={{ backgroundColor: ACCENT }}>
                  広告を作成する
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ===== プレビュー画面 =====
  if (view === 'preview' && selectedCampaign) {
    const c = selectedCampaign;
    return (
      <main className="min-h-screen overflow-y-auto" style={{ backgroundColor: BG }}>
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setView('dashboard')} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
              <ArrowLeft size={14} /> ダッシュボードへ
            </button>
            <span className="text-[10px] text-slate-400">ライブプレビュー</span>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} style={{ color: ACCENT }} />
              <h2 className="text-sm font-black text-slate-800">AIキャッチコピー・プレビュー</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-bold">
                <Check size={10} className="inline mr-0.5" />映えチェック OK
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-4">各媒体に最適化されたコピーが生成されました</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {c.copies.map(copy => {
                const ch = CHANNEL_MAP[copy.channelId];
                return (
                  <div key={copy.channelId} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: `${ch.color}10` }}>
                      <span style={{ color: ch.color }}>{CHANNEL_ICONS[copy.channelId]}</span>
                      <span className="text-xs font-bold text-slate-700">{ch.name}</span>
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-slate-800 mb-1">{copy.headline}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{copy.body}</p>
                      <button className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: ch.color }}>
                        {copy.cta}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setSelectedCampaign(c); setView('detail'); }}
              className="flex-1 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 hover:bg-slate-50">
              詳細を見る
            </button>
            <button onClick={() => setView('dashboard')}
              className="flex-1 py-3 rounded-xl text-white text-sm font-bold"
              style={{ backgroundColor: ACCENT }}>
              ダッシュボードへ
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===== 詳細画面 =====
  if (view === 'detail' && selectedCampaign) {
    const c = selectedCampaign;
    const st = STATUS_MAP[c.status];
    const goalInfo = GOAL_INFO[c.goal];
    const totalSpend = c.performance.reduce((s, p) => s + p.spend, 0);
    const totalClicks = c.performance.reduce((s, p) => s + p.clicks, 0);
    const totalConversions = c.performance.reduce((s, p) => s + p.conversions, 0);
    const totalImpressions = c.performance.reduce((s, p) => s + p.impressions, 0);
    const [showCopies, setShowCopies] = useState(false);

    return (
      <main className="min-h-screen overflow-y-auto custom-scrollbar" style={{ backgroundColor: BG }}>
        <div className="max-w-3xl mx-auto p-4 pb-20">
          <button onClick={() => { setSelectedCampaign(null); setView('dashboard'); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-4">
            <ArrowLeft size={14} /> 一覧に戻る
          </button>

          {/* ヘッダー */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                  {goalInfo.icon}
                </div>
                <div>
                  <p className="text-base font-black text-slate-800">{goalInfo.label}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(c.createdAt)} 〜 {c.periodDays}日間</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>{st.label}</span>
            </div>
            <div className="flex gap-1.5 mb-3">
              {c.channels.map(ch => (
                <span key={ch} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: `${CHANNEL_MAP[ch].color}10`, color: CHANNEL_MAP[ch].color, borderLeft: `2px solid ${CHANNEL_MAP[ch].color}` }}>
                  {CHANNEL_MAP[ch].name}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span><Wallet size={12} className="inline mr-1" />予算: {formatYen(c.budget)}</span>
              <span>消化: {formatYen(totalSpend)}</span>
            </div>
          </div>

          {/* パフォーマンス */}
          {c.performance.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
              <h3 className="text-xs font-bold text-slate-600 mb-3">
                <BarChart3 size={12} className="inline mr-1" />パフォーマンス
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <p className="text-lg font-black text-slate-800">{totalImpressions.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">表示</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-800">{totalClicks.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">クリック</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-slate-800">{totalConversions}</p>
                  <p className="text-[10px] text-slate-400">CV</p>
                </div>
              </div>
              {/* 簡易グラフ */}
              <div className="flex items-end gap-0.5 h-16">
                {c.performance.slice(-14).map((p, i) => {
                  const max = Math.max(...c.performance.slice(-14).map(x => x.clicks));
                  const h = max > 0 ? (p.clicks / max) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 rounded-t" title={`${p.date}: ${p.clicks}クリック`}
                      style={{ height: `${Math.max(h, 4)}%`, backgroundColor: ACCENT, opacity: 0.6 + (i / 14) * 0.4 }} />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-slate-300 mt-1">
                <span>{c.performance.slice(-14)[0]?.date?.slice(5)}</span>
                <span>{c.performance.slice(-1)[0]?.date?.slice(5)}</span>
              </div>
            </div>
          )}

          {/* 遷移先 */}
          {c.destination && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
              <h3 className="text-xs font-bold text-slate-600 mb-2">
                <Link size={12} className="inline mr-1" />クリック時の遷移先
              </h3>
              <div className="flex items-center gap-2">
                <span style={{ color: ACCENT }}>
                  {c.destination.type === 'url' && <ExternalLink size={16} />}
                  {c.destination.type === 'pal_studio' && <Layout size={16} />}
                  {c.destination.type === 'line' && <MessageSquare size={16} />}
                  {c.destination.type === 'phone' && <Phone size={16} />}
                  {c.destination.type === 'map' && <MapPin size={16} />}
                </span>
                <div>
                  <p className="text-xs font-bold text-slate-800">{c.destination.label}</p>
                  {c.destination.url && (
                    <p className="text-[10px] text-blue-500 truncate max-w-xs">{c.destination.url}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ターゲティング */}
          {c.targeting && (
            <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
              <h3 className="text-xs font-bold text-slate-600 mb-2">
                <MapPin size={12} className="inline mr-1" />配信エリア
              </h3>
              <p className="text-xs text-slate-800 font-bold">{c.targeting.address}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">半径 {c.targeting.radiusKm}km</p>
              {c.targeting.persona && c.targeting.persona.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {c.targeting.persona.map(p => {
                    const labels: Record<string, string> = { housewife: '主婦層', salaryman: 'サラリーマン', genz: 'Z世代', jobseeker: '求職者' };
                    return (
                      <span key={p} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                        {labels[p] || p}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 配分 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 mb-4">
            <h3 className="text-xs font-bold text-slate-600 mb-3">媒体別配分</h3>
            {c.allocation.map(a => (
              <div key={a.channelId} className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHANNEL_MAP[a.channelId].color }} />
                <span className="text-xs text-slate-600 flex-1">{CHANNEL_MAP[a.channelId].name}</span>
                <span className="text-xs font-bold text-slate-800">{formatYen(a.budget)}</span>
                <span className="text-[10px] text-slate-400 w-8 text-right">{a.percentage}%</span>
              </div>
            ))}
          </div>

          {/* コピー */}
          <div className="bg-white rounded-xl border border-slate-200 mb-4">
            <button onClick={() => setShowCopies(!showCopies)}
              className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>媒体別コピー</span>
              {showCopies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showCopies && (
              <div className="px-5 pb-4 space-y-3">
                {c.copies.map(copy => (
                  <div key={copy.channelId} className="p-3 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span style={{ color: CHANNEL_MAP[copy.channelId].color }}>{CHANNEL_ICONS[copy.channelId]}</span>
                      <span className="text-[11px] font-bold text-slate-700">{CHANNEL_MAP[copy.channelId].name}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{copy.headline}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{copy.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return null;
}
