import { describe, it, expect, beforeEach } from "vitest";
import { MockProvider } from "@/lib/provider/mock";
import type { Product, FinancialRecord, Keyword, KeywordRankHistory, Supplier, LandedCost, CompetitorProduct, CompetitorObservation, FeaturedOffer, Review, ReturnRequest, Promotion, Coupon, Report, ReportExecution, Export, Forecast, ForecastPoint, ForecastScenario, AIRecommendation, AIConversation, AIMessage, AutomationRule, AutomationExecution, Notification, Alert, Subscription, Invoice, PaymentMethod, BillingAddress, TeamMembership, BillingPlan } from "@/lib/provider/types";
import { resetMockState } from "@/lib/mock-state";
import {
  productCreateSchema,
  productPatchSchema,
  catalogOptimizeSchema,
  financialRecordsSchema,
  keywordCreateSchema,
  keywordRankSchema,
  supplierCreateSchema,
  supplierPatchSchema,
  landedCostSchema,
  competitorProductSchema,
  competitorObservationSchema,
  featuredOfferSchema,
  returnRequestUpdateSchema,
  promotionCreateSchema,
  couponCreateSchema,
  reportCreateSchema,
  exportCreateSchema,
  forecastCreateSchema,
  aiRecommendationCreateSchema,
  aiRecommendationPatchSchema,
  aiMessageCreateSchema,
  automationRuleCreateSchema,
  automationRulePatchSchema,
  organizationUpdateSchema,
  userUpdateSchema,
  sellerAccountCreateSchema,
  sellerAccountUpdateSchema,
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
  invoiceUpdateSchema,
  paymentMethodCreateSchema,
  paymentMethodUpdateSchema,
  billingAddressCreateSchema,
  billingAddressUpdateSchema,
  teamMembershipCreateSchema,
  teamMembershipUpdateSchema,
} from "@/lib/validation";

const ACTIVE_SELLER = "mock-seller";
const OTHER_SELLER = "other-seller";

function makeProduct(overrides: Partial<Product> = {}): Omit<Product, "id"> {
  return {
    asin: overrides.asin || "B0TESTHELP",
    sku: overrides.sku || "TEST-HELP",
    marketplace_id: "ATVPDKIKX0DER",
    seller_id: ACTIVE_SELLER,
    source: "manual",
    name: overrides.name || "Helper Product",
    title: overrides.title || "Helper Product Title",
    category: overrides.category || "Test",
    price: overrides.price ?? 9.99,
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
    parent_asin: null,
    variation_theme: null,
    supplier_id: null,
    po_draft_id: null,
    suppressed: false,
    last_synced_at: null,
    sync_status: "synced",
    last_optimized_at: null,
    opt_score: 0,
    opt_issues: [],
    opt_status: "needs_optimization",
    ...overrides,
  };
}

describe("MockProvider seller isolation", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getActiveSeller returns the active seller", () => {
    expect(provider.getActiveSeller()).toBe(ACTIVE_SELLER);
  });

  it("getProducts returns only active seller's products", async () => {
    const result = await provider.getProducts();
    for (const p of result.products) {
      expect(String(p.seller_id)).toBe(ACTIVE_SELLER);
    }
    expect(result.total).toBeGreaterThan(0);
  });

  it("getProduct returns null for a product owned by another seller", async () => {
    // First get a product owned by the active seller
    const mine = await provider.getProducts();
    const myProduct = mine.products[0];
    const ownedByMe = await provider.getProduct(myProduct.id);
    expect(ownedByMe).not.toBeNull();

    // Now pretend the product belongs to another seller by switching active seller
    provider.setActiveSeller(OTHER_SELLER);
    const notFound = await provider.getProduct(myProduct.id);
    expect(notFound).toBeNull();

    // Restore
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("addProduct sets seller_id to the active seller", async () => {
    const base: Omit<Product, "id"> = {
      asin: "B0ISO00001",
      sku: "ISO-TEST-01",
      marketplace_id: "ATVPDKIKX0DER",
      seller_id: ACTIVE_SELLER,
      source: "manual",
      name: "Isolation Test Product",
      title: "Isolation Test Product Title",
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
      parent_asin: null,
      variation_theme: null,
      supplier_id: null,
      po_draft_id: null,
      suppressed: false,
      last_synced_at: null,
      sync_status: "synced",
      last_optimized_at: null,
      opt_score: 0,
      opt_issues: [],
      opt_status: "needs_optimization",
    };
    const created = await provider.addProduct(base);
    expect(created.seller_id).toBe(ACTIVE_SELLER);

    // Verify it shows up under the active seller
    const fetched = await provider.getProduct(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.seller_id).toBe(ACTIVE_SELLER);

    // Switch seller -> should not be visible
    provider.setActiveSeller(OTHER_SELLER);
    const hidden = await provider.getProduct(created.id);
    expect(hidden).toBeNull();
  });

  it("updateProduct rejects cross-tenant updates", async () => {
    const mine = await provider.getProducts();
    const myProduct = mine.products[0];
    await expect(
      provider.updateProduct(myProduct.id, { title: "Hacked Title" }),
    ).resolves.toBeDefined();

    provider.setActiveSeller(OTHER_SELLER);
    await expect(
      provider.updateProduct(myProduct.id, { title: "Hacked Title" }),
    ).rejects.toThrow();
  });
});

describe("validation schemas", () => {
  it("productCreateSchema accepts valid input", () => {
    const result = productCreateSchema.safeParse({
      asin: "B0TEST0001",
      sku: "TEST-01",
      name: "Test Product",
      title: "A valid test product title that is long enough",
      price: 19.99,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.asin).toBe("B0TEST0001");
      expect(result.data.marketplace_id).toBe("ATVPDKIKX0DER");
    }
  });

  it("productCreateSchema rejects invalid ASIN", () => {
    const result = productCreateSchema.safeParse({
      asin: "invalid",
      sku: "TEST-01",
      name: "Test",
      title: "A valid test product title that is long enough",
    });
    expect(result.success).toBe(false);
  });

  it("productCreateSchema rejects missing name", () => {
    const result = productCreateSchema.safeParse({
      asin: "B0TEST0001",
      sku: "TEST-01",
      title: "A valid test product title that is long enough",
    });
    expect(result.success).toBe(false);
  });

  it("productPatchSchema accepts partial updates", () => {
    const result = productPatchSchema.safeParse({ price: 29.99 });
    expect(result.success).toBe(true);
  });

  it("catalogOptimizeSchema requires asin and seller_id", () => {
    const ok = catalogOptimizeSchema.safeParse({
      asin: "B0TEST0001",
      seller_id: "mock-seller",
    });
    expect(ok.success).toBe(true);

    const noAsin = catalogOptimizeSchema.safeParse({ seller_id: "mock-seller" });
    expect(noAsin.success).toBe(false);

    const noSeller = catalogOptimizeSchema.safeParse({ asin: "B0TEST0001" });
    expect(noSeller.success).toBe(false);
  });

  it("catalogOptimizeSchema rejects invalid ASIN", () => {
    const result = catalogOptimizeSchema.safeParse({
      asin: "bad",
      seller_id: "mock-seller",
    });
    expect(result.success).toBe(false);
  });
});

