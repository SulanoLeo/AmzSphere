import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { forecastCreateSchema } from "@/lib/validation";

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

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const state: any = readMockState();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") || undefined;
  const type = searchParams.get("type") || undefined;

  let forecasts: any[] = (state.forecasts || [])
    .filter((f: any) => String(f.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    forecasts = forecasts.filter((f: any) => f.status === status);
  }
  if (type) {
    forecasts = forecasts.filter((f: any) => f.type === type);
  }

  forecasts = forecasts.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    forecasts: forecasts.map((f: any) => ({
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
    })),
    total: forecasts.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = forecastCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    name: data.name,
    type: data.type,
    horizon_days: Number(data.horizon_days),
    period_start: data.period_start,
    period_end: data.period_end,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.forecasts || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
