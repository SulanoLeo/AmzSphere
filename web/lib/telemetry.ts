import { readMockState } from "./mock-state";

export interface QueueStatusCounts {
  pending: number;
  processed: number;
  published: number;
  failed: number;
  dead_letter: number;
}

export interface QueueErrorEntry {
  error: string;
  count: number;
}

export interface QueueTelemetry {
  listing_health: QueueStatusCounts;
  amazon_write_outbox: QueueStatusCounts;
  average_execution_latency_seconds: number | null;
  top_errors: QueueErrorEntry[];
  total_outbox_rows: number;
  generated_at: string;
}

export interface OutboxBackoffItem {
  id: string;
  event_id: string;
  sku: string;
  action_type: string;
  attempt_count: number;
  available_at: string | null;
  last_error: string | null;
  status: string;
}

function statusCounts(items: any[]): QueueStatusCounts {
  const counts: QueueStatusCounts = { pending: 0, processed: 0, published: 0, failed: 0, dead_letter: 0 };
  for (const item of items) {
    const status = String(item.status || "pending").toLowerCase();
    if (status === "pending") counts.pending += 1;
    else if (status === "processed") counts.processed += 1;
    else if (status === "published" || status === "succeeded" || status === "approved") counts.published += 1;
    else if (status === "failed" || status === "rejected" || status === "denied") counts.failed += 1;
    else if (status === "dead_letter" || status === "dead-letter") counts.dead_letter += 1;
    else counts.pending += 1;
  }
  return counts;
}

export async function fetchQueueTelemetry(): Promise<QueueTelemetry> {
  const state = readMockState();
  const queue: any[] = (state.execution_queue || []).slice();
  const activity: any[] = (state.activity || []).slice();

  const now = new Date();
  const errors: Record<string, number> = {};
  for (const item of activity) {
    const detail = String(item.detail || "");
    if (/fail|error|rejected|denied|suppress/i.test(detail)) {
      const key = detail.slice(0, 60);
      errors[key] = (errors[key] || 0) + 1;
    }
  }
  const topErrors = Object.entries(errors)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const listingHealth = statusCounts(queue.filter((q) => String(q.action).includes("listing")));
  const outbox = statusCounts(queue.filter((q) => String(q.action).includes("amazon") || String(q.action).includes("write")));

  const backoffItems: OutboxBackoffItem[] = queue
    .filter((q) => String(q.status || "pending").toLowerCase() === "pending")
    .slice(0, 20)
    .map((q) => ({
      id: q.id,
      event_id: q.id,
      sku: String(q.payload?.asin || q.payload?.sku || "—"),
      action_type: q.action,
      attempt_count: Number(q.attempt_count) || 1,
      available_at: q.created_at || null,
      last_error: q.last_error || null,
      status: q.status,
    }));

  return {
    listing_health: listingHealth,
    amazon_write_outbox: outbox,
    average_execution_latency_seconds: null,
    top_errors: topErrors,
    total_outbox_rows: queue.length,
    generated_at: now.toISOString(),
  };
}

export async function forceRetryOutboxItem(_outboxId: string): Promise<void> {
  return;
}

export async function deadLetterOutboxItem(_outboxId: string): Promise<void> {
  return;
}
