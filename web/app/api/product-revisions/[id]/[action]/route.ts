import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";
import { revisionActionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; action: string }> };

const DEFAULT_SELLER_ID = "mock-seller";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { id, action } = await params;
  const body = (await request.json()) as { action?: string };
  const parsed = revisionActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const actionVal = parsed.data.action;
  if (actionVal !== "approve" && actionVal !== "reject") {
    return NextResponse.json({ detail: "Action must be approve or reject." }, { status: 422 });
  }
  const sellerId = resolveSellerId(request);
  const state = readMockState();
  const revision: any = (state.product_revisions || []).find((r: any) => r.id === id);
  if (!revision) {
    return NextResponse.json({ detail: `Revision not found: ${id}` }, { status: 404 });
  }
  if (revision.status !== "pending_approval") {
    return NextResponse.json({ detail: "This revision has already been reviewed" }, { status: 409 });
  }
  const product: any = (state.products || []).find(
    (p: any) => (p.id === revision.product_id || p.asin === revision.asin) && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${revision.product_id}` }, { status: 404 });
  }
  const now = new Date().toISOString();
  if (actionVal === "approve") {
    revision.status = "approved";
    for (const [field, change] of Object.entries(revision.field_changes || {})) {
      product[field] = (change as any).after;
    }
    const optResult = computeOptScore(product);
    product.opt_score = optResult.score;
    product.opt_issues = optResult.issues;
    product.opt_status = optResult.status;
    product.last_optimized_at = now as any;
  } else {
    revision.status = "rejected";
    product.opt_status = "needs_optimization";
  }
  writeMockState(state);
  return NextResponse.json({ revision, product });
}

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}
