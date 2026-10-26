import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { sellerSyncSchema } from "@/lib/validation";
import { createSpApiClient } from "@/lib/sp-api/client";

const DEFAULT_SELLER_ID = "mock-seller";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as { seller_id?: string };
  const parsed = sellerSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const sellerId = parsed.data.seller_id;

  // Idempotency: reject duplicate sync requests with the same key.
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const state = readMockState();
    const jobs: any[] = (state as any).sync_jobs || [];
    const existing = jobs.find(
      (j: any) => String(j.seller_id) === sellerId && String(j.idempotency_key) === idempotencyKey,
    );
    if (existing) {
      return NextResponse.json({
        operation_id: existing.id,
        status: existing.status,
        products_synced: existing.records_processed,
        seller_id: sellerId,
        message: "Sync already processed for this idempotency key.",
      });
    }
  }

  const state = readMockState();
  const operationId = crypto.randomUUID();
  const started = new Date().toISOString();

  // Register the sync job before any work begins.
  const jobs: any[] = (state as any).sync_jobs || [];
  jobs.push({
    id: operationId,
    organization_id: (state.organizations || [])[0]?.id || "",
    seller_id: sellerId,
    type: "catalog",
    status: "running",
    started_at: started,
    completed_at: null,
    records_processed: 0,
    idempotency_key: idempotencyKey || null,
    error: null,
  });
  (state as any).sync_jobs = jobs;

  state.sync_state = { status: "running", operation_id: operationId, started_at: started, seller_id: sellerId } as any;

  const spApi = createSpApiClient();

  const catalog: any[] = (state.amazon_catalog || []).map((entry: any) => ({
    asin: entry.asin,
    marketplace_id: entry.marketplace_id || "ATVPDKIKX0DER",
    seller_id: entry.seller_id || sellerId,
    ...entry,
  }));
  let synced = 0;
  for (const entry of catalog) {
    const asin = entry.asin;
    const marketplaceId = entry.marketplace_id || "ATVPDKIKX0DER";
    const entrySellerId = String(entry.seller_id || sellerId);
    if (entrySellerId !== sellerId) continue;

    // Prefer the SP-API client for reads when configured; fall back to mock catalog data.
    let listingsItem: any = null;
    if (spApi.isConfigured()) {
      try {
        listingsItem = await spApi.getCatalogItem(sellerId, asin);
      } catch {
        listingsItem = null;
      }
    }
    const source = listingsItem || entry;

    const product = (state.products || []).find(
      (p: any) => p.asin === asin && p.marketplace_id === marketplaceId && String(p.seller_id || "mock-seller") === sellerId,
    );
    if (product) {
      product.name = source.title || source.name;
      product.title = source.title || source.name;
      product.bullets = source.bullets || [];
      product.description = source.description || "";
      product.backend_keywords = source.backend_keywords || [];
      product.images = source.images || [];
      product.price = Number(source.price) || 0;
      product.stock = Number(source.stock) || 0;
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
        seller_id: sellerId,
        source: "amazon_sync",
        name: source.title || source.name,
        title: source.title || source.name,
        category: "General",
        parent_asin: null,
        variation_theme: null,
        supplier_id: sellerId,
        price: Number(source.price) || 0,
        bullets: source.bullets || [],
        description: source.description || "",
        backend_keywords: source.backend_keywords || [],
        images: source.images || [],
        sellable_units: Number(source.stock) || 0,
        stock: Number(source.stock) || 0,
        days_of_supply: Math.round(Number(source.stock) / 10),
        daily_velocity: 10.0,
        competitor_price: Number(source.price) || 0,
        market_price: Number(source.price) || 0,
        min_floor: Math.round((Number(source.price) || 0) * 0.8),
        max_price: Math.round((Number(source.price) || 0) * 1.2),
        unit_cost: Math.round((Number(source.price) || 0) * 0.5),
        lead_time_days: 21,
        supplier: "Mock Amazon Supplier",
        po_draft_id: null,
        suppressed: Boolean(source.suppressed),
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

  const completedAt = new Date().toISOString();
  const jobs2: any[] = (state as any).sync_jobs || [];
  const jobIndex = jobs2.findIndex((j: any) => j.id === operationId);
  if (jobIndex !== -1) {
    jobs2[jobIndex] = {
      ...jobs2[jobIndex],
      status: "succeeded",
      completed_at: completedAt,
      records_processed: synced,
    };
    (state as any).sync_jobs = jobs2;
  }

  (state.sync_state as any) = {
    status: "completed",
    operation_id: operationId,
    started_at: started,
    completed_at: completedAt,
    products_synced: synced,
    seller_id: sellerId,
  };

  const activity = state.activity || [];
  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: completedAt,
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
    seller_id: sellerId,
    message: "Mock sync complete",
  });
}
