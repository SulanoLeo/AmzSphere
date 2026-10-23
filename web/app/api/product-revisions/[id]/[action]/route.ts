import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";

type Context = { params: Promise<{ id: string; action: string }> };

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { id, action } = await params;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ detail: "Action must be approve or reject." }, { status: 422 });
  }
  const state = readMockState();
  const revision: any = (state.product_revisions || []).find((r: any) => r.id === id);
  if (!revision) {
    return NextResponse.json({ detail: `Revision not found: ${id}` }, { status: 404 });
  }
  if (revision.status !== "pending_approval") {
    return NextResponse.json({ detail: "This revision has already been reviewed" }, { status: 409 });
  }
  const product: any = (state.products || []).find((p: any) => p.id === revision.product_id || p.asin === revision.asin);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${revision.product_id}` }, { status: 404 });
  }
  const now = new Date().toISOString();
  if (action === "approve") {
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
