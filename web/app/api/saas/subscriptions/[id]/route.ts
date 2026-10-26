import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { subscriptionUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const s = (state.subscriptions || []).find((x: any) => x.id === id);
  if (!s) {
    return NextResponse.json({ detail: `Subscription not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
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
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = subscriptionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const s = (state.subscriptions || []).find((x: any) => x.id === id);
  if (!s) {
    return NextResponse.json({ detail: `Subscription not found: ${id}` }, { status: 404 });
  }
  Object.assign(s, parsed.data);
  s.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
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
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const s = (state.subscriptions || []).find((x: any) => x.id === id);
  if (!s) {
    return NextResponse.json({ detail: `Subscription not found: ${id}` }, { status: 404 });
  }
  s.status = "canceled";
  s.canceled_at = new Date().toISOString();
  s.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({ detail: `Subscription canceled: ${id}` });
}
