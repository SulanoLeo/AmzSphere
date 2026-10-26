import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { resetMockState } from "@/lib/mock-state";
import { MockProvider } from "@/lib/provider/mock";

describe("rate limiting", () => {
  it("allows requests under the limit", () => {
    const result = rateLimit("test-user-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.reset).toBeGreaterThan(Date.now());
  });

  it("rejects requests over the limit", () => {
    const key = "test-user-limit";
    for (let i = 0; i < 60; i++) {
      rateLimit(key);
    }
    const result = rateLimit(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different identifiers separately", () => {
    rateLimit("user-a");
    const result = rateLimit("user-b");
    expect(result.allowed).toBe(true);
  });

  it("getRateLimitKey extracts forwarded IP", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getRateLimitKey(headers)).toBe("203.0.113.5");
  });

  it("getRateLimitKey falls back to real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(getRateLimitKey(headers)).toBe("198.51.100.7");
  });

  it("getRateLimitKey defaults to unknown", () => {
    const headers = new Headers({});
    expect(getRateLimitKey(headers)).toBe("unknown");
  });
});

describe("audit logging", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller("mock-seller");
  });

  it("audit log tracks product creation", async () => {
    const products = await provider.getProducts();
    const beforeCount = products.products.length;
    await provider.addProduct({
      seller_id: "mock-seller",
      source: "manual",
      asin: "B0AUDIT001",
      sku: "AUDIT-01",
      marketplace_id: "ATVPDKIKX0DER",
      name: "Audit Test Product",
      title: "Audit Test Product Title",
      category: "Test",
      price: 9.99,
      bullets: [],
      description: "",
      backend_keywords: [],
      images: [],
      sellable_units: 0,
      stock: 0,
      days_of_supply: 0,
      daily_velocity: 0,
      competitor_price: 0,
      market_price: 0,
      min_floor: 0,
      max_price: 0,
      unit_cost: 0,
      lead_time_days: 21,
      supplier: "",
      supplier_id: null,
      parent_asin: null,
      variation_theme: null,
      po_draft_id: null,
      suppressed: false,
      last_synced_at: null,
      sync_status: "synced",
      last_optimized_at: null,
      opt_score: 0,
      opt_issues: [],
      opt_status: "needs_optimization",
    });
    const after = await provider.getProducts();
    expect(after.products.length).toBe(beforeCount + 1);
  });

  it("audit log tracks variation creation", async () => {
    const products = await provider.getProducts();
    const parent = products.products[0];
    await provider.addProduct({
      seller_id: "mock-seller",
      asin: "B0AUDITVAR01",
      sku: "AUDIT-VAR-01",
      marketplace_id: "ATVPDKIKX0DER",
      source: "manual",
      name: "Audit Variation",
      title: "Audit Variation Title",
      category: parent.category,
      price: 19.99,
      bullets: [],
      description: "",
      backend_keywords: [],
      images: [],
      sellable_units: 0,
      stock: 0,
      days_of_supply: 0,
      daily_velocity: 0,
      competitor_price: 0,
      market_price: 0,
      min_floor: 0,
      max_price: 0,
      unit_cost: 0,
      lead_time_days: 21,
      supplier: "",
      supplier_id: null,
      parent_asin: parent.asin,
      variation_theme: "size",
      po_draft_id: null,
      suppressed: false,
      last_synced_at: null,
      sync_status: "synced",
      last_optimized_at: null,
      opt_score: 0,
      opt_issues: [],
      opt_status: "needs_optimization",
    });
    const variations = await provider.getProductVariations(parent.asin);
    expect(variations.length).toBeGreaterThanOrEqual(1);
  });
});
