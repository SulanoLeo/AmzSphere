import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

interface PurchaseOrderDecision {
  action: "approve" | "deny";
  reviewer_id: string;
}

export async function POST(request: Request, { params }: { params: { purchase_order_id: string } }) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  const purchaseOrder = await queryOne<{ id: string; seller_id: string; status: string }>(
    `SELECT id, seller_id, status FROM purchase_orders WHERE id = $1`,
    [params.purchase_order_id]
  );

  if (!purchaseOrder) {
    return jsonError("Purchase order not found", 404);
  }

  const seller = await queryOne<{ tenant_id: string }>(
    `SELECT tenant_id FROM sellers WHERE id = $1`,
    [purchaseOrder.seller_id]
  );
  assertSellerTenant(seller, workspaceUser);

  if (purchaseOrder.status !== "pending_review") {
    return jsonError("Purchase order is no longer pending review", 409);
  }

  let body: PurchaseOrderDecision;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.action || !["approve", "deny"].includes(body.action)) {
    return jsonError("action must be 'approve' or 'deny'", 422);
  }
  if (!body.reviewer_id || body.reviewer_id.length > 128) {
    return jsonError("reviewer_id is required (max 128 chars)", 422);
  }

  const newStatus = body.action === "approve" ? "approved" : "denied";

  await query(
    `UPDATE purchase_orders SET status = $1, reviewed_at = NOW(), reviewed_by = $2, updated_at = NOW() WHERE id = $3`,
    [newStatus, body.reviewer_id, params.purchase_order_id]
  );

  return NextResponse.json({ purchase_order_id: params.purchase_order_id, status: newStatus });
}
