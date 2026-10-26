import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { invoiceUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const i = (state.invoices || []).find((x: any) => x.id === id);
  if (!i) {
    return NextResponse.json({ detail: `Invoice not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: i.id,
    organization_id: i.organization_id,
    subscription_id: i.subscription_id,
    invoice_number: i.invoice_number,
    status: i.status,
    amount_usd_cents: Number(i.amount_usd_cents),
    currency: i.currency,
    due_at: i.due_at,
    paid_at: i.paid_at,
    created_at: i.created_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = invoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const i = (state.invoices || []).find((x: any) => x.id === id);
  if (!i) {
    return NextResponse.json({ detail: `Invoice not found: ${id}` }, { status: 404 });
  }
  Object.assign(i, parsed.data);
  writeMockState(state);
  return NextResponse.json({
    id: i.id,
    organization_id: i.organization_id,
    subscription_id: i.subscription_id,
    invoice_number: i.invoice_number,
    status: i.status,
    amount_usd_cents: Number(i.amount_usd_cents),
    currency: i.currency,
    due_at: i.due_at,
    paid_at: i.paid_at,
    created_at: i.created_at,
  });
}
