"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, ChevronRight, Store, UserPlus, MapPin, Play, MessageCircle,
  Youtube, Briefcase, MessageSquare, Plus, Eye, BarChart3, Settings, Wallet,
  LogOut, RefreshCw, ArrowLeft, Check, X, Zap, Sparkles, Instagram,
} from 'lucide-react';

const ACCENT = '#F39800';
const BG = '#FDF6ED';

type CampaignGoal = 'visit' | 'friends' | 'recruit';
type CampaignStatus = 'draft' | 'reviewing' | 'active' | 'paused' | 'completed';
type ChannelId = 'google' | 'instagram' | 'tiktok' | 'x' | 'youtube' | 'indeed' | 'line';

type ChannelAllocation = { channelId: ChannelId; budget: number; percentage: number };
type ChannelCopy = { channelId: ChannelId; headline: string; body: string; cta: string };
type DailyPerformance = { date: string; impressions: number; clicks: number; conversions: number; spend: number };

type Campaign = {
  id: string; paletteId: string; goal: CampaignGoal; channels: ChannelId[];
  budget: number; periodDays: number; allocation: ChannelAllocation[];
  status: CampaignStatus; copies: ChannelCopy[]; mediaUrls: string[];
  videoJobId: string | null; performance: DailyPerformance[];
  createdAt: string; updatedAt: string;
};

type AdSettings = {
  id: string; paletteId: string; walletBalance: number;
  googleConnected: boolean; metaConnected: boolean; tiktokConnected: boolean;
  xConnected: boolean; indeedConnected: boolean; lineConnected: boolean;
  createdAt: string; updatedAt: string;
};

type CustomerAccount = {
  id: string; paletteId: string; name: string; status: string; isStandard?: boolean;
};

const CHANNEL_MAP: Record<ChannelId, { name: string; color: string }> = {
  google: { name: 'Google広告', color: '#4285F4' },
  instagram: { name: 'Instagram', color: '#E4405F' },
  tiktok: { name: 'TikTok', color: '#000000' },
  x: { name: 'X', color: '#1DA1F2' },
  youtube: { name: 'YouTube', color: '#FF0000' },
  indeed: { name: 'Indeed', color: '#2164F3' },
  line: { name: 'LINE', color: '#06C755' },
};

const GOAL_LABELS: Record<CampaignGoal, string> = { visit: '来店促進', friends: '友だち獲得', recruit: 'スタッフ募集' };

const STATUS_MAP: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'text-slate-500', bg: 'bg-slate-100' },
  reviewing: { label: '審査中', color: 'text-blue-600', bg: 'bg-blue-50' },
  active: { label: '配信中', color: 'text-green-700', bg: 'bg-green-50' },
  paused: { label: '一時停止', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  completed: { label: '完了', color: 'text-slate-600', bg: 'bg-slate-100' },
};

const formatYen = (n: number) => `¥${n.toLocaleString()}`;

