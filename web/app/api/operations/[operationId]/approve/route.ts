import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";

type Context = { params: Promise<{ operationId: string }> };

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;
  const { operationId } = await params;
  const state = readMockState();
  const queue: any[] = (state.execution_queue || []) as any[];
  const operation = queue.find((q: any) => q.id === operationId);
  if (!operation) {
    return NextResponse.json({ detail: `Operation not found: ${operationId}` }, { status: 404 });
  }
  if (operation.status !== "pending") {
    return NextResponse.json({ detail: "This operation has already been reviewed" }, { status: 409 });
  }
  const now = new Date().toISOString();
  operation.status = "approved";
  operation.completed_at = now;
  operation.result_payload = {
    approved_by: user.email,
    approved_at: now,
    action: operation.action,
  };

  const product = (state.products || []).find(
    (p: any) => p.id === operation.payload?.product_id || p.asin === operation.payload?.asin,
  ) as any;
  if (product && operation.payload?.field_changes) {
    const changes = operation.payload.field_changes as Record<string, { before: unknown; after: unknown }>;
    for (const [field, change] of Object.entries(changes)) {
      (product as any)[field] = change.after;
    }
    const optResult = computeOptScore(product);
    product.opt_score = optResult.score;
    product.opt_issues = optResult.issues;
    product.opt_status = optResult.status;
    product.last_optimized_at = now;
  }

  writeMockState(state);
  return NextResponse.json({ status: "approved", operation_id: operationId, result_payload: operation.result_payload });
}
