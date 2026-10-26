import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { billingAddressUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const b = (state.billing_addresses || []).find((x: any) => x.id === id);
  if (!b) {
    return NextResponse.json({ detail: `Billing address not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: b.id,
    organization_id: b.organization_id,
    name: b.name,
    line1: b.line1,
    line2: b.line2,
    city: b.city,
    state: b.state,
    postal_code: b.postal_code,
    country: b.country,
    created_at: b.created_at,
    updated_at: b.updated_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = billingAddressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const b = (state.billing_addresses || []).find((x: any) => x.id === id);
  if (!b) {
    return NextResponse.json({ detail: `Billing address not found: ${id}` }, { status: 404 });
  }
  Object.assign(b, parsed.data);
  b.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: b.id,
    organization_id: b.organization_id,
    name: b.name,
    line1: b.line1,
    line2: b.line2,
    city: b.city,
    state: b.state,
    postal_code: b.postal_code,
    country: b.country,
    created_at: b.created_at,
    updated_at: b.updated_at,
  });
}
