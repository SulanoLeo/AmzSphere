import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { supplierCreateSchema } from "@/lib/validation";

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
  const search = (searchParams.get("search") || "").toLowerCase();
  const isActive = searchParams.get("is_active");

  let suppliers: any[] = (state.suppliers || [])
    .filter((s: any) => String(s.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (search) {
    suppliers = suppliers.filter((s: any) => String(s.name || "").toLowerCase().includes(search));
  }
  if (isActive !== null) {
    const active = isActive === "true";
    suppliers = suppliers.filter((s: any) => Boolean(s.is_active) === active);
  }

  suppliers = suppliers.sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));

  return NextResponse.json({
    suppliers: suppliers.map((s: any) => ({
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
    })),
    total: suppliers.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = supplierCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    name: data.name,
    contact_name: data.contact_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    address: data.address ?? null,
    lead_time_days: Number(data.lead_time_days),
    min_order_qty: Number(data.min_order_qty),
    currency: data.currency,
    is_active: Boolean(data.is_active),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.suppliers || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
