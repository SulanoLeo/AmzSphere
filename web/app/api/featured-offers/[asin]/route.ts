import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { featuredOfferSchema } from "@/lib/validation";

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

type Context = { params: Promise<{ asin: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { asin } = await params;
  const state = readMockState();
  const product = (state.products || []).find(
    (p: any) => p.asin === asin && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${asin}` }, { status: 404 });
  }
  const fo = (state.featured_offers || []).find((x: any) => String(x.asin) === asin);
  if (!fo) {
    return NextResponse.json({ detail: `Featured offer not set for ASIN: ${asin}` }, { status: 404 });
  }
  return NextResponse.json({
    id: fo.id,
    seller_id: fo.seller_id,
    asin: fo.asin,
    is_buy_box_winner: Boolean(fo.is_buy_box_winner),
    offer_price: Number(fo.offer_price),
    lowest_price: Number(fo.lowest_price),
    shipping_cost: Number(fo.shipping_cost),
    prime_eligible: Boolean(fo.prime_eligible),
    fulfilled_by_amazon: Boolean(fo.fulfilled_by_amazon),
    observed_at: fo.observed_at,
    created_at: fo.created_at,
  });
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { asin } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = featuredOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { is_buy_box_winner, offer_price, lowest_price } = parsed.data;
  const state = readMockState();
  const product = (state.products || []).find(
    (p: any) => p.asin === asin && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${asin}` }, { status: 404 });
  }
  const now = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    asin,
    is_buy_box_winner: Boolean(is_buy_box_winner),
    offer_price: Number(offer_price),
    lowest_price: Number(lowest_price),
    shipping_cost: 0,
    prime_eligible: true,
    fulfilled_by_amazon: true,
    observed_at: now,
    created_at: now,
  };
  (state.featured_offers || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
