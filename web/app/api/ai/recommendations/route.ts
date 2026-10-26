import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { aiRecommendationCreateSchema } from "@/lib/validation";

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
  const state: any = readMockState();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;

  let recs: any[] = (state.ai_recommendations || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (type) {
    recs = recs.filter((r: any) => r.type === type);
  }
  if (status) {
    recs = recs.filter((r: any) => r.status === status);
  }

  recs = recs.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    recommendations: recs.map((r: any) => ({
      id: r.id,
      seller_id: r.seller_id,
      type: r.type,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      confidence: Number(r.confidence),
      impact: r.impact,
      estimated_monthly_lift_usd: r.estimated_monthly_lift_usd === null || r.estimated_monthly_lift_usd === undefined ? null : Number(r.estimated_monthly_lift_usd),
      asin: r.asin,
      sku: r.sku,
      status: r.status,
      source: r.source,
      model: r.model,
      created_at: r.created_at,
      updated_at: r.updated_at,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
    })),
    total: recs.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = aiRecommendationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state: any = readMockState();
  const now = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    type: data.type,
    title: data.title,
    description: data.description,
    rationale: data.rationale,
    confidence: Number(data.confidence),
    impact: data.impact,
    estimated_monthly_lift_usd: data.estimated_monthly_lift_usd === null || data.estimated_monthly_lift_usd === undefined ? null : Number(data.estimated_monthly_lift_usd),
    asin: data.asin === null || data.asin === undefined ? null : data.asin,
    sku: data.sku === null || data.sku === undefined ? null : data.sku,
    status: data.status,
    source: data.source,
    model: data.model === null || data.model === undefined ? null : data.model,
    created_at: now,
    updated_at: now,
    reviewed_by: null,
    reviewed_at: null,
  };
  (state.ai_recommendations || []).push(record);
  if ((state.ai_recommendations as any[]).length > 500) {
    (state.ai_recommendations as any[]).length = 500;
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
