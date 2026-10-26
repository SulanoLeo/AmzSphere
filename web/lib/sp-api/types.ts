export type MarketplaceId = string;

export interface SpApiCredentials {
  sellerId: string;
  refreshToken: string;
  awsRegion: string;
  roleArn?: string;
  endpoint: string;
}

export interface ListingsItem {
  asin: string;
  sku: string;
  marketplaceId: MarketplaceId;
  title?: string | null;
  brand?: string | null;
  productType?: string | null;
  summaries: Array<{
    numberOfListings: number;
    buyable: boolean;
    searchable: boolean;
    saleable: boolean;
  }>;
}

export interface InventorySummary {
  sku: string;
  asin: string;
  marketplaceId: MarketplaceId;
  fulfillableQuantity: number;
  totalQuantity: number;
  inboundQuantity: number;
}

export interface OrderMetrics {
  sku: string;
  asin: string;
  unitsSold: number;
  sales: number;
  orders: number;
  periodStart: string;
  periodEnd: string;
}

export interface SyncResult {
  operationId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "needs_review";
  recordsProcessed: number;
  startedAt: string;
  completedAt: string | null;
  error?: string | null;
}

export interface SpApiClient {
  getListingsItems(sellerId: string, sku: string): Promise<ListingsItem | null>;
  getInventorySummaries(sellerId: string): Promise<InventorySummary[]>;
  getOrderMetrics(sellerId: string, startDate: string, endDate: string): Promise<OrderMetrics[]>;
  getCatalogItem(sellerId: string, asin: string): Promise<ListingsItem | null>;
  isConfigured(): boolean;
}
