import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState, auditLogEntry } from "@/lib/mock-state";
import { promotionCreateSchema } from "@/lib/validation";

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
  let promotions: any[] = (state.promotions || [])
    .filter((p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    promotions = promotions.filter((p: any) => p.status === status);
  }

  promotions = promotions.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    promotions: promotions.map((p: any) => ({
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
    })),
    total: promotions.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = promotionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    name: data.name,
    type: data.type,
    discount_value: Number(data.discount_value),
    min_purchase: Number(data.min_purchase),
    max_discount: data.max_discount === null || data.max_discount === undefined ? null : Number(data.max_discount),
    start_date: data.start_date,
    end_date: data.end_date,
    status: data.status,
    redemption_count: Number(data.redemption_count),
    asin_list: data.asin_list || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.promotions || []).push(record);
  auditLogEntry(state, sellerId, "promotion_create", "promotion", record.id, {}, record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
