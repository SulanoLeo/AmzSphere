import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, requireSpApiEnabled, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { seller_id: string } }) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  try {
    requireSpApiEnabled();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "SP-API integration is disabled", 503);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return jsonError("Idempotency-Key header is required (8-128 chars)", 422);
  }

  const seller = await queryOne<{ id: string; tenant_id: string }>(
    `SELECT id, tenant_id FROM sellers WHERE id = $1`,
    [params.seller_id]
  );
  if (!seller) return jsonError("Seller not found", 404);
  assertSellerTenant(seller, workspaceUser);

  const active = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM agent_operations WHERE seller_id = $1 AND operation_type = 'seller_data_sync' AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 1`,
    [params.seller_id]
  );
  if (active) {
    return NextResponse.json({ operation_id: active.id, status: active.status });
  }

  const prior = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM agent_operations WHERE seller_id = $1 AND idempotency_key = $2`,
    [params.seller_id, idempotencyKey]
  );
  if (prior) {
    return NextResponse.json({ operation_id: prior.id, status: prior.status });
  }

  const operationResult = await queryOne<{ id: string; status: string }>(
    `INSERT INTO agent_operations (seller_id, operation_type, status, idempotency_key)
     VALUES ($1, 'seller_data_sync', 'queued', $2)
     RETURNING id, status`,
    [params.seller_id, idempotencyKey]
  );

  if (!operationResult) {
    return jsonError("Failed to create operation", 500);
  }

  await query(
    `INSERT INTO outbox_events (event_type, payload, status) VALUES ($1, $2, 'pending')`,
    ["backend.app.tasks.ingestion.sync_seller_data", JSON.stringify({ args: [params.seller_id, operationResult.id] })]
  );

  return NextResponse.json({ operation_id: operationResult.id, status: operationResult.status }, { status: 202 });
}
