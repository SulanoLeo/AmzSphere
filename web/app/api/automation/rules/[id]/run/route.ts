import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

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

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state: any = readMockState();
  const rule = (state.automation_rules || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!rule) {
    return NextResponse.json({ detail: `Automation rule not found: ${id}` }, { status: 404 });
  }
  if (!rule.enabled) {
    return NextResponse.json({ detail: `Automation rule is disabled: ${id}` }, { status: 409 });
  }
  const now = new Date().toISOString();
  const execution: any = {
    id: crypto.randomUUID(),
    rule_id: id,
    seller_id: sellerId,
    status: "completed",
    started_at: now,
    completed_at: now,
    records_processed: 1,
    result_summary: `Executed rule "${rule.name}" (type: ${rule.type}) successfully.`,
    error: null,
  };
  (state.automation_executions || []).push(execution);
  if ((state.automation_executions as any[]).length > 1000) {
    (state.automation_executions as any[]).length = 1000;
  }
  rule.last_run_at = now;
  rule.run_count = Number(rule.run_count) + 1;
  rule.success_count = Number(rule.success_count) + 1;
  rule.updated_at = now;
  writeMockState(state);
  return NextResponse.json({
    id: execution.id,
    rule_id: execution.rule_id,
    seller_id: execution.seller_id,
    status: execution.status,
    started_at: execution.started_at,
    completed_at: execution.completed_at,
    records_processed: Number(execution.records_processed),
    result_summary: execution.result_summary,
    error: execution.error,
  }, { status: 201 });
}