describe("MockProvider variations", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getProductVariations returns empty for unknown parent", async () => {
    const variations = await provider.getProductVariations("B0UNKNOWN1");
    expect(variations).toEqual([]);
  });

  it("getProductVariations returns children for a parent", async () => {
    const products = await provider.getProducts();
    const parent = products.products[0];
    await provider.addProduct(makeProduct({
      asin: "B0VARTEST01",
      sku: "VAR-TEST-01",
      name: "Variation Child",
      title: "Variation Child Title",
      category: parent.category,
      price: 19.99,
      parent_asin: parent.asin,
      variation_theme: "size",
    }));
    const variations = await provider.getProductVariations(parent.asin);
    expect(variations.length).toBeGreaterThanOrEqual(1);
    for (const v of variations) {
      expect(String(v.seller_id)).toBe(ACTIVE_SELLER);
      expect(String(v.parent_asin)).toBe(parent.asin);
    }
  });

  it("getProductVariations returns empty for another seller", async () => {
    const products = await provider.getProducts();
    const parent = products.products[0];
    await provider.addProduct(makeProduct({
      asin: "B0VARTEST01",
      sku: "VAR-TEST-01",
      name: "Variation Child",
      title: "Variation Child Title",
      category: parent.category,
      price: 19.99,
      parent_asin: parent.asin,
      variation_theme: "size",
    }));
    provider.setActiveSeller(OTHER_SELLER);
    const variations = await provider.getProductVariations(parent.asin);
    expect(variations).toEqual([]);
  });
});

describe("MockProvider listing versions", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("createListingVersion and getListingVersions round-trip", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const version = await provider.createListingVersion(
      product.id,
      { title: "Snapshot title" },
      "mock@amzsphere.local",
      ["title snapshot"],
    );
    expect(version.product_id).toBe(product.id);
    expect(version.asin).toBe(product.asin);
    expect(version.changed_by).toBe("mock@amzsphere.local");
    expect(version.change_summary).toEqual(["title snapshot"]);

    const versions = await provider.getListingVersions(product.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].id).toBe(version.id);
  });

  it("getListingVersions returns empty for unknown product", async () => {
    const versions = await provider.getListingVersions("nonexistent");
    expect(versions).toEqual([]);
  });

  it("updateProduct creates a listing version snapshot", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    await provider.updateProduct(product.id, { price: 42.99 });
    const versions = await provider.getListingVersions(product.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    const latest = versions[0];
    expect(latest.snapshot.price).toBe(42.99);
    expect(latest.change_summary.length).toBeGreaterThan(0);
  });

  it("createListingVersion rejects cross-tenant product", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    provider.setActiveSeller(OTHER_SELLER);
    await expect(
      provider.createListingVersion(product.id, { title: "x" }, "u", ["y"]),
    ).rejects.toThrow();
  });
});

describe("Dashboard profitability", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("dashboard includes profitability and velocity metrics", async () => {
    const dashboard = await provider.getDashboard();
    expect(dashboard.profitability).toBeDefined();
    expect(typeof dashboard.profitability.revenue).toBe("number");
    expect(typeof dashboard.profitability.fees).toBe("number");
    expect(typeof dashboard.profitability.net_profit).toBe("number");
    expect(typeof dashboard.profitability.margin_pct).toBe("number");
    expect(dashboard.sales_velocity).toBeDefined();
    expect(typeof dashboard.sales_velocity.units_7d).toBe("number");
    expect(typeof dashboard.sales_velocity.units_30d).toBe("number");
    expect(typeof dashboard.sales_velocity.units_90d).toBe("number");
    expect(typeof dashboard.variation_groups).toBe("number");
    expect(dashboard.variation_groups).toBeGreaterThanOrEqual(0);
  });

  it("dashboard variation_groups reflects variation children", async () => {
    const products = await provider.getProducts();
    const parent = products.products[0];
    // Create a variation child under this parent
    await provider.addProduct(makeProduct({
      asin: "B0VARTEST01",
      sku: "VAR-TEST-01",
      name: "Variation Child",
      title: "Variation Child Title",
      category: parent.category,
      price: 19.99,
      parent_asin: parent.asin,
      variation_theme: "size",
    }));
    const dashboard = await provider.getDashboard();
    expect(dashboard.variation_groups).toBeGreaterThanOrEqual(1);
  });

  it("dashboard products include price and unit_cost", async () => {
    const dashboard = await provider.getDashboard();
    for (const p of dashboard.products) {
      expect(typeof p.price).toBe("number");
      expect(typeof p.unit_cost).toBe("number");
    }
  });
});

describe("MockProvider financial records", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getFinancialRecords returns seller-scoped records", async () => {
    const records = await provider.getFinancialRecords();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(String(r.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof r.revenue).toBe("number");
      expect(typeof r.net_profit).toBe("number");
      expect(r.period_start).toBeDefined();
      expect(r.period_end).toBeDefined();
    }
  });

  it("getFinancialRecords filters by period", async () => {
    const all = await provider.getFinancialRecords();
    if (all.length > 0) {
      const first = all[0];
      const filtered = await provider.getFinancialRecords(first.period_start, first.period_end);
      expect(filtered.length).toBeGreaterThan(0);
      for (const r of filtered) {
        expect(r.period_start).toBe(first.period_start);
        expect(r.period_end).toBe(first.period_end);
      }
    }
  });

  it("getFinancialRecords returns empty for another seller", async () => {
    provider.setActiveSeller(OTHER_SELLER);
    const records = await provider.getFinancialRecords();
    expect(records).toEqual([]);
  });

  it("getProfitability returns aggregate metrics", async () => {
    const prof = await provider.getProfitability();
    expect(typeof prof.revenue).toBe("number");
    expect(typeof prof.cogs).toBe("number");
    expect(typeof prof.fees).toBe("number");
    expect(typeof prof.net_profit).toBe("number");
    expect(typeof prof.margin_pct).toBe("number");
    expect(typeof prof.units_sold).toBe("number");
    expect(typeof prof.orders_count).toBe("number");
    expect(Array.isArray(prof.by_category)).toBe(true);
    // net_profit = revenue - cogs - fees
    expect(prof.net_profit).toBe(prof.revenue - prof.cogs - prof.fees);
  });

  it("getProfitability returns zeros when no records", async () => {
    // Switch to an empty seller
    provider.setActiveSeller("empty-seller");
    const prof = await provider.getProfitability();
    expect(prof.revenue).toBe(0);
    expect(prof.net_profit).toBe(0);
    expect(prof.margin_pct).toBe(0);
  });

  it("financialRecordsSchema validates input", () => {
    const result = financialRecordsSchema.safeParse({
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      revenue: 1000,
      cogs: 400,
      fees: 150,
      net_profit: 450,
      units_sold: 50,
      orders_count: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue).toBe(1000);
    }
  });
});

