import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  const state = readMockState();
  const product: any = (state.products || []).find((p: any) => p.id === id || p.asin === id);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${id}` }, { status: 404 });
  }
  const patch = (await _request.json()) as Record<string, any>;
  Object.assign(product, patch);
  const optResult = computeOptScore(product);
  product.opt_score = optResult.score;
  product.opt_issues = optResult.issues;
  product.opt_status = optResult.status;
  product.last_optimized_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json(product);
}
