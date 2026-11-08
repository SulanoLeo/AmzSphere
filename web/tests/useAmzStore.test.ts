import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "@/lib/provider/types";
import { useAmzStore } from "@/lib/useAmzStore";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    asin: "B0TEST0001",
    sku: "TEST-01",
    marketplace_id: "ATVPDKIKX0DER",
    seller_id: "mock-seller",
    source: "manual",
    name: "Test Product",
    title: "Test Product title",
    category: "Office",
    price: 24.99,
    bullets: ["One", "Two", "Three", "Four", "Five"],
    description: "Test description",
    backend_keywords: ["test product"],
    images: ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg"],
    sellable_units: 100,
    stock: 100,
    days_of_supply: 10,
    daily_velocity: 10,
    competitor_price: 25.99,
    market_price: 26.99,
    min_floor: 20,
    max_price: 30,
    unit_cost: 10,
    lead_time_days: 21,
    supplier: "Test Supplier",
    supplier_id: null,
    po_draft_id: null,
    parent_asin: null,
    variation_theme: null,
    suppressed: false,
    last_synced_at: null,
    sync_status: "synced",
    last_optimized_at: null,
    opt_score: 80,
    opt_issues: [],
    opt_status: "optimized",
    ...overrides,
  };
}

describe("useAmzStore", () => {
  beforeEach(() => {
    useAmzStore.setState({ products: [] });
  });

  it("hydrates a unified product with stock, velocity, supply, and SEO metrics", () => {
    useAmzStore.getState().hydrateProducts([makeProduct()]);
    const product = useAmzStore.getState().products[0];

    expect(product).toMatchObject({
      sku: "TEST-01",
      asin: "B0TEST0001",
      seoScore: 98,
      missingAssets: { bullets: false, images: false },
      stockLevel: 100,
      velocity30d: 300,
      daysSupply: 10,
      adStatus: "inactive",
    });
  });

  it("recalculates SEO completeness and score when listing content changes", () => {
    useAmzStore.getState().hydrateProducts([
      makeProduct({ bullets: ["One"], images: ["/1.jpg"] }),
    ]);

    expect(useAmzStore.getState().products[0]).toMatchObject({
      seoScore: 75,
      missingAssets: { bullets: true, images: true },
    });

    useAmzStore.getState().updateProductSEO("TEST-01", {
      bullets: ["One", "Two", "Three", "Four", "Five"],
      images: ["/1.jpg", "/2.jpg", "/3.jpg", "/4.jpg", "/5.jpg", "/6.jpg", "/7.jpg"],
    });

    expect(useAmzStore.getState().products[0]).toMatchObject({
      seoScore: 98,
      missingAssets: { bullets: false, images: false },
    });
  });

  it("preserves PPC status across hydration and toggles only the matching SKU", () => {
    useAmzStore.getState().hydrateProducts([makeProduct(), makeProduct({
      id: "product-2",
      asin: "B0TEST0002",
      sku: "TEST-02",
    })]);
    useAmzStore.getState().togglePpcStatus("TEST-01");
    useAmzStore.getState().hydrateProducts([makeProduct()]);

    expect(useAmzStore.getState().products[0].adStatus).toBe("active");
    useAmzStore.getState().togglePpcStatus("TEST-01");
    expect(useAmzStore.getState().products[0].adStatus).toBe("paused");
  });
});
