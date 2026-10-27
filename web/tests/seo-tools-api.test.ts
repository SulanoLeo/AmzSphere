import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/require-user", () => ({
  requireAllowedUser: vi.fn(async () => ({ email: "mock@amzsphere.local", isApprover: true })),
}));

import { requireAllowedUser } from "@/lib/require-user";
import { SEED_TOOLS, SEO_CATEGORIES, type SeoTool } from "@/lib/seo-tools";
import { GET as listTools, POST as createTool } from "@/app/api/seo-tools/route";
import { GET as getTool, PATCH as patchTool, DELETE as deleteTool } from "@/app/api/seo-tools/[id]/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/seo-tools/categories/route";
import { PATCH as patchCategory, DELETE as deleteCategory } from "@/app/api/seo-tools/categories/[id]/route";
import { GET as getSelection, POST as saveSelection } from "@/app/api/seo-tools/selection/route";

const originalTools = [...SEED_TOOLS];
const originalCategories = SEO_CATEGORIES.map((c) => ({ ...c }));

const mockRequest = (url: string, body?: unknown) =>
  ({
    url,
    json: async () => body,
  } as unknown as Request);

const withParams = (id: string) => ({ params: Promise.resolve({ id }) } as const);

beforeEach(() => {
  SEED_TOOLS.length = 0;
  SEED_TOOLS.push(...originalTools);
  SEO_CATEGORIES.length = 0;
  SEO_CATEGORIES.push(...originalCategories.map((c) => ({ ...c })));
  vi.mocked(requireAllowedUser).mockResolvedValue({ email: "mock@amzsphere.local", isApprover: true });
});

async function json<T>(response: Response | undefined | null): Promise<T> {
  if (!response) throw new Error("missing response");
  return (await response.json()) as T;
}

describe("GET /api/seo-tools", () => {
  it("returns a paginated page of tools", async () => {
    const res = (await listTools(mockRequest("http://localhost/api/seo-tools?page=1&page_size=5")))!;
    expect(res.status).toBe(200);
    const body = await json<{ tools: SeoTool[]; total: number; page: number; page_size: number; total_pages: number }>(res);
    expect(body.tools.length).toBe(5);
    expect(body.total).toBe(SEED_TOOLS.length);
    expect(body.page).toBe(1);
    expect(body.page_size).toBe(5);
    expect(body.total_pages).toBe(Math.ceil(SEED_TOOLS.length / 5));
  });

  it("filters by search and category", async () => {
    const res = (await listTools(mockRequest("http://localhost/api/seo-tools?search=helium")))!;
    const body = await json<{ tools: SeoTool[]; total: number }>(res);
    expect(body.total).toBe(1);
    expect(body.tools[0].name).toBe("Helium 10");

    const res2 = (await listTools(mockRequest("http://localhost/api/seo-tools?category=PPC/Advertising")))!;
    const body2 = await json<{ total: number }>(res2);
    expect(body2.total).toBe(1);
  });
});

describe("GET /api/seo-tools/[id]", () => {
  it("returns a single tool", async () => {
    const res = (await getTool(mockRequest("http://localhost/api/seo-tools/hl10"), withParams("hl10")))!;
    expect(res.status).toBe(200);
    const body = await json<SeoTool>(res);
    expect(body.id).toBe("hl10");
  });

  it("returns 404 for unknown tool", async () => {
    const res = (await getTool(mockRequest("http://localhost/api/seo-tools/nope"), withParams("nope")))!;
    expect(res.status).toBe(404);
  });
});

