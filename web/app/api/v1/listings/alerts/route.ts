import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPlatformKey, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const isSuppressed = searchParams.get("is_suppressed");
  const marketplaceId = searchParams.get("marketplace_id");

  let sql = `
    SELECT id, notification_id, notification_type, seller_id, asin, sku, marketplace_id,
           listing_status, status, error_codes, error_messages, is_suppressed,
           raw_payload, received_at, processed_at
    FROM listing_health_events
    WHERE status = 'processed'
  `;
  const params: unknown[] = [];

  if (isSuppressed !== null) {
    params.push(isSuppressed === "true");
    sql += ` AND is_suppressed = $${params.length}`;
  }

  if (marketplaceId) {
    params.push(marketplaceId);
    sql += ` AND marketplace_id = $${params.length}`;
  }

  sql += ` ORDER BY processed_at DESC NULLS LAST`;
  params.push((page - 1) * limit, limit);
  sql += ` OFFSET $${params.length - 1} LIMIT $${params.length}`;

  const rows = await query<any>(sql, params);

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      notification_id: row.notification_id,
      notification_type: row.notification_type,
      seller_id: row.seller_id,
      asin: row.asin,
      sku: row.sku,
      marketplace_id: row.marketplace_id,
      listing_status: row.listing_status,
      status: row.status,
      error_codes: row.error_codes || [],
      error_messages: row.error_messages || [],
      is_suppressed: row.is_suppressed,
      processed_at: row.processed_at?.toISOString() || null,
      received_at: row.received_at?.toISOString() || null,
    }))
  );
}
