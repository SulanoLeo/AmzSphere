import { NextResponse } from "next/server";
import { query, queryOne, transaction, type PoolClient } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

interface ListingRemediationApproval {
  event_id: string;
  action_type: "UPDATE_PRICE" | "PATCH_CATALOG";
  payload: Record<string, any>;
}

export async function POST(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  let body: ListingRemediationApproval;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.event_id || !body.action_type) {
    return jsonError("event_id and action_type are required", 422);
  }

  return await transaction(async (client: PoolClient) => {
    const event = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM listing_health_events WHERE id = $1`,
      [body.event_id],
      client
    );

    if (!event) {
      return jsonError("Listing health event not found", 404);
    }

    if (event.status !== "pending_review") {
      return jsonError(`Event is not in pending_review status (current: ${event.status})`, 400);
    }

    await query(
      `UPDATE listing_health_events SET status = 'approved', processed_at = NOW() WHERE id = $1`,
      [body.event_id],
      client
    );

    const outboxResult = await queryOne<{ id: string }>(
      `INSERT INTO amazon_write_outbox (event_id, action_type, payload, routing_target, status)
       VALUES ($1, $2, $3, 'amzsphere.catalog_writes', 'pending')
       RETURNING id`,
      [body.event_id, body.action_type, JSON.stringify(body.payload || {})],
      client
    );

    if (!outboxResult) {
      return jsonError("Failed to create outbox entry", 500);
    }

    return NextResponse.json(
      {
        outbox_entry_id: outboxResult.id,
        timestamp: new Date().toISOString(),
        message: "Remediation action successfully queued for execution.",
      },
      { status: 202 }
    );
  });
}
