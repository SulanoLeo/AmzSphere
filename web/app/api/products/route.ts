import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const US_MARKETPLACE_ID = "ATVPDKIKX0DER";
const PAGE_SIZE_DEFAULT = 50;

function productDefaults(product: any): any {
  product.id = product.id ?? crypto.randomUUID();
  product.marketplace_id = product.marketplace_id ?? US_MARKETPLACE_ID;
  product.source = product.source ?? "amazon_sync";
  product.title = product.title ?? product.name ?? "";
  product.bullets = product.bullets ?? [];
  product.description = product.description ?? "";
  product.backend_keywords = product.backend_keywords ?? [];
  product.images = product.images ?? [];
  product.sellable_units = product.sellable_units ?? product.stock ?? 0;
  product.days_of_supply = product.days_of_supply ?? 0;
  return product;
}

function normalizeState(state: any): any {
  (state.products || []).forEach((p: any) => productDefaults(p));
  state.global_products = state.global_products || [];
  if ((state.global_products || []).length !== (state.products || []).length) {
    state.global_products = (state.products || []).map((p: any) => ({ ...p }));
  }
  state.product_revisions = state.product_revisions || [];
  state.amazon_catalog = state.amazon_catalog || [];
  state.sync_state = state.sync_state || { status: "not_synced" };
  return state;
}

function findProduct(state: any, ref: string): any {
  return (state.products || []).find((p: any) => p.id === ref || p.asin === ref) ?? null;
}

function suppressedFor(state: any, product: any): boolean {
  if (product.suppressed) return true;
  return (state.marketplace_listings || []).some(
    (listing: any) =>
      listing.global_product_id === product.asin &&
      String(listing.status || "").toLowerCase() === "suppressed",
  );
}

function sortKey(key: string) {
  return (product: any) => {
    const value = product[key];
    return [
      value == null ? 1 : 0,
      typeof value === "number" ? value : String(value || "").toLowerCase(),
    ];
  };
}

export async function GET(request: Request) {
  const state = normalizeState(readMockState());
  const { searchParams } = new URL(request.url);

  const optStatus = searchParams.get("opt_status") || undefined;
  const lowStock = searchParams.get("low_stock") !== null;
  const suppressed = searchParams.get("suppressed") !== null;
  const search = (searchParams.get("search") || "").toLowerCase();
  const sort = (searchParams.get("sort") || "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("page_size") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT),
  );

  let products = [...(state.products || [])];

  if (optStatus) {
    products = products.filter((p: any) => p.opt_status === optStatus);
  }
  if (lowStock) {
    products = products.filter((p: any) => Number(p.days_of_supply || 0) < 15);
  }
  if (suppressed) {
    products = products.filter((p: any) => suppressedFor(state, p));
  }
  if (search) {
    products = products.filter(
      (p: any) =>
        `${p.name || ""} ${p.title || ""} ${p.asin || ""} ${p.sku || ""} ${p.category || ""}`
          .toLowerCase()
          .includes(search),
    );
  }

  if (sort) {
    const reverse = sort.startsWith("-");
    const key = sort.replace(/^-/, "");
    products.sort((a: any, b: any) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return reverse ? -1 : 1;
      if (bv == null) return reverse ? 1 : -1;
      const cmp = typeof av === "number" ? av - bv : String(av || "").toLowerCase().localeCompare(String(bv || "").toLowerCase());
      return reverse ? -cmp : cmp;
    });
  }

  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageProducts = products.slice(start, start + pageSize);

  return NextResponse.json({
    products: pageProducts,
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  const body = (await request.json()) as Partial<Record<string, any>>;
  const asin = body.asin;
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ detail: "Provide a valid 10-character ASIN." }, { status: 422 });
  }
  const existing = (state.products || []).find((p: any) => p.asin === asin);
  if (existing) {
    return NextResponse.json({ detail: `Product already exists: ${asin}` }, { status: 409 });
  }
  const newProduct: any = {
    id: crypto.randomUUID(),
    asin,
    sku: body.sku || asin,
    marketplace_id: body.marketplace_id || US_MARKETPLACE_ID,
    source: body.source ?? "manual",
    name: body.name || "",
    title: body.title || body.name || "",
    category: body.category || "General",
    price: Number(body.price) || 0,
    bullets: body.bullets || [],
    description: body.description || "",
    backend_keywords: body.backend_keywords || [],
    images: body.images || [],
    sellable_units: Number(body.sellable_units) || Number(body.stock) || 0,
    stock: Number(body.stock) || 0,
    days_of_supply: Number(body.days_of_supply) || 0,
    daily_velocity: Number(body.daily_velocity) || 0,
    competitor_price: Number(body.competitor_price) || 0,
    market_price: Number(body.market_price) || 0,
    min_floor: Number(body.min_floor) || 0,
    max_price: Number(body.max_price) || 0,
    unit_cost: Number(body.unit_cost) || 0,
    lead_time_days: Number(body.lead_time_days) || 21,
    supplier: body.supplier || "",
    po_draft_id: body.po_draft_id ?? null,
    suppressed: Boolean(body.suppressed),
    last_synced_at: body.last_synced_at || null,
    sync_status: body.sync_status || "synced",
    last_optimized_at: null,
    opt_score: 0,
    opt_issues: [],
    opt_status: "needs_optimization",
  };
  productDefaults(newProduct);
  const salesHistory: Record<string, any> = state.sales_history || {};
  const velocity = Math.round(Number(newProduct.daily_velocity) || 10);
  salesHistory[newProduct.sku] = Array(30).fill(velocity);
  state.sales_history = salesHistory as any;
  (state.products || []).push(newProduct);
  (state.global_products || []).push({ ...newProduct });
  writeMockState(state);
  return NextResponse.json(newProduct);
}
