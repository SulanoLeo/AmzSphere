import { readMockState } from "./mock-state";

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

function buildAlerts(state: any, filters: ListingHealthFilters = {}): ListingHealthAlertItem[] {
  const products: any[] = (state.products || []).slice();
  const listings: any[] = (state.marketplace_listings || []).slice();
  const byAsin = new Map<string, any>();
  for (const listing of listings) {
    byAsin.set(String(listing.global_product_id || listing.asin), listing);
  }

  const alerts: ListingHealthAlertItem[] = [];
  for (const product of products) {
    const asin = String(product.asin);
    const listing = byAsin.get(asin);
    const suppressed = Boolean(product.suppressed) || Boolean(listing && String(listing.status || "").toLowerCase() === "suppressed");
    if (filters.is_suppressed !== undefined && filters.is_suppressed !== null && suppressed !== filters.is_suppressed) continue;
    if (filters.marketplace_id && listing && String(listing.marketplace_id) !== String(filters.marketplace_id)) continue;
    if (!suppressed) continue;
    alerts.push({
      id: `alert-${asin}`,
      notification_id: `notif-${asin}`,
      notification_type: "listing_suppression",
      seller_id: "mock-seller",
      asin,
      sku: product.sku,
      marketplace_id: listing ? String(listing.marketplace_id) : "ATVPDKIKX0DER",
      listing_status: listing ? String(listing.status || "suppressed") : "suppressed",
      status: "pending",
      is_suppressed: true,
      error_codes: listing?.error_codes || ["SUPPRESSED_LISTING"],
      error_messages: listing?.error_messages || ["Listing is suppressed on Amazon."],
      processed_at: null,
      received_at: product.last_synced_at || new Date().toISOString(),
    });
  }
  return alerts;
}

export async function fetchListingHealthSummary(): Promise<ListingHealthSummary> {
  const state = readMockState();
  const products: any[] = (state.products || []).slice();
  const listings: any[] = (state.marketplace_listings || []).slice();
  let suppressed = 0;
  for (const product of products) {
    const listing = listings.find((l) => String(l.global_product_id || l.asin) === String(product.asin));
    if (Boolean(product.suppressed) || Boolean(listing && String(listing.status || "").toLowerCase() === "suppressed")) {
      suppressed += 1;
    }
  }
  return {
    total_pending_count: products.filter((p) => String(p.opt_status || "").toLowerCase() === "pending_approval").length,
    total_processed_count: products.filter((p) => String(p.opt_status || "").toLowerCase() === "optimized").length,
    total_failed_count: products.filter((p) => String(p.opt_status || "").toLowerCase() === "rejected").length,
    total_suppressed_count: suppressed,
    total_critical_count: products.filter((p) => Number(p.days_of_supply || 0) > 0 && Number(p.days_of_supply) < 7).length,
  };
}

export async function fetchListingAlerts(
  _page: number,
  _limit: number,
  filters: ListingHealthFilters = {},
): Promise<ListingHealthAlertsPage> {
  const state = readMockState();
  const items = buildAlerts(state, filters);
  return { items, total: items.length };
}
