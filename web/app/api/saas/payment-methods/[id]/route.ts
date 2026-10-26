import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { paymentMethodUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const p = (state.payment_methods || []).find((x: any) => x.id === id);
  if (!p) {
    return NextResponse.json({ detail: `Payment method not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: p.id,
    organization_id: p.organization_id,
    type: p.type,
    last4: p.last4,
    brand: p.brand,
    expiry_month: p.expiry_month,
    expiry_year: p.expiry_year,
    is_default: Boolean(p.is_default),
    created_at: p.created_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = paymentMethodUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const p = (state.payment_methods || []).find((x: any) => x.id === id);
  if (!p) {
    return NextResponse.json({ detail: `Payment method not found: ${id}` }, { status: 404 });
  }
  if (parsed.data.is_default) {
    for (const pm of state.payment_methods || []) {
      if (String(pm.organization_id) === p.organization_id) {
        pm.is_default = false;
      }
    }
  }
  Object.assign(p, parsed.data);
  writeMockState(state);
  return NextResponse.json({
    id: p.id,
    organization_id: p.organization_id,
    type: p.type,
    last4: p.last4,
    brand: p.brand,
    expiry_month: p.expiry_month,
    expiry_year: p.expiry_year,
    is_default: Boolean(p.is_default),
    created_at: p.created_at,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const idx = (state.payment_methods || []).findIndex((x: any) => x.id === id);
  if (idx === -1) {
    return NextResponse.json({ detail: `Payment method not found: ${id}` }, { status: 404 });
  }
  (state.payment_methods as any[]).splice(idx, 1);
  writeMockState(state);
  return NextResponse.json({ detail: `Payment method deleted: ${id}` });
}
