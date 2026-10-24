import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { seller_id: string } }) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  const seller = await queryOne<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM sellers WHERE id = $1`,
    [params.seller_id]
  );
  if (!seller) return jsonError("Seller not found", 404);
  assertSellerTenant(seller, workspaceUser);

  const operationResult = await queryOne<{ id: string }>(
    `INSERT INTO agent_operations (seller_id, operation_type, status, idempotency_key)
     VALUES ($1, 'inventory_scan', 'queued', $2)
     RETURNING id`,
    [seller.id, `inventory-scan:${require("crypto").randomUUID()}`]
  );

  if (!operationResult) {
    return jsonError("Failed to create operation", 500);
  }

  await query(
    `INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, 'pending')`,
    ["backend.app.tasks.inventory.scan_seller_inventory", JSON.stringify({ args: [params.seller_id, operationResult.id] })]
  );

  return NextResponse.json({ operation_id: operationResult.id, status: "queued" }, { status: 202 });
}
