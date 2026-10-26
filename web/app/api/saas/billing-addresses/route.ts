import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { billingAddressCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    billing_addresses: (state.billing_addresses || []).map((b: any) => ({
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
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = billingAddressCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    organization_id: parsed.data.organization_id,
    name: parsed.data.name ?? null,
    line1: parsed.data.line1 ?? null,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city ?? null,
    state: parsed.data.state ?? null,
    postal_code: parsed.data.postal_code ?? null,
    country: parsed.data.country ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.billing_addresses || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
