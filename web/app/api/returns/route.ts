import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState, auditLogEntry } from "@/lib/mock-state";
import { returnRequestUpdateSchema } from "@/lib/validation";

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

  const status = searchParams.get("status") || undefined;
  let returns: any[] = (state.return_requests || [])
    .filter((rr: any) => String(rr.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    returns = returns.filter((rr: any) => rr.status === status);
  }

  returns = returns.sort((a: any, b: any) => String(b.requested_at).localeCompare(String(a.requested_at)));

  return NextResponse.json({
    return_requests: returns.map((rr: any) => ({
      id: rr.id,
      seller_id: rr.seller_id,
      order_id: rr.order_id,
      asin: rr.asin,
      sku: rr.sku,
      customer_name: rr.customer_name,
      reason: rr.reason,
      status: rr.status,
      requested_at: rr.requested_at,
      resolved_at: rr.resolved_at,
      refund_amount: Number(rr.refund_amount),
      units: Number(rr.units),
    })),
    total: returns.length,
  });
}

export async function PATCH(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = returnRequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state = readMockState();
  const { id } = body as { id?: string };
  if (!id) {
    return NextResponse.json({ detail: "id is required." }, { status: 422 });
  }
  const rr = (state.return_requests || []).find((x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId);
  if (!rr) {
    return NextResponse.json({ detail: `Return request not found: ${id}` }, { status: 404 });
  }
  rr.status = data.status;
  if (data.refund_amount !== undefined) rr.refund_amount = Number(data.refund_amount);
  if (data.units !== undefined) rr.units = Number(data.units);
  rr.resolved_at = new Date().toISOString();
  auditLogEntry(state, sellerId, "return_request_update", "return_request", id, {}, { status: rr.status, refund_amount: rr.refund_amount });
  writeMockState(state);
  return NextResponse.json({
    id: rr.id,
    seller_id: rr.seller_id,
    order_id: rr.order_id,
    asin: rr.asin,
    sku: rr.sku,
    customer_name: rr.customer_name,
    reason: rr.reason,
    status: rr.status,
    requested_at: rr.requested_at,
    resolved_at: rr.resolved_at,
    refund_amount: Number(rr.refund_amount),
    units: Number(rr.units),
  });
}
