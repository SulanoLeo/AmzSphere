import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState, auditLogEntry } from "@/lib/mock-state";
import { couponCreateSchema } from "@/lib/validation";

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

  const status = searchParams.get("status") || undefined;
  let coupons: any[] = (state.coupons || [])
    .filter((c: any) => String(c.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    coupons = coupons.filter((c: any) => c.status === status);
  }

  coupons = coupons.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    coupons: coupons.map((c: any) => ({
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
    })),
    total: coupons.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = couponCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    code: data.code,
    asin: data.asin,
    discount_type: data.discount_type,
    discount_value: Number(data.discount_value),
    min_purchase: Number(data.min_purchase),
    max_redemptions: data.max_redemptions === null || data.max_redemptions === undefined ? null : Number(data.max_redemptions),
    redeemed_count: 0,
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.coupons || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
