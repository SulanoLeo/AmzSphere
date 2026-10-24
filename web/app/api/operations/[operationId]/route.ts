import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

type Context = { params: Promise<{ operationId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { operationId } = await params;
  const state = readMockState();
  const queue: any[] = (state.execution_queue || []) as any[];
  const operation = queue.find((q: any) => q.id === operationId);
  if (!operation) {
    return NextResponse.json({ detail: `Operation not found: ${operationId}` }, { status: 404 });
  }
  return NextResponse.json({
    id: operation.id,
    status: operation.status,
    action: operation.action,
    payload: operation.payload || {},
    created_at: operation.created_at,
    completed_at: operation.completed_at || null,
    result_payload: operation.result_payload || null,
  });
}
