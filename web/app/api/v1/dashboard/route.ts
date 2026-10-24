import { NextResponse } from "next/server";
import { query, queryOne, transaction } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

interface CatalogItemRow {
  id: string;
  asin: string;
  sku: string;
  product_type: string;
  vendor_name: string | null;
  sellable_quantity: number | null;
  sales_7d: number;
  sales_30d: number;
  sales_90d: number;
}

export async function GET(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get("seller_id");

  if (!sellerId) {
    return jsonError("seller_id is required", 400);
  }

  const seller = await queryOne<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM sellers WHERE id = $1`,
    [sellerId]
  );
  assertSellerTenant(seller, workspaceUser);

  const items: CatalogItemRow[] = await query(
    `SELECT c.id, c.asin, c.sku, c.product_type, v.name AS vendor_name,
            COALESCE(i.sellable_quantity, 0) AS sellable_quantity,
            COALESCE(s7.units, 0) AS sales_7d,
            COALESCE(s30.units, 0) AS sales_30d,
            COALESCE(s90.units, 0) AS sales_90d
     FROM catalog_items c
     LEFT JOIN vendors v ON c.vendor_id = v.id
     LEFT JOIN LATERAL (
       SELECT sellable_quantity FROM inventory_snapshots
       WHERE catalog_item_id = c.id ORDER BY captured_at DESC LIMIT 1
     ) i ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(units_ordered), 0) AS units FROM sales_daily
       WHERE catalog_item_id = c.id AND sales_date >= CURRENT_DATE - INTERVAL '7 days'
     ) s7 ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(units_ordered), 0) AS units FROM sales_daily
       WHERE catalog_item_id = c.id AND sales_date >= CURRENT_DATE - INTERVAL '30 days'
     ) s30 ON true
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(units_ordered), 0) AS units FROM sales_daily
       WHERE catalog_item_id = c.id AND sales_date >= CURRENT_DATE - INTERVAL '90 days'
     ) s90 ON true
     WHERE c.seller_id = $1`,
    [sellerId]
  );

  const products = items.map((item) => {
    const stock = item.sellable_quantity ?? 0;
    const velocity7d = item.sales_7d;
    const velocity30d = item.sales_30d;
    const velocity90d = item.sales_90d;
    const daysOfSupply = stock > 0 && velocity7d > 0 ? Math.round(stock / (velocity7d / 7)) : 0;
    const score = 100;
    const status = score < 70 ? "needs_optimization" : "optimized";
    const reorderFlag = daysOfSupply > 0 && daysOfSupply < 15;

    return {
      asin: item.asin,
      sku: item.sku,
      vendor: item.vendor_name,
      stock: stock || null,
      velocity_7d: velocity7d,
      velocity_30d: velocity30d,
      velocity_90d: velocity90d,
      days_supply: daysOfSupply || null,
      reorder_flag: reorderFlag,
      opt_score: score,
      opt_status: status,
      needs_optimization: status === "needs_optimization",
    };
  });

  const needsOptimizationCount = products.filter((p) => p.needs_optimization).length;
  const ranked = [...products].sort((a, b) => {
    const paScore = 100 - a.opt_score;
    const pbScore = 100 - b.opt_score;
    return pbScore * b.velocity_7d - paScore * a.velocity_7d;
  });
  const top10 = ranked.slice(0, 10).map((p) => ({
    asin: p.asin,
    sku: p.sku,
    name: "",
    opt_score: p.opt_score,
    opt_status: p.opt_status,
    impact: Math.round((100 - p.opt_score) * p.velocity_7d),
    days_of_supply: p.days_supply,
    sellable_units: p.stock || 0,
    opt_issues: [],
  }));

  const pendingPurchaseOrders = await query<any>(
    `SELECT id, vendor_id, currency, total_amount_minor, lines, status FROM purchase_orders
     WHERE seller_id = $1 AND status = 'pending_review' ORDER BY created_at DESC`,
    [sellerId]
  );

  const vendorNames: Record<string, string> = {};
  for (const po of pendingPurchaseOrders) {
    if (po.vendor_id && !vendorNames[po.vendor_id]) {
      const vendor = await queryOne<{ name: string }>(`SELECT name FROM vendors WHERE id = $1`, [po.vendor_id]);
      vendorNames[po.vendor_id] = vendor?.name || "Unknown Supplier";
    }
  }

  return NextResponse.json({
    seller_id: sellerId,
    marketplace_id: "ATVPDKIKX0DER",
    products,
    pending_purchase_orders: pendingPurchaseOrders.map((po: any) => ({
      id: po.id,
      vendor: vendorNames[po.vendor_id] || "Unknown Supplier",
      status: po.status,
      currency: po.currency,
      total_amount_minor: po.total_amount_minor,
      lines: po.lines || [],
    })),
    sync_status: "not_synced",
    last_synced_at: null,
    needs_optimization_count: needsOptimizationCount,
    top_10_by_impact: top10,
  });
}
