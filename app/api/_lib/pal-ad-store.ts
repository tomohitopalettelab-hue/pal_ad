import { MOCK_CAMPAIGNS, MOCK_SETTINGS, type Campaign, type AdSettings } from './mock-data';

// Phase 1: モックデータを使用。Phase 2でVercel Postgres に移行。

const campaignsStore = new Map<string, Campaign[]>();
const settingsStore = new Map<string, AdSettings>();

// 初期化：モックデータをロード
let initialized = false;
const ensureInit = () => {
  if (initialized) return;
  initialized = true;
  MOCK_CAMPAIGNS.forEach((c) => {
    const list = campaignsStore.get(c.paletteId) || [];
    list.push(c);
    campaignsStore.set(c.paletteId, list);
  });
  MOCK_SETTINGS.forEach((s) => {
    settingsStore.set(s.paletteId, s);
  });
};

export const getCampaignsByPaletteId = async (paletteId: string, limit = 20): Promise<Campaign[]> => {
  ensureInit();
  const all = campaignsStore.get(paletteId) || [];
  return all
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
};

export const getCampaignById = async (id: string): Promise<Campaign | null> => {
  ensureInit();
  for (const list of campaignsStore.values()) {
    const found = list.find((c) => c.id === id);
    if (found) return found;
  }
  return null;
};

export const createCampaign = async (data: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> => {
  ensureInit();
  const now = new Date().toISOString();
  const campaign: Campaign = {
    ...data,
    id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };
  const list = campaignsStore.get(campaign.paletteId) || [];
  list.push(campaign);
  campaignsStore.set(campaign.paletteId, list);
  return campaign;
};

export const updateCampaign = async (id: string, data: Partial<Campaign>): Promise<Campaign | null> => {
  ensureInit();
  for (const [paletteId, list] of campaignsStore.entries()) {
    const idx = list.findIndex((c) => c.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
      campaignsStore.set(paletteId, list);
      return list[idx];
    }
  }
  return null;
};

export const getSettingsByPaletteId = async (paletteId: string): Promise<AdSettings | null> => {
  ensureInit();
  return settingsStore.get(paletteId) || null;
};

export const upsertSettings = async (paletteId: string, data: Partial<AdSettings>): Promise<AdSettings> => {
  ensureInit();
  const existing = settingsStore.get(paletteId);
  const now = new Date().toISOString();
  const settings: AdSettings = {
    id: existing?.id || `set_${Date.now()}`,
    paletteId,
    walletBalance: 0,
    googleConnected: false,
    metaConnected: false,
    tiktokConnected: false,
    xConnected: false,
    indeedConnected: false,
    lineConnected: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    ...existing,
    ...data,
  };
  settingsStore.set(paletteId, settings);
  return settings;
};

export type { Campaign, AdSettings };
