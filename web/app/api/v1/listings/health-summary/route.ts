import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(id)::text AS count FROM listing_health_events GROUP BY status`
  );
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status || "unknown"] = parseInt(row.count, 10);
  }

  const suppressed = await queryOne<{ count: string }>(
    `SELECT COUNT(id)::text AS count FROM listing_health_events WHERE is_suppressed = true`
  );

  return NextResponse.json({
    total_pending_count: counts["pending_review"] || 0,
    total_processed_count: counts["processed"] || 0,
    total_failed_count: counts["failed"] || 0,
    total_suppressed_count: parseInt(suppressed?.count || "0", 10),
    total_critical_count: parseInt(suppressed?.count || "0", 10),
  });
}