describe("POST /api/seo-tools", () => {
  it("creates a tool with validation", async () => {
    const res = (await createTool(
      mockRequest("http://localhost/api/seo-tools", {
        name: "New Tool",
        category: "Keyword Research",
        pricing_model: "freemium",
        starting_price_usd: 25,
        website_url: "https://example.com",
      }),
    ))!;
    expect(res.status).toBe(201);
    const body = await json<SeoTool>(res);
    expect(body.name).toBe("New Tool");
    expect(body.id).toMatch(/^tool-/);
    expect(SEED_TOOLS.length).toBe(originalTools.length + 1);
  });

  it("returns 422 when name or category is missing", async () => {
    const res = (await createTool(mockRequest("http://localhost/api/seo-tools", { category: "Keyword Research" })))!;
    expect(res.status).toBe(422);
  });

  it("rejects invalid website url", async () => {
    const res = (await createTool(
      mockRequest("http://localhost/api/seo-tools", { name: "X", category: "Keyword Research", website_url: "not-a-url" }),
    ))!;
    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/seo-tools/[id]", () => {
  it("updates a tool", async () => {
    const res = (await patchTool(
      mockRequest("http://localhost/api/seo-tools/hl10", { starting_price_usd: 99, is_active: false }),
      withParams("hl10"),
    ))!;
    expect(res.status).toBe(200);
    const body = await json<SeoTool>(res);
    expect(body.starting_price_usd).toBe(99);
    expect(body.is_active).toBe(false);
  });

  it("returns 422 on invalid patch body", async () => {
    const res = (await patchTool(mockRequest("http://localhost/api/seo-tools/hl10", { rating: 9 }), withParams("hl10")))!;
    expect(res.status).toBe(422);
  });

  it("returns 404 for unknown tool", async () => {
    const res = (await patchTool(mockRequest("http://localhost/api/seo-tools/nope", { name: "X" }), withParams("nope")))!;
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/seo-tools/[id]", () => {
  it("deletes a tool", async () => {
    const res = (await deleteTool(mockRequest("http://localhost/api/seo-tools/hl10"), withParams("hl10")))!;
    expect(res.status).toBe(200);
    const body = await json<{ deleted: boolean }>(res);
    expect(body.deleted).toBe(true);
    expect(SEED_TOOLS.some((t) => t.id === "hl10")).toBe(false);
  });

  it("returns 404 for unknown tool", async () => {
    const res = (await deleteTool(mockRequest("http://localhost/api/seo-tools/nope"), withParams("nope")))!;
    expect(res.status).toBe(404);
  });
});

describe("categories API", () => {
  it("lists all categories", async () => {
    const res = (await listCategories(mockRequest("http://localhost/api/seo-tools/categories")))!;
    const body = await json<{ id: string; label: string }[]>(res);
    expect(body.length).toBe(8);
  });

  it("returns 422 when adding a category missing id or label", async () => {
    const res = (await createCategory(mockRequest("http://localhost/api/seo-tools/categories", { label: "Dup" })))!;
    expect(res.status).toBe(422);
  });

  it("returns 409 when adding a category that already exists", async () => {
    const res = (await createCategory(
      mockRequest("http://localhost/api/seo-tools/categories", { id: "Keyword Research", label: "Dup" }),
    ))!;
    expect(res.status).toBe(409);
  });
});

describe("PATCH/DELETE /api/seo-tools/categories/[id]", () => {
  it("updates a category", async () => {
    const res = (await patchCategory(
      mockRequest("http://localhost/api/seo-tools/categories/Keyword Research", { label: "KW Research" }),
      withParams("Keyword Research"),
    ))!;
    expect(res.status).toBe(200);
    const body = await json<{ label: string }>(res);
    expect(body.label).toBe("KW Research");
  });

  it("refuses to delete a category in use", async () => {
    const res = (await deleteCategory(
      mockRequest("http://localhost/api/seo-tools/categories/Keyword Research"),
      withParams("Keyword Research"),
    ))!;
    expect(res.status).toBe(409);
  });
});

describe("selection API", () => {
  it("gets and saves per-user selection", async () => {
    const getRes = (await getSelection(mockRequest("http://localhost/api/seo-tools/selection"), {} as never))!;
    const getBody = await json<{ selected_tool_ids: string[] }>(getRes);
    expect(getBody.selected_tool_ids).toEqual([]);

    const saveRes = (await saveSelection(
      mockRequest("http://localhost/api/seo-tools/selection", { selected_tool_ids: ["hl10", "jungle-scout"] }),
      {} as never,
    ))!;
    expect(saveRes.status).toBe(200);
    const saveBody = await json<{ selected_tool_ids: string[]; count: number }>(saveRes);
    expect(saveBody.selected_tool_ids).toEqual(["hl10", "jungle-scout"]);
    expect(saveBody.count).toBe(2);

    const getRes2 = (await getSelection(mockRequest("http://localhost/api/seo-tools/selection"), {} as never))!;
    const getBody2 = await json<{ selected_tool_ids: string[] }>(getRes2);
    expect(getBody2.selected_tool_ids).toEqual(["hl10", "jungle-scout"]);
  });

  it("returns 422 on invalid selection body", async () => {
    const res = (await saveSelection(mockRequest("http://localhost/api/seo-tools/selection", { selected_tool_ids: "not-array" }), {} as never))!;
    expect(res.status).toBe(422);
  });
});
