import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { automationRulePatchSchema } from "@/lib/validation";

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

export async function GET(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state: any = readMockState();
  const r = (state.automation_rules || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!r) {
    return NextResponse.json({ detail: `Automation rule not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: r.id,
    seller_id: r.seller_id,
    name: r.name,
    description: r.description,
    type: r.type,
    enabled: Boolean(r.enabled),
    conditions: r.conditions,
    actions: r.actions,
    schedule_cron: r.schedule_cron,
    last_run_at: r.last_run_at,
    next_run_at: r.next_run_at,
    run_count: Number(r.run_count),
    success_count: Number(r.success_count),
    failure_count: Number(r.failure_count),
    created_at: r.created_at,
    updated_at: r.updated_at,
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = automationRulePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const r = (state.automation_rules || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!r) {
    return NextResponse.json({ detail: `Automation rule not found: ${id}` }, { status: 404 });
  }
  Object.assign(r, parsed.data);
  r.seller_id = sellerId;
  r.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
    id: r.id,
    seller_id: r.seller_id,
    name: r.name,
    description: r.description,
    type: r.type,
    enabled: Boolean(r.enabled),
    conditions: r.conditions,
    actions: r.actions,
    schedule_cron: r.schedule_cron,
    last_run_at: r.last_run_at,
    next_run_at: r.next_run_at,
    run_count: Number(r.run_count),
    success_count: Number(r.success_count),
    failure_count: Number(r.failure_count),
    created_at: r.created_at,
    updated_at: r.updated_at,
  });
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state: any = readMockState();
  const idx = (state.automation_rules || []).findIndex(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (idx === -1) {
    return NextResponse.json({ detail: `Automation rule not found: ${id}` }, { status: 404 });
  }
  (state.automation_rules as any[]).splice(idx, 1);
  writeMockState(state);
  return NextResponse.json({ detail: `Automation rule deleted: ${id}` });
}
