import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

type Context = { params: Promise<{ purchaseOrderId: string }> };

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;
  const { purchaseOrderId } = await params;
  const { action } = (await request.json()) as { action?: string };
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ detail: "Action must be approve or deny." }, { status: 422 });
  }

  const state = readMockState();
  const order = (state.orders || []).find((o: any) => o.id === purchaseOrderId);
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
