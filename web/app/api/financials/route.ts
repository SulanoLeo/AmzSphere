import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState, auditLogEntry } from "@/lib/mock-state";
import { financialRecordsSchema } from "@/lib/validation";

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
  const state = readMockState();
  const { searchParams } = new URL(request.url);

  const periodStart = searchParams.get("period_start") || undefined;
  const periodEnd = searchParams.get("period_end") || undefined;

  const records: any[] = (state.financial_records || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .filter((r: any) => {
      if (periodStart && r.period_start < periodStart) return false;
      if (periodEnd && r.period_end > periodEnd) return false;
      return true;
    })
    .map((r: any) => ({
      id: r.id,
      seller_id: r.seller_id,
      period_start: r.period_start,
      period_end: r.period_end,
      revenue: Number(r.revenue),
      cogs: Number(r.cogs),
      fees: Number(r.fees),
      net_profit: Number(r.net_profit),
      units_sold: Number(r.units_sold),
      orders_count: Number(r.orders_count),
      created_at: r.created_at,
    }));

  const totals = records.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cogs: acc.cogs + r.cogs,
      fees: acc.fees + r.fees,
      net_profit: acc.net_profit + r.net_profit,
      units_sold: acc.units_sold + r.units_sold,
      orders_count: acc.orders_count + r.orders_count,
    }),
    { revenue: 0, cogs: 0, fees: 0, net_profit: 0, units_sold: 0, orders_count: 0 },
  );

  const marginPct = totals.revenue > 0 ? Math.round((totals.net_profit / totals.revenue) * 100) : 0;

  return NextResponse.json({
    seller_id: sellerId,
    period_start: periodStart || null,
    period_end: periodEnd || null,
    records,
    totals: {
      ...totals,
      margin_pct: marginPct,
    },
    count: records.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = financialRecordsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;

  const state = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    period_start: data.period_start,
    period_end: data.period_end,
    revenue: Number(data.revenue),
    cogs: Number(data.cogs),
    fees: Number(data.fees),
    net_profit: Number(data.net_profit),
    units_sold: Number(data.units_sold),
    orders_count: Number(data.orders_count),
    created_at: new Date().toISOString(),
  };
  (state.financial_records || []).push(record);
  auditLogEntry(state, sellerId, "financial_record_create", "financial_record", record.id, {}, record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
