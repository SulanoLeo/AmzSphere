import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

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

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const acknowledgedBy = body.acknowledged_by || "mock@amzsphere.local";
  const state: any = readMockState();
  const a = (state.alerts || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!a) {
    return NextResponse.json({ detail: `Alert not found: ${id}` }, { status: 404 });
  }
  a.acknowledged = true;
  a.acknowledged_at = new Date().toISOString();
  a.acknowledged_by = acknowledgedBy;
  writeMockState(state);
  return NextResponse.json({
    id: a.id,
    seller_id: a.seller_id,
    type: a.type,
    severity: a.severity,
    title: a.title,
    message: a.message,
    acknowledged: true,
    acknowledged_at: a.acknowledged_at,
    acknowledged_by: a.acknowledged_by,
    related_type: a.related_type,
    related_id: a.related_id,
    created_at: a.created_at,
  });
}
