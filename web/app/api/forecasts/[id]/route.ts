import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

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
  const f = (state.forecasts || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!f) {
    return NextResponse.json({ detail: `Forecast not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: f.id,
    seller_id: f.seller_id,
    name: f.name,
    type: f.type,
    horizon_days: Number(f.horizon_days),
    period_start: f.period_start,
    period_end: f.period_end,
    status: f.status,
    created_at: f.created_at,
    updated_at: f.updated_at,
  });
}
