import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { landedCostSchema } from "@/lib/validation";

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

type Context = { params: Promise<{ asin: string }> };

function productOf(state: any, asin: string, sellerId: string): any {
  return (state.products || []).find(
    (p: any) => p.asin === asin && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
}

function totalLandedCost(data: any): number {
  return (
    Number(data.unit_cost || 0) +
    Number(data.shipping_per_unit || 0) +
    Number(data.duty_per_unit || 0) +
    Number(data.freight_per_unit || 0) +
    Number(data.other_per_unit || 0)
  );
}

export async function GET(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { asin } = await params;
  const state = readMockState();
  const product = productOf(state, asin, sellerId);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${asin}` }, { status: 404 });
  }
  const lc = (state.landed_costs || []).find((x: any) => String(x.product_id) === product.id);
  if (!lc) {
    return NextResponse.json({ detail: `Landed cost not set for ASIN: ${asin}` }, { status: 404 });
  }
  return NextResponse.json({
    id: lc.id,
    product_id: lc.product_id,
    asin: lc.asin,
    unit_cost: Number(lc.unit_cost),
    shipping_per_unit: Number(lc.shipping_per_unit),
    duty_per_unit: Number(lc.duty_per_unit),
    freight_per_unit: Number(lc.freight_per_unit),
    other_per_unit: Number(lc.other_per_unit),
    total_landed_cost: Number(lc.total_landed_cost),
    currency: lc.currency,
    updated_by: lc.updated_by,
    updated_at: lc.updated_at,
  });
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { asin } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = landedCostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const product = productOf(state, asin, sellerId);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${asin}` }, { status: 404 });
  }
  const now = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    product_id: product.id,
    asin: product.asin,
    unit_cost: Number(data.unit_cost),
    shipping_per_unit: Number(data.shipping_per_unit),
    duty_per_unit: Number(data.duty_per_unit),
    freight_per_unit: Number(data.freight_per_unit),
    other_per_unit: Number(data.other_per_unit),
    total_landed_cost: totalLandedCost(data),
    currency: data.currency,
    updated_by: "mock@amzsphere.local",
    updated_at: now,
  };
  const existing = (state.landed_costs || []).find((x: any) => String(x.product_id) === product.id);
  if (existing) {
    Object.assign(existing, {
      unit_cost: record.unit_cost,
      shipping_per_unit: record.shipping_per_unit,
      duty_per_unit: record.duty_per_unit,
      freight_per_unit: record.freight_per_unit,
      other_per_unit: record.other_per_unit,
      total_landed_cost: record.total_landed_cost,
      currency: record.currency,
      updated_at: record.updated_at,
    });
  } else {
    (state.landed_costs || []).push(record);
    if ((state.landed_costs || []).length > 500) {
      (state.landed_costs as any[]).length = 500;
    }
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
