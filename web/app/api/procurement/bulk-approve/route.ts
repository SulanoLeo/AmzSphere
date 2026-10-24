import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export interface BulkProcurementApprovalResponse {
  batch_token: string;
  execution_strategy: string;
  total_requested: number;
  total_approved: number;
  total_skipped: number;
  vendor_groups: number;
  message: string;
  timestamp: string;
}

export interface BulkApproveRequest {
  purchase_order_ids: string[];
  execution_strategy: "IMMEDIATE_STAGING" | "CONSOLIDATE_BY_VENDOR";
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as BulkApproveRequest;
  const ids: string[] = body.purchase_order_ids || [];
  if (!ids.length) {
    return NextResponse.json({ detail: "purchase_order_ids is required" }, { status: 422 });
  }
  const state = readMockState();
  const now = new Date().toISOString();
  const batchToken = `batch-${crypto.randomUUID()}`;
  const activity = state.activity || [];

  let approved = 0;
  let skipped = 0;
  for (const id of ids) {
    const order = (state.orders || []).find((o: any) => o.id === id);
    if (order && order.status === "pending") {
      order.status = "approved";
      order.reviewed_by = user.email;
      order.reviewed_at = now;
      approved += 1;
    } else {
      skipped += 1;
    }
  }

  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: now,
    category: "procurement",
    title: "Bulk purchase-order approval",
    detail: `${approved} approved, ${skipped} skipped (strategy: ${body.execution_strategy}) by ${user.email}.`,
  });
  if (activity.length > 120) activity.length = 120;
  writeMockState(state);

  const vendorGroups = new Set(ids.map(() => "vendor-group-1")).size;
  const response: BulkProcurementApprovalResponse = {
    batch_token: batchToken,
    execution_strategy: body.execution_strategy,
    total_requested: ids.length,
    total_approved: approved,
    total_skipped: skipped,
    vendor_groups: vendorGroups || 1,
    message: `Bulk approval staged: ${approved} approved, ${skipped} skipped.`,
    timestamp: now,
  };
  return NextResponse.json(response);
}
