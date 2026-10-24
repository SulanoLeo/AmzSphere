import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as { seller_id?: string };
  const sellerId = body.seller_id;
  if (!sellerId) {
    return NextResponse.json({ detail: "Select a seller." }, { status: 400 });
  }

  const state = readMockState();
  const operationId = crypto.randomUUID();
  const started = new Date().toISOString();
  state.sync_state = { status: "running", operation_id: operationId, started_at: started } as any;

  const catalog: any[] = (state.amazon_catalog || []).map((entry: any) => ({
    asin: entry.asin,
    marketplace_id: entry.marketplace_id || "ATVPDKIKX0DER",
    ...entry,
  }));
  let synced = 0;
  for (const entry of catalog) {
    const asin = entry.asin;
    const marketplaceId = entry.marketplace_id || "ATVPDKIKX0DER";
    const product = (state.products || []).find(
      (p: any) => p.asin === asin && p.marketplace_id === marketplaceId,
    );
    if (product) {
      product.name = entry.title || entry.name;
      product.title = entry.title || entry.name;
      product.bullets = entry.bullets || [];
      product.description = entry.description || "";
      product.backend_keywords = entry.backend_keywords || [];
      product.images = entry.images || [];
      product.price = Number(entry.price) || 0;
      product.stock = Number(entry.stock) || 0;
      product.sellable_units = product.stock;
      product.days_of_supply = Math.round(product.stock / Math.max(Number(product.daily_velocity) || 10, 0.1));
      product.last_synced_at = started;
      product.sync_status = "synced";
    } else {
      state.products.push({
        id: crypto.randomUUID(),
        asin,
        sku: entry.sku || asin,
        marketplace_id: marketplaceId,
        source: "amazon_sync",
        name: entry.title || entry.name,
        title: entry.title || entry.name,
        category: "General",
        price: Number(entry.price) || 0,
        bullets: entry.bullets || [],
        description: entry.description || "",
        backend_keywords: entry.backend_keywords || [],
        images: entry.images || [],
        sellable_units: Number(entry.stock) || 0,
        stock: Number(entry.stock) || 0,
        days_of_supply: Math.round(Number(entry.stock) / 10),
        daily_velocity: 10.0,
        competitor_price: Number(entry.price) || 0,
        market_price: Number(entry.price) || 0,
        min_floor: Math.round((Number(entry.price) || 0) * 0.8),
        max_price: Math.round((Number(entry.price) || 0) * 1.2),
        unit_cost: Math.round((Number(entry.price) || 0) * 0.5),
        lead_time_days: 21,
        supplier: "Mock Amazon Supplier",
        po_draft_id: null,
        suppressed: Boolean(entry.suppressed),
        last_synced_at: started,
        sync_status: "synced",
        last_optimized_at: null,
        opt_score: 0,
        opt_issues: [],
        opt_status: "needs_optimization",
      });
    }
    synced += 1;
  }

  (state.sync_state as any) = {
    status: "completed",
    operation_id: operationId,
    started_at: started,
    completed_at: new Date().toISOString(),
    products_synced: synced,
  };

  const activity = state.activity || [];
  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category: "sync",
    title: "Mock Amazon seller data synced",
    detail: `${synced} product(s) upserted by ASIN and marketplace.`,
  });
  if (activity.length > 120) activity.length = 120;

  writeMockState(state);

  return NextResponse.json({
    operation_id: operationId,
    status: "completed",
    products_synced: synced,
    message: "Mock sync complete",
  });
}
