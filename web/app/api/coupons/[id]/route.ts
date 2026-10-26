import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { couponPatchSchema } from "@/lib/validation";

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

export async function PATCH(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = couponPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state = readMockState();
  const c = (state.coupons || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!c) {
    return NextResponse.json({ detail: `Coupon not found: ${id}` }, { status: 404 });
  }
  Object.assign(c, parsed.data);
  c.seller_id = sellerId;
  c.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: c.id,
    seller_id: c.seller_id,
    code: c.code,
    asin: c.asin,
    discount_type: c.discount_type,
    discount_value: Number(c.discount_value),
    min_purchase: Number(c.min_purchase),
    max_redemptions: c.max_redemptions === null || c.max_redemptions === undefined ? null : Number(c.max_redemptions),
    redeemed_count: Number(c.redeemed_count),
    start_date: c.start_date,
    end_date: c.end_date,
    status: c.status,
    created_at: c.created_at,
    updated_at: c.updated_at,
  });
}
