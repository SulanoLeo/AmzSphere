import { NextResponse } from "next/server";
import { query, queryOne, transaction, type PoolClient } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { operation_id: string } }) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  const operation = await queryOne<{ id: string; seller_id: string; status: string }>(
    `SELECT id, seller_id, status FROM agent_operations WHERE id = $1`,
    [params.operation_id]
  );

  if (!operation) {
    return jsonError("Operation not found", 404);
  }

  const seller = await queryOne<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM sellers WHERE id = $1`,
    [operation.seller_id]
  );
  if (!seller) return jsonError("Seller not found", 404);
  assertSellerTenant(seller, workspaceUser);

  if (operation.status !== "review_required") {
    return jsonError("Operation is not awaiting review", 409);
  }

  await transaction(async (client: PoolClient) => {
    await query(
      `UPDATE agent_operations SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [operation.id],
      client
    );
    await query(
      `INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, 'pending')`,
      ["backend.app.tasks.catalog.submit_approved_listing", JSON.stringify({ args: [operation.id] })],
      client
    );
  });

  return NextResponse.json({ operation_id: operation.id, status: "approved" }, { status: 202 });
}
