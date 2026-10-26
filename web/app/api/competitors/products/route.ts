import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { competitorProductSchema } from "@/lib/validation";

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

  const asin = searchParams.get("asin") || undefined;
  const buyBoxWinner = searchParams.get("buy_box_winner");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("page_size") || "50", 10) || 50));

  let products: any[] = (state.competitor_products || [])
    .filter((c: any) => String(c.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (asin) {
    products = products.filter((c: any) => String(c.asin) === asin);
  }
  if (buyBoxWinner !== null) {
    const winner = buyBoxWinner === "true";
    products = products.filter((c: any) => Boolean(c.buy_box_winner) === winner);
  }

  products = products.sort((a: any, b: any) => String(b.observed_at).localeCompare(String(a.observed_at)));

  const total = products.length;
  const pageData = products.slice((page - 1) * pageSize, page * pageSize).map((c: any) => ({
    id: c.id,
    seller_id: c.seller_id,
    asin: c.asin,
    title: c.title,
    brand: c.brand,
    price: Number(c.price),
    marketplace_id: c.marketplace_id,
    category: c.category,
    buy_box_winner: Boolean(c.buy_box_winner),
    rating: c.rating,
    review_count: Number(c.review_count),
    in_stock: Boolean(c.in_stock),
    observed_at: c.observed_at,
    created_at: c.created_at,
  }));

  return NextResponse.json({
    competitor_products: pageData,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = competitorProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    asin: data.asin,
    title: data.title,
    brand: data.brand ?? null,
    price: Number(data.price),
    marketplace_id: data.marketplace_id,
    category: data.category ?? null,
    buy_box_winner: Boolean(data.buy_box_winner),
    rating: data.rating ?? null,
    review_count: Number(data.review_count),
    in_stock: Boolean(data.in_stock),
    observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  (state.competitor_products || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
