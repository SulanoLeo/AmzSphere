import { NextResponse } from "next/server";

import { requireAllowedUser } from "@/lib/require-user";

type Context = { params: Promise<{ purchaseOrderId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { purchaseOrderId } = await params;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!baseUrl || !apiKey) return NextResponse.json({ detail: "Backend service connection is not configured." }, { status: 503 });
  const response = await fetch(`${baseUrl}/api/v1/purchase-orders/${encodeURIComponent(purchaseOrderId)}/pdf`, {
    headers: { "X-Platform-Key": apiKey, "X-Workspace-User": user.email }, cache: "no-store",
  });
  if (!response.ok) return NextResponse.json(await response.json(), { status: response.status });
  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": response.headers.get("Content-Disposition") || "attachment; filename=purchase-order.pdf",
      "Cache-Control": "private, no-store",
    },
  });
}