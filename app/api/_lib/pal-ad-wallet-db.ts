import { sql } from '@vercel/postgres';

// ===== テーブル自動作成 =====

let tablesCreated = false;

export const ensureWalletTables = async () => {
  if (tablesCreated) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS pal_ad_wallets (
        id TEXT PRIMARY KEY,
        palette_id TEXT UNIQUE NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS pal_ad_transactions (
        id TEXT PRIMARY KEY,
        palette_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance INTEGER NOT NULL,
        description TEXT,
        campaign_id TEXT,
        square_payment_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS pal_ad_tx_palette_id_idx ON pal_ad_transactions (palette_id)`;
    await sql`CREATE INDEX IF NOT EXISTS pal_ad_tx_created_at_idx ON pal_ad_transactions (created_at)`;
    tablesCreated = true;
  } catch (err) {
    console.error('Failed to create wallet tables:', err);
  }
};

// ===== ウォレット残高 =====

export const getWalletBalance = async (paletteId: string): Promise<number> => {
  await ensureWalletTables();
  const result = await sql`SELECT balance FROM pal_ad_wallets WHERE palette_id = ${paletteId}`;
  return result.rows[0]?.balance ?? 0;
};

export const ensureWallet = async (paletteId: string): Promise<number> => {
  await ensureWalletTables();
  const result = await sql`
    INSERT INTO pal_ad_wallets (id, palette_id, balance)
    VALUES (${'wal_' + Date.now()}, ${paletteId}, 0)
    ON CONFLICT (palette_id) DO NOTHING
    RETURNING balance
  `;
  if (result.rows.length > 0) return result.rows[0].balance;
  return await getWalletBalance(paletteId);
};

// ===== チャージ =====

export const chargeWalletDb = async (
  paletteId: string,
  amount: number,
  description?: string,
  squarePaymentId?: string,
): Promise<{ balance: number; transactionId: string }> => {
  await ensureWalletTables();
  await ensureWallet(paletteId);

  // 残高更新
  const walletResult = await sql`
    UPDATE pal_ad_wallets
    SET balance = balance + ${amount}, updated_at = NOW()
    WHERE palette_id = ${paletteId}
    RETURNING balance
  `;
  const newBalance = walletResult.rows[0]?.balance ?? amount;

  // 取引記録
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO pal_ad_transactions (id, palette_id, type, amount, balance, description, square_payment_id)
    VALUES (${txId}, ${paletteId}, 'charge', ${amount}, ${newBalance}, ${description || 'Paletteウォレット チャージ'}, ${squarePaymentId || null})
  `;

  return { balance: newBalance, transactionId: txId };
};

// ===== 引き落とし =====

export const spendFromWalletDb = async (
  paletteId: string,
  amount: number,
  description: string,
  campaignId?: string,
): Promise<{ success: boolean; balance?: number; transactionId?: string; error?: string }> => {
  await ensureWalletTables();
  await ensureWallet(paletteId);

  const currentBalance = await getWalletBalance(paletteId);
  if (currentBalance < amount) {
    return {
      success: false,
      error: `残高不足です（残高: ¥${currentBalance.toLocaleString()}, 必要額: ¥${amount.toLocaleString()}）`,
    };
  }

  const walletResult = await sql`
    UPDATE pal_ad_wallets
    SET balance = balance - ${amount}, updated_at = NOW()
    WHERE palette_id = ${paletteId} AND balance >= ${amount}
    RETURNING balance
  `;

  if (walletResult.rows.length === 0) {
    return { success: false, error: '残高不足です（並行処理による競合）' };
  }

  const newBalance = walletResult.rows[0].balance;
  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO pal_ad_transactions (id, palette_id, type, amount, balance, description, campaign_id)
    VALUES (${txId}, ${paletteId}, 'spend', ${-amount}, ${newBalance}, ${description}, ${campaignId || null})
  `;

  return { success: true, balance: newBalance, transactionId: txId };
};

// ===== 取引履歴 =====

export const getTransactionsDb = async (paletteId: string, limit = 50) => {
  await ensureWalletTables();
  const result = await sql`
    SELECT id, palette_id, type, amount, balance, description, campaign_id, square_payment_id, created_at
    FROM pal_ad_transactions
    WHERE palette_id = ${paletteId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return result.rows.map(row => ({
    id: row.id,
    paletteId: row.palette_id,
    type: row.type as 'charge' | 'spend' | 'refund',
    amount: row.amount,
    balance: row.balance,
    description: row.description,
    campaignId: row.campaign_id,
    squarePaymentId: row.square_payment_id,
    createdAt: row.created_at?.toISOString() || '',
  }));
};
