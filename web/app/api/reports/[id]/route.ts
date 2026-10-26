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
  const r = (state.reports || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!r) {
    return NextResponse.json({ detail: `Report not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
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
  });
}
