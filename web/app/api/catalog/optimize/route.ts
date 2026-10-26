import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { catalogOptimizeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as {
    asin?: string;
    seller_id?: string;
    sku?: string;
    optimization_mode?: "free" | "paid";
    helium10_api_key?: string;
  };
  const parsed = catalogOptimizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { asin, seller_id: sellerId, sku, optimization_mode: optimizationMode, helium10_api_key: helium10ApiKey } = parsed.data;
  if (!sellerId) {
    return NextResponse.json({ detail: "Select a seller." }, { status: 400 });
  }
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ detail: "Provide a valid 10-character ASIN." }, { status: 422 });
  }
  const state = readMockState();
  const operationId = `opt-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const payload: any = {
    id: operationId,
    action: "catalog_optimize",
    seller_id: sellerId,
    asin,
    sku: sku || undefined,
    optimization_mode: optimizationMode,
    helium10_api_key: helium10ApiKey || undefined,
    status: "review_required",
    created_at: now,
    completed_at: null,
    result_payload: null,
  };
  (state.execution_queue as any[]).unshift(payload);
  if ((state.execution_queue as any[]).length > 200) (state.execution_queue as any[]).length = 200;

  const activity = state.activity || [];
  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: now,
    category: "catalog",
    title: "Catalog optimization queued",
    detail: `Optimization for ${asin} (${optimizationMode} mode) queued for human review.`,
  });
  if (activity.length > 120) activity.length = 120;

  writeMockState(state);
  return NextResponse.json({
    operation_id: operationId,
    status: "review_required",
    asin,
    seller_id: sellerId,
    optimization_mode: optimizationMode,
    message: "Optimization queued for human review; it will not publish automatically.",
  });
}
