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

const API_BASE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
})();

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchQueueTelemetry(): Promise<QueueTelemetry> {
  return json<QueueTelemetry>(`${API_BASE_URL}/api/v1/telemetry/queues`);
}

export async function forceRetryOutboxItem(outboxId: string): Promise<void> {
  await json<void>(`${API_BASE_URL}/api/v1/telemetry/queues/outbox/${encodeURIComponent(outboxId)}/retry`, {
    method: "POST",
  });
}

export async function deadLetterOutboxItem(outboxId: string): Promise<void> {
  await json<void>(`${API_BASE_URL}/api/v1/telemetry/queues/outbox/${encodeURIComponent(outboxId)}/dead-letter`, {
    method: "POST",
  });
}
