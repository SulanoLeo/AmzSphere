import { describe, it, expect } from "vitest";
import {
  computeOptScore,
  evaluateRules,
  statusForScore,
  impactRank,
  recentSalesVolume,
  PENALTY_TITLE,
  PENALTY_BULLETS,
  PENALTY_IMAGES,
  PENALTY_DESCRIPTION,
  PENALTY_BACKEND_KEYWORDS,
  PENALTY_SUPPRESSED,
  NEEDS_OPTIMIZATION_THRESHOLD,
} from "@/lib/scoring";

const baseProduct: Record<string, unknown> = {
  id: "p1",
  asin: "B0TEST0001",
  sku: "TEST-01",
  marketplace_id: "ATVPDKIKX0DER",
  source: "manual",
  name: "Test Product",
  title: "A properly optimized product title that is long enough and contains the main keyword widget",
  category: "Office",
  price: 24.99,
  bullets: [
    "Bullet one with enough detail here.",
    "Bullet two with enough detail here.",
    "Bullet three with enough detail here.",
    "Bullet four with enough detail here.",
    "Bullet five with enough detail here.",
  ],
  description: "A well-formed product description that exceeds fifty characters in length for completeness.",
  backend_keywords: ["widget", "test"],
  images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg", "6.jpg", "7.jpg"],
  stock: 100,
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
  opt_score: 0,
  opt_issues: [],
  opt_status: "needs_optimization",
};

describe("computeOptScore", () => {
  it("returns max score for a fully compliant product", () => {
    const result = computeOptScore({ ...baseProduct });
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
    expect(result.status).toBe("optimized");
  });

  it("applies title penalty when too short", () => {
    const result = computeOptScore({ ...baseProduct, title: "Short" });
    expect(result.score).toBe(100 - PENALTY_TITLE);
    expect(result.issues.some((i) => i.includes("shorter than 80"))).toBe(true);
  });

  it("applies bullets penalty when fewer than 5", () => {
    const result = computeOptScore({ ...baseProduct, bullets: ["a", "b", "c"] });
    expect(result.score).toBe(100 - PENALTY_BULLETS);
    expect(result.issues.some((i) => i.includes("bullet points"))).toBe(true);
  });

  it("applies images penalty when fewer than 7", () => {
    const result = computeOptScore({ ...baseProduct, images: ["1.jpg", "2.jpg"] });
    expect(result.score).toBe(100 - PENALTY_IMAGES);
    expect(result.issues.some((i) => i.includes("main images"))).toBe(true);
  });

  it("applies description penalty when too short", () => {
    const result = computeOptScore({ ...baseProduct, description: "Too short" });
    expect(result.score).toBe(100 - PENALTY_DESCRIPTION);
    expect(result.issues.some((i) => i.includes("shorter than 50"))).toBe(true);
  });

  it("applies backend keywords penalty when none configured", () => {
    const result = computeOptScore({ ...baseProduct, backend_keywords: [] });
    expect(result.score).toBe(100 - PENALTY_BACKEND_KEYWORDS);
    expect(result.issues.some((i) => i.includes("keywords"))).toBe(true);
  });

  it("applies suppressed penalty when listing suppressed", () => {
    const result = computeOptScore({ ...baseProduct, suppressed: true });
    expect(result.score).toBe(100 - PENALTY_SUPPRESSED);
    expect(result.issues.some((i) => i.includes("suppressed"))).toBe(true);
  });

  it("clamps score between 0 and 100", () => {
    const result = computeOptScore({
      ...baseProduct,
      title: "x",
      bullets: [],
      images: [],
      description: "",
      backend_keywords: [],
      suppressed: true,
    });
    expect(result.score).toBe(0);
    expect(result.status).toBe("needs_optimization");
  });
});

describe("statusForScore", () => {
  it("returns needs_optimization below threshold", () => {
    expect(statusForScore(NEEDS_OPTIMIZATION_THRESHOLD - 1)).toBe("needs_optimization");
  });
  it("returns optimized at or above threshold", () => {
    expect(statusForScore(NEEDS_OPTIMIZATION_THRESHOLD)).toBe("optimized");
    expect(statusForScore(100)).toBe("optimized");
  });
});

describe("impactRank", () => {
  it("computes (100 - score) * volume", () => {
    const product = { ...baseProduct, opt_score: 70, daily_velocity: 10 };
    expect(impactRank(product)).toBe(30 * 70);
  });
  it("falls back to daily_velocity when no sales_history", () => {
    const product = { ...baseProduct, opt_score: 50, daily_velocity: 4 };
    expect(impactRank(product)).toBe((100 - 50) * 4 * 7);
  });
});

describe("recentSalesVolume", () => {
  it("sums last 7 days of sales_history when present", () => {
    const product = { ...baseProduct, sales_history: [1, 2, 3, 4, 5, 6, 7, 8] };
    expect(recentSalesVolume(product, 7)).toBe(2 + 3 + 4 + 5 + 6 + 7 + 8);
  });
  it("falls back to daily_velocity * windowDays", () => {
    const product = { ...baseProduct, daily_velocity: 10 };
    expect(recentSalesVolume(product, 30)).toBe(10 * 30);
  });
});

describe("evaluateRules", () => {
  it("returns penalty count and issues", () => {
    const [score, issues] = evaluateRules({
      ...baseProduct,
      title: "x",
      bullets: [],
      images: [],
      description: "",
      backend_keywords: [],
      suppressed: true,
    });
    expect(score).toBe(0);
    expect(issues.length).toBe(6); // all six rules fail: title, bullets, images, description, backend_keywords, suppressed
  });
});
