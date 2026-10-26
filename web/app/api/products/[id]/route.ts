import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";
import { productPatchSchema, sellerIdSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const DEFAULT_SELLER_ID = "mock-seller";

export const dynamic = "force-dynamic";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state = readMockState();
  const product: any = (state.products || []).find((p: any) => (p.id === id || p.asin === id) && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${id}` }, { status: 404 });
  }
  const body = (await request.json()) as Record<string, any>;
  const parsed = productPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  Object.assign(product, parsed.data);
  product.seller_id = sellerId;
  const optResult = computeOptScore(product);
  product.opt_score = optResult.score;
  product.opt_issues = optResult.issues;
  product.opt_status = optResult.status;
  product.last_optimized_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json(product);
}