type AdminTab = 'customers' | 'settings';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('customers');
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAccount | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 顧客一覧取得
  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/customers')
      .then(r => r.json())
      .then(data => setCustomers(data?.accounts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 顧客選択時
  const selectCustomer = useCallback(async (customer: CustomerAccount) => {
    setSelectedCustomer(customer);
    setLoading(true);
    try {
      const [campRes, setRes] = await Promise.all([
        fetch(`/api/admin/campaigns?paletteId=${encodeURIComponent(customer.paletteId)}`),
        fetch(`/api/admin/settings?paletteId=${encodeURIComponent(customer.paletteId)}`),
      ]);
      const campData = await campRes.json();
      const setData = await setRes.json();
      setCampaigns(campData?.campaigns || []);
      setSettings(setData?.settings || null);
    } catch { /* */ }
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const filteredCustomers = customers.filter(c =>
    !searchQuery || c.name.includes(searchQuery) || c.paletteId.includes(searchQuery.toUpperCase())
  );

  return (
    <main className="min-h-screen overflow-y-auto" style={{ backgroundColor: BG }}>
      <div className="max-w-6xl mx-auto p-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
              <span className="text-white text-xs font-black">PA</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">Pal Ad</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">管理画面</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <LogOut size={14} /> ログアウト
          </button>
        </div>

        <div className="flex gap-4">
          {/* 左パネル：顧客一覧 */}
          <div className="w-72 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
                  <Search size={14} className="text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="顧客を検索"
                    className="flex-1 text-xs bg-transparent outline-none text-slate-600 placeholder:text-slate-300" />
                </div>
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
                {loading && customers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">読み込み中...</div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">顧客が見つかりません</div>
                ) : (
                  filteredCustomers.map(c => (
                    <button key={c.id} onClick={() => selectCustomer(c)}
                      className={`w-full px-3 py-2.5 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        selectedCustomer?.id === c.id ? 'bg-[#FFF5E6]' : ''
                      }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{c.name}</p>
                          <p className="text-[10px] text-slate-400">{c.paletteId}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {c.isStandard && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                              Standard
                            </span>
                          )}
                          <ChevronRight size={12} className="text-slate-300" />
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右パネル：詳細 */}
          <div className="flex-1 min-w-0">
            {!selectedCustomer ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Users size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">左の一覧から顧客を選択してください</p>
              </div>
            ) : (
              <>
                {/* 顧客ヘッダー */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black text-slate-800">{selectedCustomer.name}</h2>
                      <p className="text-[10px] text-slate-400">{selectedCustomer.paletteId}</p>
                    </div>
                    {settings && (
                      <div className="flex items-center gap-1.5">
                        <Wallet size={14} style={{ color: ACCENT }} />
                        <span className="text-sm font-bold text-slate-800">{formatYen(settings.walletBalance)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* タブ */}
                <div className="flex gap-1 mb-4">
                  {[
                    { id: 'customers' as AdminTab, label: 'キャンペーン', icon: <BarChart3 size={14} /> },
                    { id: 'settings' as AdminTab, label: '設定', icon: <Settings size={14} /> },
                  ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        tab === t.id ? 'text-white' : 'text-slate-500 bg-white hover:bg-slate-50'
                      }`} style={tab === t.id ? { backgroundColor: ACCENT } : {}}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {/* キャンペーンタブ */}
                {tab === 'customers' && (
                  <div className="space-y-3">
                    {campaigns.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                        <BarChart3 size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm text-slate-400">キャンペーンがありません</p>
                      </div>
                    ) : (
                      campaigns.map(c => {
                        const st = STATUS_MAP[c.status];
                        const totalSpend = c.performance.reduce((s, p) => s + p.spend, 0);
                        const totalClicks = c.performance.reduce((s, p) => s + p.clicks, 0);
                        return (
                          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-800">{GOAL_LABELS[c.goal]}</p>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.color}`}>{st.label}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  予算: {formatYen(c.budget)} ・ 消化: {formatYen(totalSpend)} ・ クリック: {totalClicks}
                                </p>
                              </div>
                              <p className="text-[10px] text-slate-400">{c.periodDays}日間</p>
                            </div>
                            <div className="flex gap-1">
                              {c.channels.map(ch => (
                                <span key={ch} className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                                  style={{ backgroundColor: `${CHANNEL_MAP[ch].color}10`, color: CHANNEL_MAP[ch].color }}>
                                  {CHANNEL_MAP[ch].name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* 設定タブ */}
                {tab === 'settings' && settings && (
                  <div className="space-y-4">
                    {/* ウォレット */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="text-xs font-bold text-slate-600 mb-3">
                        <Wallet size={12} className="inline mr-1" />Paletteウォレット
                      </h3>
                      <div className="flex items-end gap-2">
                        <p className="text-2xl font-black text-slate-800">{formatYen(settings.walletBalance)}</p>
                        <p className="text-[10px] text-slate-400 mb-1">残高</p>
                      </div>
                    </div>

                    {/* 媒体接続状況 */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="text-xs font-bold text-slate-600 mb-3">
                        <Zap size={12} className="inline mr-1" />媒体接続状況
                      </h3>
                      <div className="space-y-2">
                        {([
                          { key: 'googleConnected' as const, name: 'Google Ads', color: '#4285F4', oauthPath: '/api/oauth/google' },
                          { key: 'metaConnected' as const, name: 'Meta (Instagram/FB)', color: '#E4405F', oauthPath: '/api/oauth/instagram' },
                          { key: 'tiktokConnected' as const, name: 'TikTok Ads', color: '#000000', oauthPath: '' },
                          { key: 'xConnected' as const, name: 'X Ads', color: '#1DA1F2', oauthPath: '' },
                          { key: 'indeedConnected' as const, name: 'Indeed', color: '#2164F3', oauthPath: '' },
                          { key: 'lineConnected' as const, name: 'LINE Ads', color: '#06C755', oauthPath: '/api/oauth/line' },
                        ]).map(ch => {
                          const connected = settings[ch.key];
                          return (
                            <div key={ch.key} className="flex items-center justify-between py-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                                <span className="text-xs text-slate-600">{ch.name}</span>
                              </div>
                              {connected ? (
                                <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
                                  <Check size={10} />接続済み
                                </span>
                              ) : ch.oauthPath ? (
                                <a href={`${ch.oauthPath}?paletteId=${encodeURIComponent(selectedCustomer.paletteId)}`}
                                  className="text-[10px] px-2 py-0.5 rounded-lg font-bold text-white hover:opacity-80"
                                  style={{ backgroundColor: ch.color }}>
                                  接続する
                                </a>
                              ) : (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold text-slate-400 bg-slate-50">
                                  準備中
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
