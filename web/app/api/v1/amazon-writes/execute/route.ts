import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyAdminSecret, jsonError } from "@/lib/auth-api";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTING_TARGET_CATALOG_WRITES = "amzsphere.catalog_writes";
const LISTINGS_API_PATH = "/listings/{api_version}/items/{seller_id}/{sku}";

export async function POST(request: Request) {
  try {
    verifyAdminSecret(request.headers.get("x-admin-secret"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const config = getConfig();
  const result = await drainOutbox(config.AMAZON_WRITE_OUTBOX_BATCH_LIMIT, config);

  return NextResponse.json({
    processed: result.processed,
    published: result.published,
    rescheduled: result.rescheduled,
    batch_limit: config.AMAZON_WRITE_OUTBOX_BATCH_LIMIT,
    broker_url: config.DATABASE_URL,
    message: `Processed ${result.processed} outbox row(s), published ${result.published}, rescheduled ${result.rescheduled}.`,
  }, { status: 202 });
}

async function drainOutbox(limit: number, config: any) {
  let processed = 0;
  let published = 0;
  let rescheduled = 0;

  const rows = await query<{
    id: string;
    event_id: string;
    action_type: string;
    payload: any;
    routing_target: string;
    attempt_count: number;
  }>(
    `SELECT id, event_id, action_type, payload, routing_target, attempt_count
     FROM amazon_write_outbox
     WHERE status = 'pending'
       AND routing_target = $1
       AND available_at <= NOW()
     ORDER BY available_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT $2`,
    [ROUTING_TARGET_CATALOG_WRITES, limit]
  );

  for (const outbox of rows) {
    const event = await queryOne<{ id: string; seller_id: string; sku: string; raw_payload: any }>(
      `SELECT id, seller_id, sku, raw_payload FROM listing_health_events WHERE id = $1`,
      [outbox.event_id]
    );

    if (!event) {
      await query(
        `UPDATE amazon_write_outbox SET status = 'published', published_at = NOW(), last_error = 'referenced_event_missing' WHERE id = $1`,
        [outbox.id]
      );
      processed++;
      continue;
    }

    const seller = await queryOne<{ id: string; merchant_id: string }>(
      `SELECT id, merchant_id FROM sellers WHERE id = $1`,
      [event.seller_id]
    );

    if (!seller) {
      await query(
        `UPDATE amazon_write_outbox SET status = 'published', published_at = NOW(), last_error = 'referenced_seller_missing' WHERE id = $1`,
        [outbox.id]
      );
      processed++;
      continue;
    }

    if (outbox.attempt_count >= config.AMAZON_WRITE_OUTBOX_MAX_ATTEMPTS) {
      await query(
        `UPDATE amazon_write_outbox SET status = 'dead_letter', last_error = 'max_attempts_exceeded' WHERE id = $1`,
        [outbox.id]
      );
      processed++;
      continue;
    }

    await executeSingleOutboxRow(outbox, event, seller, config);
    processed++;

    const updated = await queryOne<{ status: string }>(
      `SELECT status FROM amazon_write_outbox WHERE id = $1`,
      [outbox.id]
    );
    if (updated?.status === "published") {
      published++;
    } else if (updated?.status === "pending") {
      rescheduled++;
    }
  }

  return { processed, published, rescheduled };
}

async function executeSingleOutboxRow(outbox: any, event: any, seller: any, config: any) {
  const url = `${config.SP_API_ENDPOINT || "https://sellingpartnerapi-na.amazon.com"}` +
    LISTINGS_API_PATH.replace("{api_version}", config.SP_API_LISTINGS_API_VERSION || "2021-08-01")
      .replace("{seller_id}", seller.merchant_id)
      .replace("{sku}", event.sku);

  const body = buildListingsPatchPayload(outbox.action_type, outbox.payload, event);
  const headers = buildAuthHeaders(config);

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      markOutboxPendingRetry(outbox.id, `HTTP 429: ${response.status}`);
      return;
    }

    if (response.status >= 400) {
      const text = await response.text();
      markOutboxPendingRetry(outbox.id, `HTTP ${response.status}: ${text.slice(0, 200)}`);
      return;
    }

    await query(
      `UPDATE amazon_write_outbox SET status = 'published', published_at = NOW(), last_error = NULL WHERE id = $1`,
      [outbox.id]
    );
  } catch (error) {
    markOutboxPendingRetry(outbox.id, error instanceof Error ? error.message : String(error));
  }
}

function buildListingsPatchPayload(actionType: string, payload: any, event: any) {
  const productType = (event.raw_payload || {}).productType || "UNKNOWN";
  const attributes: Record<string, any> = {};

  if (actionType === "UPDATE_PRICE") {
    const standardPrice = payload.standard_price;
    if (standardPrice === null || standardPrice === undefined) {
      throw new Error("UPDATE_PRICE requires a standard_price in the payload");
    }
    attributes["standard_price"] = [{ currency: "USD", value: String(standardPrice) }];
  } else if (actionType === "PATCH_CATALOG") {
    Object.assign(attributes, payload.attributes || {});
    if (payload.bullet_points) {
      attributes["bullet_points"] = payload.bullet_points.map((point: string) => ({ value: point, language_tag: "en-US" }));
    }
    if (payload.product_title) {
      attributes["product_title"] = [{ value: payload.product_title, language_tag: "en-US" }];
    }
  } else {
    throw new Error(`Unsupported action_type: ${actionType}`);
  }

  return { productType, attributes };
}

function buildAuthHeaders(config: any) {
  const token = config.SP_API_ACCESS_TOKEN || "PLACEHOLDER_SP_API_ACCESS_TOKEN";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-amz-access-token": token,
    "x-amz-date": new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"),
    "x-amz-target": "com.amazonaws.spapi.ListingsItems.PutListingsItem",
  };
  if (config.AWS_ACCESS_KEY_ID) {
    headers["x-amz-aws-access-key-id"] = config.AWS_ACCESS_KEY_ID;
  }
  return headers;
}

function markOutboxPendingRetry(outboxId: string, errorMessage: string) {
  const baseBackoff = 60;
  const maxBackoff = 3600;
  const backoff = Math.min(baseBackoff * 2, maxBackoff);
  const availableAt = new Date(Date.now() + backoff * 1000).toISOString();

  query(
    `UPDATE amazon_write_outbox SET attempt_count = attempt_count + 1, last_error = $1, available_at = $2 WHERE id = $3`,
    [errorMessage.slice(0, 160), availableAt, outboxId]
  );
}
