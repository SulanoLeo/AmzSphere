import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { keywordCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const state = readMockState();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || undefined;
  const search = (searchParams.get("search") || "").toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("page_size") || "50", 10) || 50));

  let keywords: any[] = (state.keywords || [])
    .filter((k: any) => String(k.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (category) {
    keywords = keywords.filter((k: any) => k.category === category);
  }
  if (search) {
    keywords = keywords.filter((k: any) => String(k.keyword).toLowerCase().includes(search));
  }

  keywords = keywords.sort((a: any, b: any) => Number(b.search_volume || 0) - Number(a.search_volume || 0));

  const total = keywords.length;
  const pageData = keywords.slice((page - 1) * pageSize, page * pageSize).map((k: any) => ({
    id: k.id,
    seller_id: k.seller_id,
    keyword: k.keyword,
    marketplace_id: k.marketplace_id,
    search_volume: Number(k.search_volume),
    difficulty: Number(k.difficulty),
    cpc: Number(k.cpc),
    category: k.category,
    created_at: k.created_at,
    updated_at: k.updated_at,
  }));

  return NextResponse.json({
    keywords: pageData,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = keywordCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    keyword: data.keyword,
    marketplace_id: data.marketplace_id,
    search_volume: Number(data.search_volume),
    difficulty: Number(data.difficulty),
    cpc: Number(data.cpc),
    category: data.category ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.keywords || []).unshift(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
