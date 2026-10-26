import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    invoices: (state.invoices || []).map((i: any) => ({
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
    })),
  });
}
