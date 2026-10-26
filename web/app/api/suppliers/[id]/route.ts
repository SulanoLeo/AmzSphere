import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { supplierPatchSchema } from "@/lib/validation";

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
  const parsed = supplierPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state = readMockState();
  const s = (state.suppliers || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!s) {
    return NextResponse.json({ detail: `Supplier not found: ${id}` }, { status: 404 });
  }
  Object.assign(s, parsed.data);
  s.seller_id = sellerId;
  s.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: s.id,
    seller_id: s.seller_id,
    name: s.name,
    contact_name: s.contact_name,
    email: s.email,
    phone: s.phone,
    address: s.address,
    lead_time_days: Number(s.lead_time_days),
    min_order_qty: Number(s.min_order_qty),
    currency: s.currency,
    is_active: Boolean(s.is_active),
    created_at: s.created_at,
    updated_at: s.updated_at,
  });
}
