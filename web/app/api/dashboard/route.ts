import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";
import { impactRank, computeOptScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const state = readMockState();
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get("seller_id") || "mock-seller";

  const products: any[] = (state.products || []).map((p: any) => {
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
    .filter((po: any) => po.status === "draft" || po.status === "pending")
    .map((po: any) => ({
      id: po.id,
      vendor: po.supplier || "Unknown Supplier",
      status: po.status,
      currency: "USD",
      total_amount_minor: Math.round((Number(po.units) || 0) * 100),
      lines: [{ sku: "", asin: po.product_asin || "", quantity: Number(po.units) || 0 }],
    }));

  return NextResponse.json({
    seller_id: sellerId,
    marketplace_id: "ATVPDKIKX0DER",
    products,
    pending_purchase_orders: pendingPurchaseOrders,
    sync_status: syncState.status,
    last_synced_at: syncState.completed_at || null,
    needs_optimization_count: needsOptimizationCount,
    top_10_by_impact: top10,
  });
}
