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
  const scenarios = (state.forecast_scenarios || [])
    .filter((s: any) => String(s.forecast_id) === id)
    .map((s: any) => ({
      id: s.id,
      forecast_id: s.forecast_id,
      name: s.name,
      growth_rate_pct: Number(s.growth_rate_pct),
      description: s.description,
    }));
  return NextResponse.json({ forecast_scenarios: scenarios, total: scenarios.length });
}
