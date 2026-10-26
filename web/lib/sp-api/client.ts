import { readMockState } from "@/lib/mock-state";
import type {
  InventorySummary,
  ListingsItem,
  OrderMetrics,
  SpApiClient,
  SyncResult,
} from "./types";

const DEFAULT_SELLER_ID = "mock-seller";

function productToListingsItem(product: any): ListingsItem {
  return {
    asin: product.asin,
    sku: product.sku,
    marketplaceId: product.marketplace_id || "ATVPDKIKX0DER",
    title: product.title || product.name || null,
    brand: null,
    productType: product.category || null,
    summaries: [
      {
        numberOfListings: 1,
        buyable: product.suppressed !== true,
        searchable: true,
        saleable: product.suppressed !== true,
      },
    ],
  };
}

function productToInventorySummary(product: any): InventorySummary {
  return {
    sku: product.sku,
    asin: product.asin,
    marketplaceId: product.marketplace_id || "ATVPDKIKX0DER",
    fulfillableQuantity: Math.floor(Number(product.stock) || 0),
    totalQuantity: Math.floor(Number(product.stock) || 0),
    inboundQuantity: 0,
  };
}

function productToOrderMetrics(product: any, startDate: string, endDate: string): OrderMetrics {
  const sku = product.sku;
  const history: number[] = ((readMockState().sales_history as Record<string, number[]>) || {})[sku] || [];
  const unitsSold = history.reduce((sum, v) => sum + v, 0);
  const price = Number(product.price) || 0;
  const sales = round2(unitsSold * price);
  return {
    sku,
    asin: product.asin,
    unitsSold,
    sales,
    orders: Math.round(unitsSold / 2),
    periodStart: startDate,
    periodEnd: endDate,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export class MockSpApiClient implements SpApiClient {
  async getListingsItems(sellerId: string, sku: string): Promise<ListingsItem | null> {
    const state = readMockState();
    const product = (state.products || []).find(
      (p: any) => p.sku === sku && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
    );
    if (!product) {
      return null;
    }
    return productToListingsItem(product);
  }

  async getInventorySummaries(sellerId: string): Promise<InventorySummary[]> {
    const state = readMockState();
    return (state.products || [])
      .filter((p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId)
      .map(productToInventorySummary);
  }

  async getOrderMetrics(sellerId: string, startDate: string, endDate: string): Promise<OrderMetrics[]> {
    const state = readMockState();
    return (state.products || [])
      .filter((p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId)
      .map((p: any) => productToOrderMetrics(p, startDate, endDate));
  }

  async getCatalogItem(sellerId: string, asin: string): Promise<ListingsItem | null> {
    const state = readMockState();
    const product = (state.products || []).find(
      (p: any) => p.asin === asin && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
    );
    if (!product) {
      return null;
    }
    return productToListingsItem(product);
  }

  isConfigured(): boolean {
    return true;
  }
}

export class LiveSpApiClient implements SpApiClient {
  private readonly configured: boolean;

  constructor() {
    // No static credentials are read from environment variables. Live SP-API access
    // requires seller-scoped OAuth refresh tokens stored server-side and is disabled
    // by default (SP_API_ENABLED=false, SP_API_DRY_RUN=true).
    this.configured = false;
  }

  async getListingsItems(_sellerId: string, _sku: string): Promise<ListingsItem | null> {
    throw new Error("Live SP-API client is not configured. Set DATA_SOURCE=mock or configure seller-scoped SP-API credentials.");
  }

  async getInventorySummaries(_sellerId: string): Promise<InventorySummary[]> {
    throw new Error("Live SP-API client is not configured. Set DATA_SOURCE=mock or configure seller-scoped SP-API credentials.");
  }

  async getOrderMetrics(_sellerId: string, _startDate: string, _endDate: string): Promise<OrderMetrics[]> {
    throw new Error("Live SP-API client is not configured. Set DATA_SOURCE=mock or configure seller-scoped SP-API credentials.");
  }

  async getCatalogItem(_sellerId: string, _asin: string): Promise<ListingsItem | null> {
    throw new Error("Live SP-API client is not configured. Set DATA_SOURCE=mock or configure seller-scoped SP-API credentials.");
  }

  isConfigured(): boolean {
    return this.configured;
  }
}

export function createSpApiClient(): SpApiClient {
  const source = (typeof process !== "undefined" && process.env.DATA_SOURCE) || "mock";
  if (source === "live") {
    return new LiveSpApiClient();
  }
  return new MockSpApiClient();
}

export function buildSyncResult(operationId: string, status: SyncResult["status"], recordsProcessed: number): SyncResult {
  const now = new Date().toISOString();
  return {
    operationId,
    status,
    recordsProcessed,
    startedAt: now,
    completedAt: status === "succeeded" || status === "failed" ? now : null,
    error: status === "failed" ? "SP-API request failed" : null,
  };
}
