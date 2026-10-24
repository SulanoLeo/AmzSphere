import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const healthRows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(id)::text AS count FROM listing_health_events GROUP BY status`
  );
  const healthCounts: Record<string, number> = {};
  for (const row of healthRows) {
    const bucket = mapHealthStatus(row.status);
    healthCounts[bucket] = (healthCounts[bucket] || 0) + parseInt(row.count, 10);
  }

  const outboxRows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(id)::text AS count FROM amazon_write_outbox GROUP BY status`
  );
  const outboxCounts: Record<string, number> = {};
  let totalOutbox = 0;
  for (const row of outboxRows) {
    const bucket = mapOutboxStatus(row.status);
    outboxCounts[bucket] = (outboxCounts[bucket] || 0) + parseInt(row.count, 10);
    totalOutbox += parseInt(row.count, 10);
  }

  const avgLatency = await queryOne<{ avg: string | null }>(
    `SELECT AVG(EXTRACT(epoch FROM (published_at - created_at)))::text AS avg FROM amazon_write_outbox WHERE published_at IS NOT NULL AND created_at IS NOT NULL`
  );
  const averageLatency = avgLatency?.avg ? parseFloat(avgLatency.avg) : null;

  const topErrors = await query<{ last_error: string; count: string }>(
    `SELECT last_error, COUNT(id)::text AS count FROM amazon_write_outbox WHERE last_error IS NOT NULL GROUP BY last_error ORDER BY COUNT(id) DESC LIMIT 5`
  );

  return NextResponse.json({
    listing_health: {
      pending: healthCounts.pending || 0,
      processed: healthCounts.processed || 0,
      published: healthCounts.published || 0,
      failed: healthCounts.failed || 0,
      dead_letter: healthCounts.dead_letter || 0,
    },
    amazon_write_outbox: {
      pending: outboxCounts.pending || 0,
      processed: outboxCounts.processed || 0,
      published: outboxCounts.published || 0,
      failed: outboxCounts.failed || 0,
      dead_letter: outboxCounts.dead_letter || 0,
    },
    average_execution_latency_seconds: averageLatency !== null ? Math.round(averageLatency * 1000) / 1000 : null,
    top_errors: topErrors.map((e) => ({ error: e.last_error, count: parseInt(e.count, 10) })),
    total_outbox_rows: totalOutbox,
    generated_at: new Date().toISOString(),
  });
}

function mapHealthStatus(status: string | null): string {
  if (!status) return "pending";
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending_review" || normalized === "pending") return "pending";
  if (normalized === "processed" || normalized === "approved") return "processed";
  if (normalized === "failed") return "failed";
  return normalized;
}

function mapOutboxStatus(status: string | null): string {
  if (!status) return "pending";
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "processed") return "processed";
  if (normalized === "published") return "published";
  if (normalized === "failed" || normalized === "dead_letter") return normalized;
  return normalized;
}
