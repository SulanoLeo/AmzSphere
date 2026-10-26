import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { competitorObservationSchema } from "@/lib/validation";

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

  const productAsin = searchParams.get("product_asin") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("page_size") || "50", 10) || 50));

  let observations: any[] = (state.competitor_observations || [])
    .filter((o: any) => String(o.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (productAsin) {
    observations = observations.filter((o: any) => String(o.product_asin) === productAsin);
  }

  observations = observations.sort((a: any, b: any) => String(b.observed_at).localeCompare(String(a.observed_at)));

  const total = observations.length;
  const pageData = observations.slice((page - 1) * pageSize, page * pageSize).map((o: any) => ({
    id: o.id,
    seller_id: o.seller_id,
    product_asin: o.product_asin,
    competitor_asin: o.competitor_asin,
    competitor_price: Number(o.competitor_price),
    price_gap: Number(o.price_gap),
    buy_box_eligible: Boolean(o.buy_box_eligible),
    observed_at: o.observed_at,
    created_at: o.created_at,
  }));

  return NextResponse.json({
    competitor_observations: pageData,
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
  const parsed = competitorObservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { product_asin, competitor_asin, competitor_price } = parsed.data;
  const state = readMockState();
  const product = (state.products || []).find(
    (p: any) => p.asin === product_asin && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${product_asin}` }, { status: 404 });
  }
  const ownPrice = Number(product.price);
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    product_asin,
    competitor_asin,
    competitor_price: Number(competitor_price),
    price_gap: ownPrice - Number(competitor_price),
    buy_box_eligible: ownPrice <= Number(competitor_price),
    observed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  (state.competitor_observations || []).unshift(record);
  if ((state.competitor_observations as any[]).length > 1000) {
    (state.competitor_observations as any[]).length = 1000;
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
