import { NextResponse } from "next/server";

import { requireAllowedUser, requireSameOrigin } from "@/lib/require-user";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = await request.json() as { seller_id?: string };
  const sellerId = body.seller_id;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!sellerId || !baseUrl || !apiKey) return NextResponse.json({ detail: "Seller/backend configuration is missing." }, { status: 503 });
  const response = await fetch(`${baseUrl}/api/v1/sellers/${encodeURIComponent(sellerId)}/sync`, {
    method: "POST",
    headers: { "X-Platform-Key": apiKey, "X-Workspace-User": user.email, "Idempotency-Key": crypto.randomUUID() },
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}