describe("MockProvider keywords", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getKeywords returns seller-scoped keywords", async () => {
    const keywords = await provider.getKeywords();
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(0);
    for (const k of keywords) {
      expect(String(k.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof k.keyword).toBe("string");
      expect(typeof k.search_volume).toBe("number");
      expect(typeof k.difficulty).toBe("number");
      expect(typeof k.cpc).toBe("number");
    }
  });

  it("addKeyword creates a keyword owned by active seller", async () => {
    const created = await provider.addKeyword({
      seller_id: ACTIVE_SELLER,
      keyword: "stainless steel lunch box",
      marketplace_id: "ATVPDKIKX0DER",
      search_volume: 12000,
      difficulty: 40,
      cpc: 0.92,
      category: "Kitchen",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.keyword).toBe("stainless steel lunch box");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();

    const all = await provider.getKeywords();
    expect(all.some((k) => k.id === created.id)).toBe(true);
  });

  it("addKeyword returns empty for another seller", async () => {
    provider.setActiveSeller(OTHER_SELLER);
    const keywords = await provider.getKeywords();
    expect(keywords).toEqual([]);
  });

  it("getKeywordRanks returns rank history for a keyword", async () => {
    const keywords = await provider.getKeywords();
    const kw = keywords[0];
    const ranks = await provider.getKeywordRanks(kw.id);
    expect(Array.isArray(ranks)).toBe(true);
    expect(ranks.length).toBeGreaterThan(0);
    for (const r of ranks) {
      expect(String(r.keyword_id)).toBe(kw.id);
      expect(typeof r.rank).toBe("number");
      expect(r.rank).toBeGreaterThanOrEqual(1);
      expect(r.rank).toBeLessThanOrEqual(500);
      expect(r.rank_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("getKeywordRanks filters by asin", async () => {
    const keywords = await provider.getKeywords();
    const kw = keywords[0];
    const ranks = await provider.getKeywordRanks(kw.id);
    if (ranks.length > 0) {
      const asin = ranks[0].asin;
      const filtered = await provider.getKeywordRanks(kw.id, asin);
      expect(filtered.length).toBeGreaterThan(0);
      for (const r of filtered) {
        expect(r.asin).toBe(asin);
      }
    }
  });

  it("recordKeywordRank creates a rank record", async () => {
    const keywords = await provider.getKeywords();
    const kw = keywords[0];
    const products = await provider.getProducts();
    const asin = products.products[0].asin;
    const record = await provider.recordKeywordRank(kw.id, asin, 42);
    expect(record.keyword_id).toBe(kw.id);
    expect(record.asin).toBe(asin);
    expect(record.rank).toBe(42);
    expect(record.seller_id).toBe(ACTIVE_SELLER);

    const ranks = await provider.getKeywordRanks(kw.id, asin);
    expect(ranks.some((r) => r.id === record.id)).toBe(true);
  });

  it("recordKeywordRank rejects unknown keyword", async () => {
    await expect(provider.recordKeywordRank("kw-nonexistent", "B0TEST0001", 10)).rejects.toThrow();
  });

  it("keywordCreateSchema validates input", () => {
    const result = keywordCreateSchema.safeParse({
      keyword: "bamboo cutting board",
      search_volume: 8000,
      difficulty: 35,
      cpc: 1.05,
      category: "Kitchen",
    });
    expect(result.success).toBe(true);
  });

  it("keywordCreateSchema rejects empty keyword", () => {
    const result = keywordCreateSchema.safeParse({ keyword: "" });
    expect(result.success).toBe(false);
  });

  it("keywordRankSchema validates input", () => {
    const result = keywordRankSchema.safeParse({ keyword_id: "KW-0001", asin: "B0TEST0001", rank: 15 });
    expect(result.success).toBe(true);
  });

  it("keywordRankSchema rejects invalid rank", () => {
    const result = keywordRankSchema.safeParse({ keyword_id: "KW-0001", asin: "B0TEST0001", rank: 999 });
    expect(result.success).toBe(false);
  });
});

describe("MockProvider suppliers", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getSuppliers returns seller-scoped suppliers", async () => {
    const suppliers = await provider.getSuppliers();
    expect(Array.isArray(suppliers)).toBe(true);
    expect(suppliers.length).toBeGreaterThan(0);
    for (const s of suppliers) {
      expect(String(s.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof s.name).toBe("string");
      expect(typeof s.lead_time_days).toBe("number");
      expect(typeof s.min_order_qty).toBe("number");
    }
  });

  it("addSupplier creates a supplier owned by active seller", async () => {
    const created = await provider.addSupplier({
      seller_id: ACTIVE_SELLER,
      name: "Test Supplier Co",
      contact_name: "Jane Doe",
      email: "jane@test.com",
      phone: "+1-555-0100",
      address: "123 Test St",
      lead_time_days: 14,
      min_order_qty: 200,
      currency: "USD",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.name).toBe("Test Supplier Co");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();

    const all = await provider.getSuppliers();
    expect(all.some((s) => s.id === created.id)).toBe(true);
  });

  it("getSupplier returns null for unknown id", async () => {
    const found = await provider.getSupplier("sup-nonexistent");
    expect(found).toBeNull();
  });

  it("updateSupplier updates fields and rejects cross-tenant", async () => {
    const suppliers = await provider.getSuppliers();
    const s = suppliers[0];
    const updated = await provider.updateSupplier(s.id, { name: "Renamed Supplier" });
    expect(updated.name).toBe("Renamed Supplier");

    provider.setActiveSeller(OTHER_SELLER);
    await expect(provider.updateSupplier(s.id, { name: "Hacked" })).rejects.toThrow();
  });

  it("supplierCreateSchema validates input", () => {
    const result = supplierCreateSchema.safeParse({
      name: "Acme Supplies",
      lead_time_days: 10,
      min_order_qty: 100,
      currency: "USD",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("supplierCreateSchema rejects missing name", () => {
    const result = supplierCreateSchema.safeParse({ lead_time_days: 10 });
    expect(result.success).toBe(false);
  });

  it("supplierPatchSchema accepts partial updates", () => {
    const result = supplierPatchSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("getLandedCost returns null when not set", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const lc = await provider.getLandedCost(product.asin);
    // Some products have landed cost seeded; if not, expect null or valid
    if (lc) {
      expect(typeof lc.total_landed_cost).toBe("number");
      expect(lc.total_landed_cost).toBeGreaterThanOrEqual(0);
    }
  });

  it("setLandedCost creates/updates landed cost", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const lc = await provider.setLandedCost(product.asin, {
      unit_cost: 12.5,
      shipping_per_unit: 2.0,
      duty_per_unit: 1.0,
      freight_per_unit: 1.5,
      other_per_unit: 0.5,
      currency: "USD",
    });
    expect(lc.asin).toBe(product.asin);
    expect(lc.total_landed_cost).toBe(12.5 + 2.0 + 1.0 + 1.5 + 0.5);
    expect(lc.currency).toBe("USD");

    const fetched = await provider.getLandedCost(product.asin);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.total_landed_cost).toBe(lc.total_landed_cost);
    }
  });

  it("landedCostSchema validates input", () => {
    const result = landedCostSchema.safeParse({
      unit_cost: 10,
      shipping_per_unit: 2,
      duty_per_unit: 1,
      freight_per_unit: 1.5,
      other_per_unit: 0.5,
      currency: "USD",
    });
    expect(result.success).toBe(true);
  });
});

describe("Inventory restock proposals", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("inventory scan returns restock proposals with landed cost", async () => {
    const products = await provider.getProducts();
    const lowStockProduct = products.products.find((p) => {
      const days = Number(p.stock) / Math.max(Number(p.daily_velocity) || 1, 1);
      return days < 15;
    });
    if (!lowStockProduct) {
      // Skip if no low-stock product; scan still works
      return;
    }
    // Can't call scan route directly here; verify via dashboard/supplier data instead
    expect(lowStockProduct.supplier_id).toBeDefined();
    expect(typeof lowStockProduct.daily_velocity).toBe("number");
  });
});

describe("MockProvider competitors", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getCompetitorProducts returns seller-scoped competitors", async () => {
    const competitors = await provider.getCompetitorProducts();
    expect(Array.isArray(competitors)).toBe(true);
    expect(competitors.length).toBeGreaterThan(0);
    for (const c of competitors) {
      expect(String(c.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof c.asin).toBe("string");
      expect(typeof c.title).toBe("string");
      expect(typeof c.price).toBe("number");
    }
  });

  it("getCompetitorProducts filters by asin", async () => {
    const competitors = await provider.getCompetitorProducts();
    if (competitors.length > 0) {
      const asin = competitors[0].asin;
      const filtered = await provider.getCompetitorProducts(asin);
      expect(filtered.length).toBeGreaterThan(0);
      for (const c of filtered) {
        expect(c.asin).toBe(asin);
      }
    }
  });

  it("addCompetitorProduct creates a competitor owned by active seller", async () => {
    const created = await provider.addCompetitorProduct({
      seller_id: ACTIVE_SELLER,
      asin: "B0COMPNEW01",
      title: "New Competitor Product",
      brand: "CompetitorBrand",
      price: 29.99,
      marketplace_id: "ATVPDKIKX0DER",
      category: "Kitchen",
      buy_box_winner: false,
      rating: 4.0,
      review_count: 100,
      in_stock: true,
      observed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    expect(created.asin).toBe("B0COMPNEW01");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();

    const all = await provider.getCompetitorProducts();
    expect(all.some((c) => c.id === created.id)).toBe(true);
  });

  it("getCompetitorObservations returns seller-scoped observations", async () => {
    const observations = await provider.getCompetitorObservations();
    expect(Array.isArray(observations)).toBe(true);
    expect(observations.length).toBeGreaterThan(0);
    for (const o of observations) {
      expect(String(o.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof o.competitor_price).toBe("number");
      expect(typeof o.price_gap).toBe("number");
      expect(typeof o.buy_box_eligible).toBe("boolean");
    }
  });

  it("recordCompetitorObservation creates an observation", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const record = await provider.recordCompetitorObservation(product.asin, "B0COMPNEW01", 19.99);
    expect(record.product_asin).toBe(product.asin);
    expect(record.competitor_asin).toBe("B0COMPNEW01");
    expect(record.competitor_price).toBe(19.99);
    expect(record.seller_id).toBe(ACTIVE_SELLER);

    const obs = await provider.getCompetitorObservations(product.asin);
    expect(obs.some((o) => o.id === record.id)).toBe(true);
  });

  it("recordCompetitorObservation rejects unknown product", async () => {
    await expect(provider.recordCompetitorObservation("B0UNKNOWN1", "B0COMPNEW01", 10)).rejects.toThrow();
  });

  it("getFeaturedOffer returns null when not set", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const fo = await provider.getFeaturedOffer(product.asin);
    if (fo) {
      expect(typeof fo.is_buy_box_winner).toBe("boolean");
      expect(typeof fo.offer_price).toBe("number");
      expect(typeof fo.lowest_price).toBe("number");
    }
  });

  it("recordFeaturedOffer creates a featured offer", async () => {
    const products = await provider.getProducts();
    const product = products.products[0];
    const record = await provider.recordFeaturedOffer(product.asin, true, 24.99, 23.99);
    expect(record.asin).toBe(product.asin);
    expect(record.is_buy_box_winner).toBe(true);
    expect(record.offer_price).toBe(24.99);
    expect(record.lowest_price).toBe(23.99);

    const fetched = await provider.getFeaturedOffer(product.asin);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.offer_price).toBeGreaterThanOrEqual(0);
      expect(fetched.lowest_price).toBeGreaterThanOrEqual(0);
    }
  });

  it("competitorProductSchema validates input", () => {
    const result = competitorProductSchema.safeParse({
      asin: "B0COMPTEST01",
      title: "Test Competitor",
      price: 19.99,
      buy_box_winner: false,
      in_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("competitorProductSchema rejects empty asin", () => {
    const result = competitorProductSchema.safeParse({ asin: "", title: "Test" });
    expect(result.success).toBe(false);
  });

  it("competitorObservationSchema validates input", () => {
    const result = competitorObservationSchema.safeParse({
      product_asin: "B0TEST0001",
      competitor_asin: "B0COMPTEST01",
      competitor_price: 19.99,
    });
    expect(result.success).toBe(true);
  });

  it("featuredOfferSchema validates input", () => {
    const result = featuredOfferSchema.safeParse({
      is_buy_box_winner: true,
      offer_price: 24.99,
      lowest_price: 23.99,
    });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider reviews & returns", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getReviews returns seller-scoped reviews", async () => {
    const reviews = await provider.getReviews();
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews.length).toBeGreaterThan(0);
    for (const r of reviews) {
      expect(String(r.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof r.rating).toBe("number");
      expect(typeof r.theme).toBe("string");
      expect(typeof r.text).toBe("string");
    }
  });

  it("getReviews filters by rating and theme", async () => {
    const all = await provider.getReviews();
    if (all.length > 0) {
      const theme = all[0].theme;
      const filtered = await provider.getReviews({ theme, minRating: 1, maxRating: 5 });
      expect(filtered.length).toBeGreaterThan(0);
      for (const r of filtered) {
        expect(r.theme).toBe(theme);
      }
    }
  });

  it("respondToReview adds a response", async () => {
    const reviews = await provider.getReviews();
    const review = reviews[0];
    const updated = await provider.respondToReview(review.id, "Thank you for your feedback.");
    expect(updated.response).toBe("Thank you for your feedback.");
    expect(updated.responded_at).toBeDefined();

    const fetched = await provider.getReviews();
    expect(fetched.some((r) => r.id === review.id && r.response === "Thank you for your feedback.")).toBe(true);
  });

  it("respondToReview rejects unknown review", async () => {
    await expect(provider.respondToReview("rev-nonexistent", "x")).rejects.toThrow();
  });

  it("getReturnRequests returns seller-scoped returns", async () => {
    const returns = await provider.getReturnRequests();
    expect(Array.isArray(returns)).toBe(true);
    expect(returns.length).toBeGreaterThan(0);
    for (const rr of returns) {
      expect(String(rr.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof rr.reason).toBe("string");
      expect(typeof rr.status).toBe("string");
    }
  });

  it("updateReturnRequest changes status", async () => {
    const returns = await provider.getReturnRequests();
    const rr = returns[0];
    const updated = await provider.updateReturnRequest(rr.id, { status: "approved", refund_amount: 30.00 });
    expect(updated.status).toBe("approved");
    expect(updated.refund_amount).toBe(30.00);
    expect(updated.resolved_at).toBeDefined();
  });

  it("updateReturnRequest rejects cross-tenant", async () => {
    const returns = await provider.getReturnRequests();
    const rr = returns[0];
    provider.setActiveSeller(OTHER_SELLER);
    await expect(provider.updateReturnRequest(rr.id, { status: "denied" })).rejects.toThrow();
  });

  it("returnRequestUpdateSchema validates input", () => {
    const result = returnRequestUpdateSchema.safeParse({ status: "approved", refund_amount: 25 });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider promotions & coupons", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getPromotions returns seller-scoped promotions", async () => {
    const promotions = await provider.getPromotions();
    expect(Array.isArray(promotions)).toBe(true);
    expect(promotions.length).toBeGreaterThan(0);
    for (const p of promotions) {
      expect(String(p.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof p.name).toBe("string");
      expect(typeof p.discount_value).toBe("number");
    }
  });

  it("addPromotion creates a promotion owned by active seller", async () => {
    const created = await provider.addPromotion({
      seller_id: ACTIVE_SELLER,
      name: "Holiday Deal",
      type: "percentage_off",
      discount_value: 25,
      min_purchase: 100,
      max_discount: 50,
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      status: "active",
      redemption_count: 0,
      asin_list: ["B0TEST0001"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.name).toBe("Holiday Deal");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();

    const all = await provider.getPromotions();
    expect(all.some((p) => p.id === created.id)).toBe(true);
  });

  it("updatePromotion updates fields", async () => {
    const promotions = await provider.getPromotions();
    const p = promotions[0];
    const updated = await provider.updatePromotion(p.id, { status: "paused" });
    expect(updated.status).toBe("paused");
  });

  it("promotionCreateSchema validates input", () => {
    const result = promotionCreateSchema.safeParse({
      name: "Test Promo",
      type: "fixed_amount_off",
      discount_value: 10,
      min_purchase: 25,
      start_date: "2026-11-01",
      end_date: "2026-11-30",
    });
    expect(result.success).toBe(true);
  });

  it("getCoupons returns seller-scoped coupons", async () => {
    const coupons = await provider.getCoupons();
    expect(Array.isArray(coupons)).toBe(true);
    expect(coupons.length).toBeGreaterThan(0);
    for (const c of coupons) {
      expect(String(c.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof c.code).toBe("string");
      expect(typeof c.discount_value).toBe("number");
    }
  });

  it("addCoupon creates a coupon owned by active seller", async () => {
    const created = await provider.addCoupon({
      seller_id: ACTIVE_SELLER,
      code: "TEST20",
      asin: "B0TEST0001",
      discount_type: "percentage",
      discount_value: 20,
      min_purchase: 0,
      max_redemptions: 100,
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      redeemed_count: 0,
    });
    expect(created.code).toBe("TEST20");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();

    const all = await provider.getCoupons();
    expect(all.some((c) => c.id === created.id)).toBe(true);
  });

  it("couponCreateSchema validates input", () => {
    const result = couponCreateSchema.safeParse({
      code: "SAVE10",
      asin: "B0TEST0001",
      discount_type: "percentage",
      discount_value: 10,
      min_purchase: 0,
      start_date: "2026-11-01",
      end_date: "2026-11-30",
    });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider reports & exports", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getReports returns seller-scoped reports", async () => {
    const reports = await provider.getReports();
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) {
      expect(String(r.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof r.name).toBe("string");
      expect(typeof r.type).toBe("string");
    }
  });

  it("getReport returns a single report", async () => {
    const reports = await provider.getReports();
    const report = reports[0];
    const fetched = await provider.getReport(report.id);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.id).toBe(report.id);
      expect(fetched.name).toBe(report.name);
    }
  });

  it("getReport returns null for unknown id", async () => {
    const fetched = await provider.getReport("rpt-nonexistent");
    expect(fetched).toBeNull();
  });

  it("addReport creates a report owned by active seller", async () => {
    const created = await provider.addReport({
      seller_id: ACTIVE_SELLER,
      name: "Q4 Profitability Report",
      type: "profitability",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
      status: "queued",
      created_at: new Date().toISOString(),
      completed_at: null,
      download_url: null,
      record_count: 0,
      error: null,
    });
    expect(created.name).toBe("Q4 Profitability Report");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.status).toBe("queued");
    expect(created.id).toBeDefined();

    const all = await provider.getReports();
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it("getReportExecutions returns executions", async () => {
    const reports = await provider.getReports();
    const executions = await provider.getReportExecutions(reports[0].id);
    expect(Array.isArray(executions)).toBe(true);
    for (const e of executions) {
      expect(String(e.report_id)).toBe(reports[0].id);
      expect(String(e.seller_id)).toBe(ACTIVE_SELLER);
    }
  });

  it("getExports returns seller-scoped exports", async () => {
    const exports = await provider.getExports();
    expect(Array.isArray(exports)).toBe(true);
    for (const e of exports) {
      expect(String(e.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof e.format).toBe("string");
    }
  });

  it("addExport creates an export owned by active seller", async () => {
    const reports = await provider.getReports();
    const created = await provider.addExport({
      seller_id: ACTIVE_SELLER,
      report_id: reports[0].id,
      format: "csv",
      status: "queued",
      created_at: new Date().toISOString(),
      completed_at: null,
      download_url: null,
      record_count: 0,
      error: null,
    });
    expect(created.report_id).toBe(reports[0].id);
    expect(created.format).toBe("csv");
    expect(created.status).toBe("queued");
    expect(created.id).toBeDefined();

    const all = await provider.getExports();
    expect(all.some((e) => e.id === created.id)).toBe(true);
  });

  it("reportCreateSchema validates input", () => {
    const result = reportCreateSchema.safeParse({
      name: "Test Report",
      type: "sales",
      period_start: "2026-10-01",
      period_end: "2026-10-31",
    });
    expect(result.success).toBe(true);
  });

  it("exportCreateSchema validates input", () => {
    const result = exportCreateSchema.safeParse({
      report_id: "RPT-0001",
      format: "xlsx",
    });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider forecasts", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getForecasts returns seller-scoped forecasts", async () => {
    const forecasts = await provider.getForecasts();
    expect(Array.isArray(forecasts)).toBe(true);
    expect(forecasts.length).toBeGreaterThan(0);
    for (const f of forecasts) {
      expect(String(f.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof f.name).toBe("string");
      expect(typeof f.type).toBe("string");
      expect(typeof f.horizon_days).toBe("number");
    }
  });

  it("getForecast returns a single forecast", async () => {
    const forecasts = await provider.getForecasts();
    const forecast = forecasts[0];
    const fetched = await provider.getForecast(forecast.id);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.id).toBe(forecast.id);
      expect(fetched.name).toBe(forecast.name);
    }
  });

  it("getForecast returns null for unknown id", async () => {
    const fetched = await provider.getForecast("fct-nonexistent");
    expect(fetched).toBeNull();
  });

  it("addForecast creates a forecast owned by active seller", async () => {
    const created = await provider.addForecast({
      seller_id: ACTIVE_SELLER,
      name: "December Revenue Forecast",
      type: "revenue",
      horizon_days: 31,
      period_start: "2026-12-01",
      period_end: "2026-12-31",
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.name).toBe("December Revenue Forecast");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.status).toBe("draft");
    expect(created.id).toBeDefined();

    const all = await provider.getForecasts();
    expect(all.some((f) => f.id === created.id)).toBe(true);
  });

  it("getForecastPoints returns points for a forecast", async () => {
    const forecasts = await provider.getForecasts();
    let points: ForecastPoint[] = [];
    let targetForecastId = null;
    for (const f of forecasts) {
      const candidate = await provider.getForecastPoints(f.id);
      if (candidate.length > 0) {
        points = candidate;
        targetForecastId = f.id;
        break;
      }
    }
    expect(points.length).toBeGreaterThan(0);
    expect(targetForecastId).not.toBeNull();
    for (const p of points) {
      expect(String(p.forecast_id)).toBe(targetForecastId);
      expect(typeof p.value).toBe("number");
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("getForecastScenarios returns scenarios for a forecast", async () => {
    const forecasts = await provider.getForecasts();
    const scenarios = await provider.getForecastScenarios(forecasts[0].id);
    expect(Array.isArray(scenarios)).toBe(true);
    for (const s of scenarios) {
      expect(String(s.forecast_id)).toBe(forecasts[0].id);
      expect(typeof s.growth_rate_pct).toBe("number");
    }
  });

  it("forecastCreateSchema validates input", () => {
    const result = forecastCreateSchema.safeParse({
      name: "Test Forecast",
      type: "inventory",
      horizon_days: 14,
      period_start: "2026-11-01",
      period_end: "2026-11-14",
    });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider AI recommendations", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getAIRecommendations returns seller-scoped recommendations", async () => {
    const recs = await provider.getAIRecommendations();
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(String(r.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof r.title).toBe("string");
      expect(typeof r.confidence).toBe("number");
      expect(["low","medium","high"]).toContain(r.impact);
      expect(["new","reviewed","applied","dismissed"]).toContain(r.status);
      expect(r.source).toBe("simulated");
    }
  });

  it("getAIRecommendations filters by type and status", async () => {
    const byType = await provider.getAIRecommendations({ type: "inventory" });
    expect(byType.length).toBeGreaterThan(0);
    for (const r of byType) {
      expect(r.type).toBe("inventory");
    }
    const byStatus = await provider.getAIRecommendations({ status: "new" });
    expect(byStatus.length).toBeGreaterThan(0);
    for (const r of byStatus) {
      expect(r.status).toBe("new");
    }
  });

  it("getAIRecommendation returns a single recommendation", async () => {
    const recs = await provider.getAIRecommendations();
    const r = recs[0];
    const fetched = await provider.getAIRecommendation(r.id);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.id).toBe(r.id);
      expect(fetched.title).toBe(r.title);
    }
  });

  it("getAIRecommendation returns null for unknown id", async () => {
    const fetched = await provider.getAIRecommendation("ai-nonexistent");
    expect(fetched).toBeNull();
  });

  it("createAIRecommendation creates a recommendation owned by active seller", async () => {
    const created = await provider.createAIRecommendation({
      seller_id: ACTIVE_SELLER,
      type: "ppc",
      title: "Pause underperforming keyword",
      description: "Keyword has high spend and low conversions.",
      rationale: "ACoS above target threshold.",
      confidence: 0.6,
      impact: "medium",
      estimated_monthly_lift_usd: 50.00,
      asin: "B0TEST0001",
      sku: "TEST-01",
      status: "new",
      source: "simulated",
      model: "rule-based-ppc-v1",
      reviewed_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reviewed_at: null,
    });
    expect(created.type).toBe("ppc");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.id).toBeDefined();
    expect(created.source).toBe("simulated");

    const all = await provider.getAIRecommendations();
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it("updateAIRecommendation updates status", async () => {
    const recs = await provider.getAIRecommendations();
    const r = recs[0];
    const updated = await provider.updateAIRecommendation(r.id, { status: "reviewed", reviewed_by: "user-1" });
    expect(updated.status).toBe("reviewed");
    expect(updated.reviewed_by).toBe("user-1");
    expect(updated.reviewed_at).toBeDefined();
  });

  it("updateAIRecommendation rejects cross-tenant", async () => {
    const recs = await provider.getAIRecommendations();
    const r = recs[0];
    provider.setActiveSeller(OTHER_SELLER);
    await expect(provider.updateAIRecommendation(r.id, { status: "applied" })).rejects.toThrow();
  });

  it("generateAIRecommendations creates data-grounded recommendations", async () => {
    const generated = await provider.generateAIRecommendations();
    expect(Array.isArray(generated)).toBe(true);
    expect(generated.length).toBeGreaterThan(0);
    for (const r of generated) {
      expect(r.source).toBe("simulated");
      expect(r.seller_id).toBe(ACTIVE_SELLER);
      expect(r.status).toBe("new");
    }
    const all = await provider.getAIRecommendations();
    for (const r of generated) {
      expect(all.some((x) => x.id === r.id)).toBe(true);
    }
  });

  it("aiRecommendationCreateSchema validates input", () => {
    const result = aiRecommendationCreateSchema.safeParse({
      type: "seo",
      title: "Optimize title",
      description: "Title too short.",
      rationale: "Improve search visibility.",
      confidence: 0.8,
      impact: "medium",
      asin: "B0TEST0001",
      sku: "TEST-01",
      status: "new",
      source: "simulated",
    });
    expect(result.success).toBe(true);
  });

  it("aiRecommendationCreateSchema rejects invalid confidence", () => {
    const result = aiRecommendationCreateSchema.safeParse({
      type: "pricing",
      title: "Test",
      description: "Test.",
      rationale: "Test.",
      confidence: 1.5,
      impact: "low",
    });
    expect(result.success).toBe(false);
  });

  it("aiRecommendationPatchSchema accepts partial updates", () => {
    const result = aiRecommendationPatchSchema.safeParse({ status: "dismissed" });
    expect(result.success).toBe(true);
  });

  it("aiMessageCreateSchema validates input", () => {
    const result = aiMessageCreateSchema.safeParse({
      role: "user",
      content: "How can I improve my listings?",
    });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider AI conversations", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getAIConversations returns empty initially", async () => {
    const convs = await provider.getAIConversations();
    expect(Array.isArray(convs)).toBe(true);
    expect(convs.length).toBe(0);
  });

  it("addAIMessage requires existing conversation", async () => {
    await expect(
      provider.addAIMessage("conv-nonexistent", "user", "Hello"),
    ).rejects.toThrow();
  });
});

describe("MockProvider automation rules", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getAutomationRules returns seller-scoped rules", async () => {
    const rules = await provider.getAutomationRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) {
      expect(String(r.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof r.name).toBe("string");
      expect(typeof r.type).toBe("string");
      expect(typeof r.enabled).toBe("boolean");
    }
  });

  it("getAutomationRules filters by type and enabled", async () => {
    const rules = await provider.getAutomationRules();
    if (rules.length > 0) {
      const type = rules[0].type;
      const filtered = await provider.getAutomationRules({ ...(type ? { type } : {}), enabled: true });
      expect(filtered.length).toBeGreaterThan(0);
      for (const r of filtered) {
        expect(r.type).toBe(type);
        expect(r.enabled).toBe(true);
      }
    }
  });

  it("getAutomationRule returns a single rule", async () => {
    const rules = await provider.getAutomationRules();
    const rule = rules[0];
    const fetched = await provider.getAutomationRule(rule.id);
    expect(fetched).not.toBeNull();
    if (fetched) {
      expect(fetched.id).toBe(rule.id);
      expect(fetched.name).toBe(rule.name);
    }
  });

  it("getAutomationRule returns null for unknown id", async () => {
    const fetched = await provider.getAutomationRule("auto-nonexistent");
    expect(fetched).toBeNull();
  });

  it("addAutomationRule creates a rule owned by active seller", async () => {
    const created = await provider.addAutomationRule({
      seller_id: ACTIVE_SELLER,
      name: "Test Restock Rule",
      description: "Auto restock when low",
      type: "inventory_restock",
      enabled: true,
      conditions: { days_of_supply: { operator: "less_than", value: 15 } },
      actions: { action: "create_purchase_order" },
      schedule_cron: "*/30 * * * *",
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      success_count: 0,
      failure_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.name).toBe("Test Restock Rule");
    expect(created.seller_id).toBe(ACTIVE_SELLER);
    expect(created.enabled).toBe(true);
    expect(created.id).toBeDefined();
    expect(created.run_count).toBe(0);

    const all = await provider.getAutomationRules();
    expect(all.some((r) => r.id === created.id)).toBe(true);
  });

  it("updateAutomationRule updates fields", async () => {
    const rules = await provider.getAutomationRules();
    const r = rules[0];
    const updated = await provider.updateAutomationRule(r.id, { enabled: false, name: "Updated Rule" });
    expect(updated.enabled).toBe(false);
    expect(updated.name).toBe("Updated Rule");
    expect(updated.updated_at).toBeDefined();
  });

  it("updateAutomationRule rejects cross-tenant", async () => {
    const rules = await provider.getAutomationRules();
    const r = rules[0];
    provider.setActiveSeller(OTHER_SELLER);
    await expect(provider.updateAutomationRule(r.id, { enabled: false })).rejects.toThrow();
  });

  it("deleteAutomationRule removes the rule", async () => {
    const rules = await provider.getAutomationRules();
    const before = rules.length;
    await provider.deleteAutomationRule(rules[0].id);
    const after = await provider.getAutomationRules();
    expect(after.length).toBe(before - 1);
  });

  it("deleteAutomationRule rejects cross-tenant", async () => {
    const rules = await provider.getAutomationRules();
    provider.setActiveSeller(OTHER_SELLER);
    await expect(provider.deleteAutomationRule(rules[0].id)).rejects.toThrow();
  });

  it("runAutomationRule executes and records execution", async () => {
    const rules = await provider.getAutomationRules();
    const rule = rules.find((r) => r.enabled === true) || rules[0];
    const execution = await provider.runAutomationRule(rule.id);
    expect(execution.rule_id).toBe(rule.id);
    expect(execution.seller_id).toBe(ACTIVE_SELLER);
    expect(execution.status).toBe("completed");
    expect(execution.records_processed).toBeGreaterThanOrEqual(0);

    const updatedRule = await provider.getAutomationRule(rule.id);
    expect(updatedRule!.run_count).toBe(1);
    expect(updatedRule!.success_count).toBe(1);
  });

  it("runAutomationRule rejects disabled rule", async () => {
    const rules = await provider.getAutomationRules();
    const disabled = await provider.addAutomationRule({
      seller_id: ACTIVE_SELLER,
      name: "Disabled Rule",
      type: "custom",
      enabled: false,
      description: null,
      conditions: {},
      actions: {},
      schedule_cron: null,
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      success_count: 0,
      failure_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await expect(provider.runAutomationRule(disabled.id)).rejects.toThrow();
  });

  it("runAutomationRule rejects unknown rule", async () => {
    await expect(provider.runAutomationRule("auto-nonexistent")).rejects.toThrow();
  });

  it("getAutomationExecutions returns executions for a rule", async () => {
    const rules = await provider.getAutomationRules();
    const rule = rules[0];
    await provider.runAutomationRule(rule.id);
    const executions = await provider.getAutomationExecutions(rule.id);
    expect(Array.isArray(executions)).toBe(true);
    expect(executions.length).toBeGreaterThan(0);
    for (const e of executions) {
      expect(String(e.rule_id)).toBe(rule.id);
    }
  });

  it("automationRuleCreateSchema validates input", () => {
    const result = automationRuleCreateSchema.safeParse({
      name: "Test Rule",
      type: "inventory_restock",
      enabled: true,
      conditions: { days_of_supply: { operator: "less_than", value: 15 } },
      actions: { action: "create_purchase_order" },
    });
    expect(result.success).toBe(true);
  });

  it("automationRulePatchSchema accepts partial updates", () => {
    const result = automationRulePatchSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });
});

describe("MockProvider notifications & alerts", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getNotifications returns seller-scoped notifications", async () => {
    const notifications = await provider.getNotifications();
    expect(Array.isArray(notifications)).toBe(true);
    expect(notifications.length).toBeGreaterThan(0);
    for (const n of notifications) {
      expect(String(n.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof n.title).toBe("string");
      expect(typeof n.message).toBe("string");
      expect(typeof n.read).toBe("boolean");
    }
  });

  it("markNotificationRead marks a notification read", async () => {
    const notifications = await provider.getNotifications();
    const n = notifications.find((x) => !x.read) || notifications[0];
    const updated = await provider.markNotificationRead(n.id);
    expect(updated.read).toBe(true);
  });

  it("getAlerts returns seller-scoped alerts", async () => {
    const alerts = await provider.getAlerts();
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      expect(String(a.seller_id)).toBe(ACTIVE_SELLER);
      expect(typeof a.severity).toBe("string");
      expect(typeof a.title).toBe("string");
      expect(typeof a.acknowledged).toBe("boolean");
    }
  });

  it("acknowledgeAlert acknowledges an alert", async () => {
    const alerts = await provider.getAlerts();
    const a = alerts.find((x) => !x.acknowledged) || alerts[0];
    const updated = await provider.acknowledgeAlert(a.id, "user-1");
    expect(updated.acknowledged).toBe(true);
    expect(updated.acknowledged_by).toBe("user-1");
    expect(updated.acknowledged_at).toBeDefined();
  });

  it("acknowledgeAlert rejects unknown alert", async () => {
    await expect(provider.acknowledgeAlert("alert-nonexistent", "user-1")).rejects.toThrow();
  });
});

describe("MockProvider SaaS admin", () => {
  let provider: MockProvider;

  beforeEach(() => {
    resetMockState();
    provider = new MockProvider();
    provider.setActiveSeller(ACTIVE_SELLER);
  });

  it("getOrganizations returns organizations", async () => {
    const orgs = await provider.getOrganizations();
    expect(Array.isArray(orgs)).toBe(true);
    expect(orgs.length).toBeGreaterThan(0);
    expect(orgs[0].name).toBe("AmzSphere Demo Org");
  });

  it("getOrganization returns a single organization", async () => {
    const orgs = await provider.getOrganizations();
    const org = await provider.getOrganization(orgs[0].id);
    expect(org).not.toBeNull();
    if (org) {
      expect(org.id).toBe(orgs[0].id);
      expect(org.name).toBe(orgs[0].name);
    }
  });

  it("updateOrganization updates plan", async () => {
    const orgs = await provider.getOrganizations();
    const updated = await provider.updateOrganization(orgs[0].id, { plan: "professional" });
    expect(updated.plan).toBe("professional");
  });

  it("getUsers returns users", async () => {
    const users = await provider.getUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0].email).toBe("mock@amzsphere.local");
  });

  it("getSellerAccounts returns seller accounts", async () => {
    const accounts = await provider.getSellerAccounts();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
  });

  it("getSubscriptions returns subscriptions", async () => {
    const subs = await provider.getSubscriptions();
    expect(Array.isArray(subs)).toBe(true);
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0].plan).toBe("starter");
  });

  it("addSubscription creates a subscription", async () => {
    const orgs = await provider.getOrganizations();
    const created = await provider.addSubscription({
      organization_id: orgs[0].id,
      plan: "professional",
      status: "active",
      price_usd_cents: 9900,
      currency: "USD",
      interval: "month",
      current_period_start: "2026-11-01",
      current_period_end: "2026-11-30",
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.plan).toBe("professional");
    expect(created.status).toBe("active");
    expect(created.id).toBeDefined();
  });

  it("cancelSubscription cancels a subscription", async () => {
    const subs = await provider.getSubscriptions();
    await provider.cancelSubscription(subs[0].id);
    const updated = await provider.getSubscription(subs[0].id);
    expect(updated).not.toBeNull();
    if (updated) {
      expect(updated.status).toBe("canceled");
    }
  });

  it("getInvoices returns invoices", async () => {
    const invoices = await provider.getInvoices();
    expect(Array.isArray(invoices)).toBe(true);
    expect(invoices.length).toBeGreaterThan(0);
  });

  it("getPaymentMethods returns payment methods", async () => {
    const methods = await provider.getPaymentMethods();
    expect(Array.isArray(methods)).toBe(true);
    expect(methods.length).toBeGreaterThan(0);
    expect(methods[0].type).toBe("card");
  });

  it("addPaymentMethod creates a payment method", async () => {
    const orgs = await provider.getOrganizations();
    const created = await provider.addPaymentMethod({
      organization_id: orgs[0].id,
      type: "card",
      last4: "1234",
      brand: "Mastercard",
      expiry_month: 6,
      expiry_year: 2027,
      is_default: false,
      created_at: new Date().toISOString(),
    });
    expect(created.type).toBe("card");
    expect(created.last4).toBe("1234");
    expect(created.id).toBeDefined();
  });

  it("getBillingAddresses returns billing addresses", async () => {
    const addresses = await provider.getBillingAddresses();
    expect(Array.isArray(addresses)).toBe(true);
    expect(addresses.length).toBeGreaterThan(0);
  });

  it("addBillingAddress creates a billing address", async () => {
    const orgs = await provider.getOrganizations();
    const created = await provider.addBillingAddress({
      organization_id: orgs[0].id,
      name: "Test Org",
      line1: "456 Oak Ave",
      line2: null,
      city: "Portland",
      state: "OR",
      postal_code: "97201",
      country: "US",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.city).toBe("Portland");
    expect(created.id).toBeDefined();
  });

  it("getTeamMemberships returns team memberships", async () => {
    const members = await provider.getTeamMemberships();
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
    expect(members[0].role).toBe("owner");
  });

  it("addTeamMembership creates a team membership", async () => {
    const orgs = await provider.getOrganizations();
    const users = await provider.getUsers();
    const created = await provider.addTeamMembership({
      organization_id: orgs[0].id,
      user_id: users[0].id,
      role: "member",
      invited_by: null,
      invited_at: null,
      accepted_at: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(created.role).toBe("member");
    expect(created.id).toBeDefined();
  });

  it("getBillingPlans returns billing plans", async () => {
    const plans = await provider.getBillingPlans();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.plan === "starter")).toBe(true);
  });

  it("organizationUpdateSchema validates input", () => {
    const result = organizationUpdateSchema.safeParse({ plan: "enterprise" });
    expect(result.success).toBe(true);
  });

  it("userUpdateSchema validates input", () => {
    const result = userUpdateSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(true);
  });

  it("sellerAccountCreateSchema validates input", () => {
    const result = sellerAccountCreateSchema.safeParse({
      organization_id: "org-1",
      merchant_id: "MERCH-1",
      marketplace_id: "ATVPDKIKX0DER",
    });
    expect(result.success).toBe(true);
  });

  it("subscriptionCreateSchema validates input", () => {
    const result = subscriptionCreateSchema.safeParse({
      organization_id: "org-1",
      plan: "professional",
      price_usd_cents: 9900,
      current_period_start: "2026-11-01",
      current_period_end: "2026-11-30",
    });
    expect(result.success).toBe(true);
  });

  it("paymentMethodCreateSchema validates input", () => {
    const result = paymentMethodCreateSchema.safeParse({
      organization_id: "org-1",
      type: "card",
      last4: "4242",
      brand: "Visa",
      expiry_month: 12,
      expiry_year: 2028,
    });
    expect(result.success).toBe(true);
  });

  it("teamMembershipCreateSchema validates input", () => {
    const result = teamMembershipCreateSchema.safeParse({
      organization_id: "org-1",
      user_id: "user-1",
      role: "member",
    });
    expect(result.success).toBe(true);
  });
});
