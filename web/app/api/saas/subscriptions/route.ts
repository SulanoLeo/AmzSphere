import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { subscriptionCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    subscriptions: (state.subscriptions || []).map((s: any) => ({
      id: s.id,
      organization_id: s.organization_id,
      plan: s.plan,
      status: s.status,
      price_usd_cents: Number(s.price_usd_cents),
      currency: s.currency,
      interval: s.interval,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      canceled_at: s.canceled_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = subscriptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    organization_id: parsed.data.organization_id,
    plan: parsed.data.plan,
    status: parsed.data.status,
    price_usd_cents: Number(parsed.data.price_usd_cents),
    currency: parsed.data.currency,
    interval: parsed.data.interval,
    current_period_start: parsed.data.current_period_start,
    current_period_end: parsed.data.current_period_end,
    cancel_at_period_end: Boolean(parsed.data.cancel_at_period_end),
    canceled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.subscriptions || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
