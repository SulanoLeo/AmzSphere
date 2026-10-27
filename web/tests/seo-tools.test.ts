import { describe, it, expect, beforeEach } from "vitest";
import {
  SEED_TOOLS,
  filterAndSortTools,
  computeMonthlyCost,
  recommendStarterStack,
  loadSelectionFromStorage,
  saveSelectionToStorage,
  getAllCategories,
  getCategoryRegistry,
  type SeoToolFilters,
  type Marketplace,
} from "@/lib/seo-tools";

const originalTools = [...SEED_TOOLS];

beforeEach(() => {
  SEED_TOOLS.length = 0;
  SEED_TOOLS.push(...originalTools);
});

describe("SEED_TOOLS", () => {
  it("has at least 10 sample tools", () => {
    expect(SEED_TOOLS.length).toBeGreaterThanOrEqual(10);
  });

  it("every tool has required fields and is marked sample", () => {
    for (const tool of SEED_TOOLS) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.short_description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(["free", "freemium", "paid"]).toContain(tool.pricing_model);
      expect(Array.isArray(tool.features)).toBe(true);
      expect(Array.isArray(tool.marketplaces)).toBe(true);
      expect(tool.marketplaces.length).toBeGreaterThan(0);
      expect(tool.website_url).toBeTruthy();
      expect(typeof tool.is_active).toBe("boolean");
    }
  });
});

describe("filterAndSortTools", () => {
  const baseFilters: SeoToolFilters = { page: 1, page_size: 100, sort: "relevance" };

  it("returns all active tools paginated", () => {
    const { tools, total } = filterAndSortTools([...SEED_TOOLS], baseFilters);
    expect(total).toBe(SEED_TOOLS.length);
    expect(tools.length).toBe(SEED_TOOLS.length);
  });

  it("excludes inactive tools", () => {
    const inactive = { ...SEED_TOOLS[0], is_active: false };
    const { total } = filterAndSortTools([inactive, ...SEED_TOOLS.slice(1)], baseFilters);
    expect(total).toBe(SEED_TOOLS.length - 1);
  });

  it("searches by name and feature", () => {
    const { tools } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, search: "helium" });
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("Helium 10");

    const { tools: research } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, search: "research" });
    expect(research.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by category", () => {
    const { tools, total } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, category: "PPC/Advertising" });
    expect(total).toBe(1);
    expect(tools[0].name).toBe("Sellics");
  });

  it("filters by pricing model", () => {
    const { total } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, pricing_model: "free" });
    expect(total).toBe(1);
    expect(filterAndSortTools([...SEED_TOOLS], { ...baseFilters, pricing_model: "paid" }).total).toBeGreaterThan(0);
  });

  it("filters by marketplace", () => {
    const { total } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, marketplace: "JP" });
    expect(total).toBeGreaterThan(0);
    for (const t of filterAndSortTools([...SEED_TOOLS], { ...baseFilters, marketplace: "JP" }).tools) {
      expect(t.marketplaces).toContain("JP");
    }
  });

  it("filters by rating and price range", () => {
    const { total: byRating } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, min_rating: 4.6 });
    expect(byRating).toBeGreaterThan(0);

    const { total: cheap } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, max_price: 25 });
    expect(cheap).toBeGreaterThan(0);

    const { tools } = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, min_price: 100 });
    expect(tools).toHaveLength(0);
  });

  it("sorts by rating, price, and name", () => {
    const byRating = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, sort: "rating" }).tools;
    expect(byRating[0].rating).toBeGreaterThanOrEqual(byRating[1].rating ?? 0);

    const byPriceAsc = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, sort: "price_asc" }).tools;
    expect((byPriceAsc[0].starting_price_usd ?? 0)).toBeLessThanOrEqual(byPriceAsc[1]?.starting_price_usd ?? 0);

    const byPriceDesc = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, sort: "price_desc" }).tools;
    expect((byPriceDesc[0].starting_price_usd ?? 0)).toBeGreaterThanOrEqual(byPriceDesc[1]?.starting_price_usd ?? 0);

    const byName = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, sort: "name" }).tools;
    const byNameSorted = [...byName.map((t) => t.name)].sort((a, b) => a.localeCompare(b));
    expect(byName.map((t) => t.name)).toEqual(byNameSorted);
  });

  it("paginates results", () => {
    const page1 = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, page: 1, page_size: 5 });
    expect(page1.tools.length).toBe(5);
    expect(page1.total).toBe(SEED_TOOLS.length);
    const expectedPages = Math.ceil(page1.total / 5);
    expect(expectedPages).toBe(3);

    const page2 = filterAndSortTools([...SEED_TOOLS], { ...baseFilters, page: 2, page_size: 5 });
    expect(page2.tools[0].id).not.toBe(page1.tools[0].id);
  });
});

describe("computeMonthlyCost", () => {
  it("sums starting prices of selected tools", () => {
    const [a, b] = SEED_TOOLS.slice(0, 2);
    expect(computeMonthlyCost([a, b])).toBe((a.starting_price_usd ?? 0) + (b.starting_price_usd ?? 0));
    expect(computeMonthlyCost([])).toBe(0);
  });
});

describe("recommendStarterStack", () => {
  it("returns up to 4 tools within budget and matching goals", () => {
    const result = recommendStarterStack({
      seller_size: "small",
      budget: "low",
      goals: ["ranking", "listings"],
      marketplaces: ["US", "UK"] as Marketplace[],
    });
    expect(result.tool_ids.length).toBeLessThanOrEqual(4);
    expect(result.reason).toContain("budget up to $50/mo");
    for (const id of result.tool_ids) {
      const tool = SEED_TOOLS.find((t) => t.id === id);
      expect(tool).toBeDefined();
      expect(tool!.is_active).toBe(true);
      expect(tool!.starting_price_usd ?? 0).toBeLessThanOrEqual(50);
      expect((["US", "UK"] as Marketplace[]).some((m) => tool!.marketplaces.includes(m))).toBe(true);
    }
  });

  it("defaults to keyword research + listing optimization when no goals given", () => {
    const result = recommendStarterStack({
      seller_size: "large",
      budget: "high",
      goals: [],
      marketplaces: [],
    });
    expect(result.tool_ids.length).toBeGreaterThan(0);
  });
});

describe("selection storage", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        clear: () => {
          Object.keys(storage).forEach((key) => delete storage[key]);
        },
        length: 0,
        key: () => null,
      } as Storage,
      writable: true,
    });
  });

  it("roundtrips selection through localStorage", () => {
    const ids = ["hl10", "jungle-scout"];
    saveSelectionToStorage(ids);
    expect(loadSelectionFromStorage()).toEqual(ids);
  });

  it("returns empty array when nothing stored", () => {
    expect(loadSelectionFromStorage()).toEqual([]);
  });
});

describe("categories", () => {
  it("returns 8 categories in defined order", () => {
    expect(getAllCategories()).toHaveLength(8);
    expect(getAllCategories()[0]).toBe("Keyword Research");
    const registry = getCategoryRegistry();
    expect(registry).toHaveLength(8);
    for (const cat of registry) {
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(typeof cat.is_active).toBe("boolean");
    }
  });
});
