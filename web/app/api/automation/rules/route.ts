import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { automationRuleCreateSchema } from "@/lib/validation";

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
  const state: any = readMockState();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") || undefined;
  const enabled = searchParams.get("enabled");

  let rules: any[] = (state.automation_rules || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (type) {
    rules = rules.filter((r: any) => r.type === type);
  }
  if (enabled !== null) {
    const en = enabled === "true";
    rules = rules.filter((r: any) => Boolean(r.enabled) === en);
  }

  rules = rules.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    automation_rules: rules.map((r: any) => ({
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
    })),
    total: rules.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = automationRuleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state: any = readMockState();
  const now = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    name: data.name,
    description: data.description === null || data.description === undefined ? null : data.description,
    type: data.type,
    enabled: Boolean(data.enabled),
    conditions: data.conditions || {},
    actions: data.actions || {},
    schedule_cron: data.schedule_cron === null || data.schedule_cron === undefined ? null : data.schedule_cron,
    last_run_at: null,
    next_run_at: null,
    run_count: 0,
    success_count: 0,
    failure_count: 0,
    created_at: now,
    updated_at: now,
  };
  (state.automation_rules || []).push(record);
  if ((state.automation_rules as any[]).length > 500) {
    (state.automation_rules as any[]).length = 500;
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
