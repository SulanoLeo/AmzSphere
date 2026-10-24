import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import {
  SEED_TOOLS,
  type SeoTool,
  type SeoToolFilters,
  type SeoToolPage,
  filterAndSortTools,
} from "@/lib/seo-tools";

export const dynamic = "force-dynamic";

function parseFilters(searchParams: URLSearchParams): SeoToolFilters {
  const category = searchParams.get("category") || undefined;
  const pricing_model = searchParams.get("pricing_model") || undefined;
  const marketplace = searchParams.get("marketplace") || undefined;
  const min_rating = searchParams.get("min_rating");
  const min_price = searchParams.get("min_price");
  const max_price = searchParams.get("max_price");
  const page = searchParams.get("page");
  const page_size = searchParams.get("page_size");

  return {
    search: searchParams.get("search") || undefined,
    category: (category as SeoToolFilters["category"]) || null,
    pricing_model: (pricing_model as SeoToolFilters["pricing_model"]) || null,
    marketplace: (marketplace as SeoToolFilters["marketplace"]) || null,
    min_rating: min_rating ? Number(min_rating) : null,
    min_price: min_price ? Number(min_price) : null,
    max_price: max_price ? Number(max_price) : null,
    sort: (searchParams.get("sort") as SeoToolFilters["sort"]) || "relevance",
    page: page ? Math.max(1, parseInt(page, 10)) : 1,
    page_size: page_size ? Math.max(1, Math.min(100, parseInt(page_size, 10))) : 12,
  };
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const { searchParams } = new URL(request.url);
  const filters = parseFilters(searchParams);
  const { tools, total } = filterAndSortTools([...SEED_TOOLS], filters);
  const page = filters.page ?? 1;
  const pageSize = filters.page_size ?? 12;

  const pageData: SeoToolPage = {
    tools,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  };

  return NextResponse.json(pageData);
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const body = (await request.json()) as Partial<SeoTool>;
  if (!body.name || !body.category) {
    return NextResponse.json({ detail: "name and category are required" }, { status: 422 });
  }
  const now = new Date().toISOString();
  const tool: SeoTool = {
    id: `tool-${crypto.randomUUID()}`,
    name: body.name,
    logo: body.logo ?? "https://placehold.co/64x64?text=?",
    short_description: body.short_description ?? "",
    category: body.category,
    pricing_model: body.pricing_model ?? "freemium",
    starting_price_usd: body.starting_price_usd ?? null,
    features: body.features ?? [],
    marketplaces: body.marketplaces ?? [],
    rating: body.rating ?? null,
    website_url: body.website_url ?? "",
    is_active: Boolean(body.is_active ?? true),
    created_at: now,
    updated_at: now,
  };
  (SEED_TOOLS as SeoTool[]).push(tool);
  return NextResponse.json(tool, { status: 201 });
}
