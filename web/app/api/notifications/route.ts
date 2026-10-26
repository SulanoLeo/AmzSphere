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

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const state: any = readMockState();
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type") || undefined;
  const read = searchParams.get("read");

  let notifications: any[] = (state.notifications || [])
    .filter((n: any) => String(n.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (type) {
    notifications = notifications.filter((n: any) => n.type === type);
  }
  if (read !== null) {
    const isRead = read === "true";
    notifications = notifications.filter((n: any) => Boolean(n.read) === isRead);
  }

  notifications = notifications.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    notifications: notifications.map((n: any) => ({
      id: n.id,
      seller_id: n.seller_id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      related_type: n.related_type,
      related_id: n.related_id,
      created_at: n.created_at,
    })),
    total: notifications.length,
  });
}
