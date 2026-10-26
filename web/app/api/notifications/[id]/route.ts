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
  const n = (state.notifications || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!n) {
    return NextResponse.json({ detail: `Notification not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: n.id,
    seller_id: n.seller_id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: Boolean(n.read),
    related_type: n.related_type,
    related_id: n.related_id,
    created_at: n.created_at,
  });
}
