import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { reportCreateSchema } from "@/lib/validation";

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

  let reports: any[] = (state.reports || [])
    .filter((r: any) => String(r.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    reports = reports.filter((r: any) => r.status === status);
  }
  if (type) {
    reports = reports.filter((r: any) => r.type === type);
  }

  reports = reports.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    reports: reports.map((r: any) => ({
      id: r.id,
      seller_id: r.seller_id,
      name: r.name,
      type: r.type,
      period_start: r.period_start,
      period_end: r.period_end,
      status: r.status,
      created_at: r.created_at,
      completed_at: r.completed_at,
      download_url: r.download_url,
      record_count: Number(r.record_count),
      error: r.error,
    })),
    total: reports.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = reportCreateSchema.safeParse(body);
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
    period_start: data.period_start,
    period_end: data.period_end,
    status: "queued",
    created_at: new Date().toISOString(),
    completed_at: null,
    download_url: null,
    record_count: 0,
    error: null,
  };
  (state.reports || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
