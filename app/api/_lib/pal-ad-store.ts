import { MOCK_CAMPAIGNS, MOCK_SETTINGS, MOCK_TRANSACTIONS, type Campaign, type AdSettings, type WalletTransaction } from './mock-data';

// Phase 1: モックデータを使用。Phase 2でVercel Postgres に移行。

const campaignsStore = new Map<string, Campaign[]>();
const settingsStore = new Map<string, AdSettings>();
const transactionsStore = new Map<string, WalletTransaction[]>();

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
  MOCK_TRANSACTIONS.forEach((t) => {
    const list = transactionsStore.get(t.paletteId) || [];
    list.push(t);
    transactionsStore.set(t.paletteId, list);
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

export const upsertSettings = async (paletteId: string, data: Partial<AdSettings> & Record<string, unknown>): Promise<AdSettings> => {
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

// ===== ウォレット機能 =====

export const getTransactionsByPaletteId = async (paletteId: string, limit = 50): Promise<WalletTransaction[]> => {
  ensureInit();
  const all = transactionsStore.get(paletteId) || [];
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
};

export const chargeWallet = async (paletteId: string, amount: number, description?: string): Promise<WalletTransaction> => {
  ensureInit();
  const settings = await getSettingsByPaletteId(paletteId) || await upsertSettings(paletteId, {});
  const newBalance = settings.walletBalance + amount;
  await upsertSettings(paletteId, { walletBalance: newBalance });

  const tx: WalletTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    paletteId,
    type: 'charge',
    amount,
    balance: newBalance,
    description: description || 'Paletteウォレット チャージ',
    createdAt: new Date().toISOString(),
  };
  const list = transactionsStore.get(paletteId) || [];
  list.push(tx);
  transactionsStore.set(paletteId, list);
  return tx;
};

export const spendFromWallet = async (
  paletteId: string,
  amount: number,
  description: string,
  campaignId?: string,
): Promise<{ success: boolean; transaction?: WalletTransaction; error?: string }> => {
  ensureInit();
  const settings = await getSettingsByPaletteId(paletteId) || await upsertSettings(paletteId, {});
  if (settings.walletBalance < amount) {
    return { success: false, error: `残高不足です（残高: ¥${settings.walletBalance.toLocaleString()}, 必要額: ¥${amount.toLocaleString()}）` };
  }

  const newBalance = settings.walletBalance - amount;
  await upsertSettings(paletteId, { walletBalance: newBalance });

  const tx: WalletTransaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    paletteId,
    type: 'spend',
    amount: -amount,
    balance: newBalance,
    description,
    campaignId,
    createdAt: new Date().toISOString(),
  };
  const list = transactionsStore.get(paletteId) || [];
  list.push(tx);
  transactionsStore.set(paletteId, list);
  return { success: true, transaction: tx };
};

export type { Campaign, AdSettings, WalletTransaction };
