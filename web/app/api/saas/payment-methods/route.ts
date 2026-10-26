import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { paymentMethodCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    payment_methods: (state.payment_methods || []).map((p: any) => ({
      id: p.id,
      organization_id: p.organization_id,
      type: p.type,
      last4: p.last4,
      brand: p.brand,
      expiry_month: p.expiry_month,
      expiry_year: p.expiry_year,
      is_default: Boolean(p.is_default),
      created_at: p.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = paymentMethodCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    organization_id: parsed.data.organization_id,
    type: parsed.data.type,
    last4: parsed.data.last4 ?? null,
    brand: parsed.data.brand ?? null,
    expiry_month: parsed.data.expiry_month ?? null,
    expiry_year: parsed.data.expiry_year ?? null,
    is_default: Boolean(parsed.data.is_default),
    created_at: new Date().toISOString(),
  };
  if (record.is_default) {
    for (const p of state.payment_methods || []) {
      if (String(p.organization_id) === record.organization_id) {
        p.is_default = false;
      }
    }
  }
  (state.payment_methods || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
