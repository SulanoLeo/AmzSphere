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
  const severity = searchParams.get("severity") || undefined;
  const acknowledged = searchParams.get("acknowledged");

  let alerts: any[] = (state.alerts || [])
    .filter((a: any) => String(a.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (type) {
    alerts = alerts.filter((a: any) => a.type === type);
  }
  if (severity) {
    alerts = alerts.filter((a: any) => a.severity === severity);
  }
  if (acknowledged !== null) {
    const ack = acknowledged === "true";
    alerts = alerts.filter((a: any) => Boolean(a.acknowledged) === ack);
  }

  alerts = alerts.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    alerts: alerts.map((a: any) => ({
      id: a.id,
      seller_id: a.seller_id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      acknowledged: Boolean(a.acknowledged),
      acknowledged_at: a.acknowledged_at,
      acknowledged_by: a.acknowledged_by,
      related_type: a.related_type,
      related_id: a.related_id,
      created_at: a.created_at,
    })),
    total: alerts.length,
  });
}
