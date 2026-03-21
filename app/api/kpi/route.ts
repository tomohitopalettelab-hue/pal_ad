import { NextRequest, NextResponse } from 'next/server';
import { getCampaignsByPaletteId } from '../_lib/pal-ad-store';

export async function GET(req: NextRequest) {
  const cid = req.nextUrl.searchParams.get('cid');
  if (!cid) return NextResponse.json({ error: 'cid is required' }, { status: 400 });

  try {
    const campaigns = await getCampaignsByPaletteId(cid, 100);

    const active = campaigns.filter((c) => c.status === 'active').length;
    const paused = campaigns.filter((c) => c.status === 'paused').length;
    const completed = campaigns.filter((c) => c.status === 'completed').length;
    const totalBudget = campaigns.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);

    // Aggregate performance
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalSpend = 0;
    campaigns.forEach((c) => {
      const perf = Array.isArray(c.performance) ? c.performance : [];
      perf.forEach((p: Record<string, unknown>) => {
        totalImpressions += Number(p.impressions) || 0;
        totalClicks += Number(p.clicks) || 0;
        totalConversions += Number(p.conversions) || 0;
        totalSpend += Number(p.spend) || 0;
      });
    });

    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '-';
    const budgetUsedPct = totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(0) + '%' : '-';

    const lastCampaign = campaigns[0];
    const lastActivity = lastCampaign?.updatedAt || lastCampaign?.createdAt || null;

    let health: 'green' | 'yellow' | 'red' = 'green';
    if (active === 0 && campaigns.length > 0) health = 'yellow';
    if (totalSpend / totalBudget > 0.9 && totalBudget > 0) health = 'red';

    return NextResponse.json({
      service: 'pal_ad',
      serviceName: 'Pal Ad',
      paletteId: cid,
      kpi: {
        activeCampaigns: active,
        paused,
        completed,
        totalBudget: `¥${totalBudget.toLocaleString()}`,
        budgetUsed: budgetUsedPct,
        avgCtr,
        totalImpressions,
        totalClicks,
      },
      health,
      lastActivity,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
