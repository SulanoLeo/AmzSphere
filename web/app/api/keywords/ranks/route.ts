import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { keywordRankSchema } from "@/lib/validation";

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

  const keywordId = searchParams.get("keyword_id") || undefined;
  const asin = searchParams.get("asin") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("page_size") || "50", 10) || 50));

  let ranks: any[] = (state.keyword_rank_history || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .filter((r: any) => {
      if (keywordId && String(r.keyword_id) !== keywordId) return false;
      if (asin && String(r.asin) !== asin) return false;
      return true;
    })
    .sort((a: any, b: any) => String(b.rank_date).localeCompare(String(a.rank_date)));

  const total = ranks.length;
  const pageData = ranks.slice((page - 1) * pageSize, page * pageSize).map((r: any) => ({
    id: r.id,
    seller_id: r.seller_id,
    keyword_id: r.keyword_id,
    asin: r.asin,
    marketplace_id: r.marketplace_id,
    rank: Number(r.rank),
    rank_date: r.rank_date,
    created_at: r.created_at,
  }));

  return NextResponse.json({
    ranks: pageData,
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
  const parsed = keywordRankSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { keyword_id, asin, rank } = parsed.data;

  const state = readMockState();
  const keyword = (state.keywords || []).find(
    (k: any) => k.id === keyword_id && String(k.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!keyword) {
    return NextResponse.json({ detail: `Keyword not found: ${keyword_id}` }, { status: 404 });
  }

  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    keyword_id,
    asin,
    marketplace_id: keyword.marketplace_id,
    rank: Number(rank),
    rank_date: new Date().toISOString().split("T")[0],
    created_at: new Date().toISOString(),
  };
  (state.keyword_rank_history || []).unshift(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
