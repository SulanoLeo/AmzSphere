import { describe, it, expect, beforeEach } from "vitest";
import { MockSpApiClient, LiveSpApiClient, createSpApiClient } from "@/lib/sp-api/client";
import { resetMockState } from "@/lib/mock-state";
import type { ListingsItem } from "@/lib/sp-api/types";

const SELLER_ID = "mock-seller";

describe("MockSpApiClient", () => {
  let client: MockSpApiClient;

  beforeEach(() => {
    resetMockState();
    client = new MockSpApiClient();
  });

  it("isConfigured returns true", () => {
    expect(client.isConfigured()).toBe(true);
  });

  it("getCatalogItem returns null for unknown ASIN", async () => {
    const result = await client.getCatalogItem(SELLER_ID, "B0UNKNOWN1");
    expect(result).toBeNull();
  });

  it("getCatalogItem returns the matching product for a known ASIN", async () => {
    const products = await client.getInventorySummaries(SELLER_ID);
    expect(products.length).toBeGreaterThan(0);
    const firstSku = products[0].sku;

    const item = await client.getCatalogItem(SELLER_ID, products[0].asin);
    expect(item).not.toBeNull();
    if (item) {
      expect(item.asin).toBe(products[0].asin);
      expect(item.sku).toBe(firstSku);
    }
  });

  it("getCatalogItem returns null for a different seller", async () => {
    const products = await client.getInventorySummaries(SELLER_ID);
    const item = await client.getCatalogItem("other-seller", products[0].asin);
    expect(item).toBeNull();
  });

  it("getInventorySummaries returns only the active seller's products", async () => {
    const summaries = await client.getInventorySummaries(SELLER_ID);
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      expect(s.marketplaceId).toBeDefined();
      expect(s.totalQuantity).toBeGreaterThanOrEqual(0);
      expect(s.fulfillableQuantity).toBeGreaterThanOrEqual(0);
    }
  });

  it("getOrderMetrics returns metrics with expected fields", async () => {
    const metrics = await client.getOrderMetrics(SELLER_ID, "2026-01-01", "2026-01-31");
    expect(metrics.length).toBeGreaterThan(0);
    for (const m of metrics) {
      expect(m.sku).toBeDefined();
      expect(m.asin).toBeDefined();
      expect(m.unitsSold).toBeGreaterThanOrEqual(0);
      expect(m.sales).toBeGreaterThanOrEqual(0);
      expect(m.periodStart).toBe("2026-01-01");
      expect(m.periodEnd).toBe("2026-01-31");
    }
  });

  it("getListingsItems returns null for unknown SKU", async () => {
    const result = await client.getListingsItems(SELLER_ID, "UNKNOWN-SKU");
    expect(result).toBeNull();
  });
});

describe("LiveSpApiClient", () => {
  let client: LiveSpApiClient;

  beforeEach(() => {
    client = new LiveSpApiClient();
  });

  it("isConfigured returns false", () => {
    expect(client.isConfigured()).toBe(false);
  });

  it("getCatalogItem throws", async () => {
    await expect(client.getCatalogItem(SELLER_ID, "B0TEST0001")).rejects.toThrow(/not configured/);
  });

  it("getInventorySummaries throws", async () => {
    await expect(client.getInventorySummaries(SELLER_ID)).rejects.toThrow(/not configured/);
  });

  it("getOrderMetrics throws", async () => {
    await expect(client.getOrderMetrics(SELLER_ID, "2026-01-01", "2026-01-31")).rejects.toThrow(/not configured/);
  });

  it("getListingsItems throws", async () => {
    await expect(client.getListingsItems(SELLER_ID, "SKU-1")).rejects.toThrow(/not configured/);
  });
});

describe("createSpApiClient", () => {
  it("returns MockSpApiClient by default", () => {
    const client = createSpApiClient();
    expect(client.isConfigured()).toBe(true);
  });

  it("returns LiveSpApiClient for DATA_SOURCE=live", () => {
    const original = process.env.DATA_SOURCE;
    process.env.DATA_SOURCE = "live";
    const client = createSpApiClient();
    expect(client.isConfigured()).toBe(false);
    process.env.DATA_SOURCE = original;
  });
});

describe("ListingsItem type", () => {
  it("has required fields", () => {
    const item: ListingsItem = {
      asin: "B0TEST0001",
      sku: "TEST-01",
      marketplaceId: "ATVPDKIKX0DER",
      title: "Test Product",
      brand: null,
      productType: null,
      summaries: [
        { numberOfListings: 1, buyable: true, searchable: true, saleable: true },
      ],
    };
    expect(item.asin).toBe("B0TEST0001");
    expect(item.summaries[0].buyable).toBe(true);
  });
});
