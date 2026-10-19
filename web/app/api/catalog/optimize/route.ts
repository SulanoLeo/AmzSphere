import { NextResponse } from "next/server";
import { requireAllowedUser, requireSameOrigin } from "@/lib/require-user";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  const { asin, seller_id: sellerId, sku } = await request.json() as { asin?: string; seller_id?: string; sku?: string };
  if (!sellerId || !baseUrl || !apiKey) {
    return NextResponse.json({ detail: "Configure the backend service connection." }, { status: 503 });
  }
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return NextResponse.json({ detail: "Provide a valid 10-character ASIN." }, { status: 422 });
  }
  const response = await fetch(`${baseUrl}/api/v1/catalog/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Platform-Key": apiKey,
      "X-Workspace-User": user.email,
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ seller_id: sellerId, asin, sku }),
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}