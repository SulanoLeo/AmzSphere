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
  const e = (state.exports || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!e) {
    return NextResponse.json({ detail: `Export not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: e.id,
    seller_id: e.seller_id,
    report_id: e.report_id,
    format: e.format,
    status: e.status,
    created_at: e.created_at,
    completed_at: e.completed_at,
    download_url: e.download_url,
    record_count: Number(e.record_count),
    error: e.error,
  });
}
