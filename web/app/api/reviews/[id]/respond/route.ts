import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import type { Review } from "@/lib/provider/types";

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

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const response = body.response;
  if (typeof response !== "string" || response.trim().length === 0) {
    return NextResponse.json({ detail: "response is required." }, { status: 422 });
  }
  const state = readMockState();
  const review = ((state.reviews || []).find(
    (r: any) => r.id === id && String(r.seller_id || DEFAULT_SELLER_ID) === sellerId,
  ) as unknown) as Review | null;
  if (!review) {
    return NextResponse.json({ detail: `Review not found: ${id}` }, { status: 404 });
  }
  review.response = response.trim();
  review.responded_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: review.id,
    seller_id: review.seller_id,
    product: review.product,
    asin: review.asin,
    marketplace_id: review.marketplace_id,
    rating: Number(review.rating),
    date: review.date,
    theme: review.theme,
    text: review.text,
    customer_name: review.customer_name,
    verified_purchase: Boolean(review.verified_purchase),
    response: review.response,
    responded_at: review.responded_at,
  });
}
