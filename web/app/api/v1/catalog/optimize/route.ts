import { NextResponse } from "next/server";
import { query, queryOne, transaction, type PoolClient } from "@/lib/db";
import {
  verifyPlatformKey,
  requireWorkspaceUser,
  assertSellerTenant,
  requireSpApiEnabled,
  jsonError,
} from "@/lib/auth-api";

export const dynamic = "force-dynamic";

interface CatalogOptimizeRequest {
  seller_id: string;
  asin: string;
  sku?: string;
  optimization_mode?: "free" | "paid";
  helium10_api_key?: string;
}

export async function POST(request: Request) {
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

  let body: CatalogOptimizeRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body.seller_id || !body.asin) {
    return jsonError("seller_id and asin are required", 422);
  }

  return await transaction(async (client: PoolClient) => {
    const seller = await queryOne<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM sellers WHERE id = $1`,
      [body.seller_id],
      client
    );
    if (!seller) return jsonError("Seller not found", 404);
    assertSellerTenant(seller, workspaceUser);

    const matches = await query<{ id: string; asin: string; sku: string }>(
      `SELECT id, asin, sku FROM catalog_items WHERE seller_id = $1 AND asin = $2${body.sku ? " AND sku = $3" : ""}`,
      body.sku ? [body.seller_id, body.asin, body.sku] : [body.seller_id, body.asin],
      client
    );

    if (matches.length === 0) {
      return jsonError("Seller catalog item not found", 404);
    }
    if (matches.length > 1) {
      return jsonError("ASIN maps to multiple seller SKUs; provide sku", 409);
    }

    const item = matches[0];
    const prior = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM agent_operations WHERE seller_id = $1 AND idempotency_key = $2`,
      [seller.id, idempotencyKey],
      client
    );

    if (prior) {
      return NextResponse.json({ operation_id: prior.id, status: prior.status }, { status: 202 });
    }

    const operationResult = await queryOne<{ id: string }>(
      `INSERT INTO agent_operations (seller_id, operation_type, status, asin, request_payload, idempotency_key)
       VALUES ($1, 'catalog_optimize', 'queued', $2, $3, $4)
       RETURNING id`,
      [
        seller.id,
        item.asin,
        JSON.stringify({
          asin: item.asin,
          sku: item.sku,
          marketplace_id: seller.tenant_id,
          optimization_mode: body.optimization_mode || "free",
          helium10_api_key: body.helium10_api_key || null,
        }),
        idempotencyKey,
      ],
      client
    );

    if (!operationResult) {
      return jsonError("Failed to create operation", 500);
    }

    await query(
      `INSERT INTO outbox_events (event_type, payload, status)
       VALUES ($1, $2, 'pending')`,
      ["backend.app.tasks.catalog.optimize_listing", JSON.stringify({ args: [operationResult.id] })],
      client
    );

    return NextResponse.json({ operation_id: operationResult.id, status: "queued" }, { status: 202 });
  });
}
