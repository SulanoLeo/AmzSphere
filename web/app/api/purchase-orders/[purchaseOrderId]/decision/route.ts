import { NextResponse } from "next/server";

import { requireAllowedUser, requireSameOrigin } from "@/lib/require-user";

type Context = { params: Promise<{ purchaseOrderId: string }> };

export async function POST(request: Request, { params }: Context) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;
  const { purchaseOrderId } = await params;
  const { action } = await request.json() as { action?: string };
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ detail: "Action must be approve or deny." }, { status: 422 });
  }
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!baseUrl || !apiKey || !user.email) return NextResponse.json({ detail: "Backend service connection is not configured." }, { status: 503 });
  const response = await fetch(`${baseUrl}/api/v1/purchase-orders/${encodeURIComponent(purchaseOrderId)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Platform-Key": apiKey, "X-Workspace-User": user.email },
    body: JSON.stringify({ action, reviewer_id: user.email }),
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}