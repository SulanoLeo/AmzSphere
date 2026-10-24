export interface ListingHealthSummary {
  total_pending_count: number;
  total_processed_count: number;
  total_failed_count: number;
  total_suppressed_count: number;
  total_critical_count: number;
}

export interface ListingHealthAlertItem {
  id: string;
  notification_id: string;
  notification_type: string;
  seller_id: string;
  asin: string;
  sku: string;
  marketplace_id: string;
  listing_status: string;
  status: string;
  is_suppressed: boolean;
  error_codes: string[];
  error_messages: string[];
  processed_at: string | null;
  received_at: string;
}

export interface ListingHealthAlertsPage {
  items: ListingHealthAlertItem[];
  total: number;
}

export interface ListingHealthFilters {
  is_suppressed?: boolean | null;
  marketplace_id?: string | null;
}

const API_BASE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
})();

function buildUrl(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", headers: { "Content-Type": "application/json" }, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function fetchListingHealthSummary(): Promise<ListingHealthSummary> {
  return json<ListingHealthSummary>(buildUrl("/api/v1/listings/health-summary", {}));
}

export async function fetchListingAlerts(
  page: number,
  limit: number,
  filters: ListingHealthFilters = {},
): Promise<ListingHealthAlertsPage> {
  return json<ListingHealthAlertsPage>(
    buildUrl("/api/v1/listings/alerts", {
      page,
      limit,
      is_suppressed: filters.is_suppressed ?? null,
      marketplace_id: filters.marketplace_id ?? null,
    }),
  );
}
