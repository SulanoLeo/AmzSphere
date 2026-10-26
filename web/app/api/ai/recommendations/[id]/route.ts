import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { aiRecommendationPatchSchema } from "@/lib/validation";

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

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state: any = readMockState();
  const r = (state.ai_recommendations || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!r) {
    return NextResponse.json({ detail: `AI recommendation not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
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
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = aiRecommendationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const r = (state.ai_recommendations || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!r) {
    return NextResponse.json({ detail: `AI recommendation not found: ${id}` }, { status: 404 });
  }
  Object.assign(r, parsed.data);
  r.seller_id = sellerId;
  r.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
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
  });
}
