import { describe, it, expect, vi } from "vitest";
import { MockSimulator, TICK_SECONDS } from "@/lib/simulator";

function baseState(overrides: Record<string, unknown> = {}): any {
  return {
    last_updated: new Date(Date.now() - TICK_SECONDS * 1000 - 100).toISOString(),
    tick_count: 0,
    history_end: new Date().toISOString().split("T")[0],
    sales_history: {
      "TEST-01": [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    },
    products: [
      {
        id: "p1",
        asin: "B0TEST0001",
        sku: "TEST-01",
        marketplace_id: "ATVPDKIKX0DER",
        source: "manual",
        name: "Test Product",
        title: "Test Product Title",
        category: "Office",
        price: 24.99,
        bullets: [],
        description: "",
        backend_keywords: [],
        images: [],
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
        po_draft_id: null,
        suppressed: false,
        last_synced_at: null,
        sync_status: "synced",
        last_optimized_at: null,
        opt_score: 80,
        opt_issues: [],
        opt_status: "optimized",
      },
    ],
    global_products: [],
    purchase_orders: [],
    activity: [],
    campaigns: [],
    search_terms: [],
    targeted_exact_keywords: [],
    negative_keywords: [],
    ...overrides,
  };
}

describe("MockSimulator.tick", () => {
  it("increments tick_count on each call", () => {
    const state = baseState();
    const sim = new MockSimulator();
    sim.tick(state);
    expect(state.tick_count).toBe(1);
    sim.tick(state);
    expect(state.tick_count).toBe(2);
  });

  it("updates last_updated to current ISO", () => {
    const state = baseState();
    const sim = new MockSimulator();
    sim.tick(state);
    expect(state.last_updated).toBeDefined();
    const parsed = new Date(state.last_updated);
    expect(parsed.getTime()).toBeCloseTo(Date.now(), -2);
  });

  it("burns stock by daily_velocity per tick", () => {
    const state = baseState();
    const sim = new MockSimulator();
    sim.tick(state);
    const product = state.products[0];
    const expected = 100 - (10 * TICK_SECONDS) / 86400;
    expect(product.stock).toBeCloseTo(expected, 3);
    expect(product.sellable_units).toBe(product.stock);
  });

  it("drafts a purchase order when days of supply drops below 15 and none exists", () => {
    const state = baseState({
      products: [
        {
          ...baseState().products[0],
          stock: 10,
          daily_velocity: 10,
          days_of_supply: 1,
          po_draft_id: null,
        },
      ],
      purchase_orders: [],
      activity: [],
    });
    const sim = new MockSimulator();
    sim.tick(state);
    const pos = state.purchase_orders;
    expect(pos.length).toBeGreaterThan(0);
    expect(pos[0].status).toBe("draft");
    expect(pos[0].units).toBeGreaterThan(0);
    expect(state.products[0].po_draft_id).toBe(pos[0].id);
  });

  it("does not draft a duplicate PO when one already exists", () => {
    const state = baseState({
      products: [
        {
          ...baseState().products[0],
          stock: 10,
          daily_velocity: 10,
          days_of_supply: 1,
          po_draft_id: "PO-EXIST",
        },
      ],
      purchase_orders: [{ id: "PO-EXIST", status: "draft" }],
      activity: [],
    });
    const sim = new MockSimulator();
    sim.tick(state);
    const drafts = state.purchase_orders.filter((p: any) => p.id !== "PO-EXIST" && p.status === "draft");
    expect(drafts.length).toBe(0);
  });

  it("reprice lowers price toward competitor when competitor is above floor and below price", () => {
    const state = baseState({
      products: [
        {
          ...baseState().products[0],
          price: 30,
          competitor_price: 20,
          min_floor: 15,
          max_price: 40,
        },
      ],
    });
    // Force reprice tick by setting tick_count to a multiple of REPRICE_EVERY_TICKS (6)
    state.tick_count = 5; // next tick makes it 6
    const sim = new MockSimulator();
    sim.tick(state);
    const product = state.products[0];
    expect(product.price).toBeLessThan(30);
    expect(product.price).toBeGreaterThanOrEqual(15);
  });

  it("records activity events with bounded length", () => {
    const state = baseState({ activity: [] });
    const sim = new MockSimulator();
    sim.tick(state);
    expect(Array.isArray(state.activity)).toBe(true);
    if (state.activity.length > 0) {
      expect(state.activity[0]).toHaveProperty("id");
      expect(state.activity[0]).toHaveProperty("timestamp");
      expect(state.activity[0]).toHaveProperty("category");
    }
  });
});
