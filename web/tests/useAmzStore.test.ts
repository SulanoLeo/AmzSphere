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
      seoScore: 70,
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

  it("adds a local product with calculated listing and inventory metrics", () => {
    const product = useAmzStore.getState().addProduct({
      title: "Desk Organizer",
      sku: "DESK-01",
      asin: "B0NEW00001",
      price: 24.99,
      stockLevel: 100,
      bullets: ["One", "Two", "Three", "Four", "Five"],
      imagesUploaded: true,
    });

    expect(product).toMatchObject({
      id: "local-DESK-01",
      name: "Desk Organizer",
      title: "Desk Organizer",
      seoScore: 98,
      opt_score: 98,
      missingAssets: { bullets: false, images: false },
      stockLevel: 100,
      daily_velocity: 10,
      daysSupply: 10,
      images: expect.arrayContaining(["/mock-product-images/DESK-01/1.jpg"]),
      isClientCreated: true,
    });
    expect(product.images).toHaveLength(7);
    expect(useAmzStore.getState().products).toHaveLength(1);
  });

  it("scores incomplete local products and retains them through catalog hydration", () => {
    useAmzStore.getState().addProduct({
      title: "Incomplete Listing",
      sku: "INCOMPLETE-01",
      asin: "B0NEW00002",
      price: 12.5,
      stockLevel: 30,
      bullets: ["Only one bullet"],
      imagesUploaded: false,
    });

    expect(useAmzStore.getState().products[0]).toMatchObject({
      seoScore: 70,
      missingAssets: { bullets: true, images: true },
      daysSupply: 3,
      opt_status: "needs_optimization",
    });

    useAmzStore.getState().hydrateProducts([makeProduct()]);
    expect(useAmzStore.getState().products.map((product) => product.sku)).toEqual([
      "TEST-01",
      "INCOMPLETE-01",
    ]);
  });

  it("rejects duplicate SKU and ASIN values", () => {
    useAmzStore.getState().addProduct({
      title: "Desk Organizer",
      sku: "DESK-01",
      asin: "B0NEW00001",
      price: 24.99,
      stockLevel: 10,
      bullets: [],
      imagesUploaded: false,
    });

    expect(() => useAmzStore.getState().addProduct({
      title: "Another Product",
      sku: "desk-01",
      asin: "B0NEW00002",
      price: 10,
      stockLevel: 10,
      bullets: [],
      imagesUploaded: false,
    })).toThrow("A product with SKU desk-01 already exists.");
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
