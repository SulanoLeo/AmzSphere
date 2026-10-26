import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";
import { impactRank, computeOptScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);

  const state = readMockState();
  const { searchParams } = new URL(request.url);

  const products: any[] = (state.products || [])
    .filter((p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .map((p: any) => {
    const history: number[] = ((state.sales_history as Record<string, any>) || {})[p.sku] || [];
    const velocity7d = history.slice(-7).reduce((sum, v) => sum + v, 0);
    const velocity30d = history.slice(-30).reduce((sum, v) => sum + v, 0);
    const velocity90d = history.slice(-90).reduce((sum, v) => sum + v, 0);
    const daysOfSupply = Number(p.days_of_supply) || 0;
    const optResult = computeOptScore(p);
    return {
      asin: p.asin,
      sku: p.sku,
      vendor: p.supplier || null,
      stock: Number(p.stock) || null,
      velocity_7d: velocity7d,
      velocity_30d: velocity30d,
      velocity_90d: velocity90d,
      days_supply: daysOfSupply || null,
      reorder_flag: daysOfSupply > 0 && daysOfSupply < 15,
      opt_score: optResult.score,
      opt_status: optResult.status,
      needs_optimization: optResult.status === "needs_optimization",
    };
  });

  const needsOptimizationCount = products.filter((p) => p.needs_optimization).length;

  const ranked = [...products].sort((a, b) => {
    const pa = state.products.find((sp: any) => sp.asin === a.asin) || a;
    const pb = state.products.find((sp: any) => sp.asin === b.asin) || b;
    return impactRank(pb) - impactRank(pa);
  });

  const top10 = ranked.slice(0, 10).map((p) => {
    const sp = state.products.find((s: any) => s.asin === p.asin) || p;
    return {
      asin: p.asin,
      sku: p.sku,
      name: sp.name || sp.title || "",
      opt_score: p.opt_score,
      opt_status: p.opt_status,
      impact: Math.round(impactRank(sp)),
      days_of_supply: p.days_supply,
      sellable_units: Number(sp.sellable_units) || Number(sp.stock) || 0,
      opt_issues: sp.opt_issues || [],
    };
  });

  const syncState = (state.sync_state || { status: "not_synced" }) as any;
  const pendingPurchaseOrders = (state.purchase_orders || [])
    .filter((po: any) => (po.status === "draft" || po.status === "pending") && String(po.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .map((po: any) => ({
      id: po.id,
      vendor: po.supplier || "Unknown Supplier",
      status: po.status,
      currency: "USD",
      total_amount_minor: Math.round((Number(po.units) || 0) * 100),
      lines: [{ sku: "", asin: po.product_asin || "", quantity: Number(po.units) || 0 }],
    }));

  const periodStart = searchParams.get("period_start") || undefined;
  const periodEnd = searchParams.get("period_end") || undefined;

  const financialRecords = (state.financial_records || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .filter((r: any) => {
      if (periodStart && r.period_start < periodStart) return false;
      if (periodEnd && r.period_end > periodEnd) return false;
      return true;
    });

  let revenue = 0;
  let cogs = 0;
  let fees = 0;
  let netProfit = 0;
  let unitsSold = 0;
  let ordersCount = 0;
  const byCategory: Record<string, { revenue: number; net_profit: number; units_sold: number }> = {};
  const salesHistory: Record<string, number[]> = state.sales_history || {};

  if (financialRecords.length > 0) {
    for (const r of financialRecords) {
      revenue += Number(r.revenue) || 0;
      cogs += Number(r.cogs) || 0;
      fees += Number(r.fees) || 0;
      netProfit += Number(r.net_profit) || 0;
      unitsSold += Number(r.units_sold) || 0;
      ordersCount += Number(r.orders_count) || 0;
    }
  } else {
    for (const p of products) {
      const history: number[] = (salesHistory || {})[p.sku] || [];
      const catUnits = history.reduce((sum: number, v: number) => sum + v, 0);
      const catRev = catUnits * Number(p.price || 0);
      const category = p.category || "Uncategorized";
      if (!byCategory[category]) byCategory[category] = { revenue: 0, net_profit: 0, units_sold: 0 };
      byCategory[category].revenue += catRev;
      byCategory[category].units_sold += catUnits;
      revenue += catRev;
      unitsSold += catUnits;
    }
    cogs = Math.round(revenue * 0.4);
    fees = Math.round(revenue * 0.15);
    netProfit = revenue - cogs - fees;
    ordersCount = products.length;
  }

  const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

  return NextResponse.json({
    seller_id: sellerId,
    marketplace_id: "ATVPDKIKX0DER",
    products,
    pending_purchase_orders: pendingPurchaseOrders,
    sync_status: syncState.status,
    last_synced_at: syncState.completed_at || null,
    needs_optimization_count: needsOptimizationCount,
    top_10_by_impact: top10,
    profitability: {
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      fees: Math.round(fees),
      net_profit: Math.round(netProfit),
      margin_pct: marginPct,
    },
    sales_velocity: {
      units_7d: products.reduce((sum: number, p: any) => sum + Number((salesHistory || {})[p.sku]?.slice(-7).reduce((a: number, b: number) => a + b, 0) || 0), 0),
      units_30d: products.reduce((sum: number, p: any) => sum + Number((salesHistory || {})[p.sku]?.slice(-30).reduce((a: number, b: number) => a + b, 0) || 0), 0),
      units_90d: products.reduce((sum: number, p: any) => sum + Number((salesHistory || {})[p.sku]?.slice(-90).reduce((a: number, b: number) => a + b, 0) || 0), 0),
    },
    variation_groups: new Set(products.filter((p: any) => p.parent_asin).map((p: any) => p.parent_asin)).size,
  });
}
