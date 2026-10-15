import { NextResponse } from "next/server";

import { requireAllowedUser } from "@/lib/require-user";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!baseUrl || !apiKey) return NextResponse.json({ detail: "Backend service connection is not configured." }, { status: 503 });
  const query = new URLSearchParams({ tenant_id: user.email });
  const response = await fetch(`${baseUrl}/api/v1/auth/amazon/start?${query}`, {
    headers: { "X-Platform-Key": apiKey, "X-Workspace-User": user.email }, cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });
  const destination = new URL(payload.authorization_url);
  if (destination.protocol !== "https:" || destination.hostname !== "sellercentral.amazon.com") {
    return NextResponse.json({ detail: "Amazon returned an unexpected authorization URL." }, { status: 502 });
  }
  return NextResponse.redirect(destination);
}