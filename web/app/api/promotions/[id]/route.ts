import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { promotionPatchSchema } from "@/lib/validation";

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
  const parsed = promotionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state = readMockState();
  const p = (state.promotions || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!p) {
    return NextResponse.json({ detail: `Promotion not found: ${id}` }, { status: 404 });
  }
  Object.assign(p, parsed.data);
  p.seller_id = sellerId;
  p.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: p.id,
    seller_id: p.seller_id,
    name: p.name,
    type: p.type,
    discount_value: Number(p.discount_value),
    min_purchase: Number(p.min_purchase),
    max_discount: p.max_discount === null || p.max_discount === undefined ? null : Number(p.max_discount),
    start_date: p.start_date,
    end_date: p.end_date,
    status: p.status,
    redemption_count: Number(p.redemption_count),
    asin_list: p.asin_list || [],
    created_at: p.created_at,
    updated_at: p.updated_at,
  });
}
