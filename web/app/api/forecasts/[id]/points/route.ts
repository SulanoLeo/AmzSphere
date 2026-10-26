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
  const forecast = (state.forecasts || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!forecast) {
    return NextResponse.json({ detail: `Forecast not found: ${id}` }, { status: 404 });
  }
  const points = (state.forecast_points || [])
    .filter((p: any) => String(p.forecast_id) === id)
    .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
    .map((p: any) => ({
      id: p.id,
      forecast_id: p.forecast_id,
      date: p.date,
      value: Number(p.value),
      lower_bound: p.lower_bound === null || p.lower_bound === undefined ? null : Number(p.lower_bound),
      upper_bound: p.upper_bound === null || p.upper_bound === undefined ? null : Number(p.upper_bound),
    }));
  return NextResponse.json({ forecast_points: points, total: points.length });
}
