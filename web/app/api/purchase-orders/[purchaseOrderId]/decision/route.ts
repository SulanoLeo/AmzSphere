import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { purchaseOrderDecisionSchema, sellerIdSchema } from "@/lib/validation";

type Context = { params: Promise<{ purchaseOrderId: string }> };

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { purchaseOrderId } = await params;
  const body = (await request.json()) as { action?: string };
  const parsed = purchaseOrderDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const { action } = parsed.data;
  const state = readMockState();
  const order = (state.orders || []).find(
    (o: any) => o.id === purchaseOrderId && String(o.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!order) {
    return NextResponse.json({ detail: "Order not found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ detail: "This workflow has already been reviewed" }, { status: 409 });
  }
  order.status = action === "approve" ? "approved" : "denied";
  order.reviewed_by = user.email;
  order.reviewed_at = new Date().toISOString();

  const activity = state.activity || [];
  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: order.reviewed_at,
    category: "procurement",
    title: `Purchase workflow ${order.status}`,
    detail: `${purchaseOrderId} for ${order.product_name} was ${order.status} by ${order.reviewed_by}.`,
  });
  if (activity.length > 120) activity.length = 120;

  writeMockState(state);

  return NextResponse.json({ order, activity: activity[0] });
}
