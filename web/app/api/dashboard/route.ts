import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = new URL(request.url).searchParams.get("seller_id");
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!sellerId || !baseUrl || !apiKey) {
    return NextResponse.json({ detail: "Select a connected seller account." }, { status: 400 });
  }
  const response = await fetch(`${baseUrl}/api/v1/dashboard?seller_id=${encodeURIComponent(sellerId)}`, {
    headers: { "X-Platform-Key": apiKey, "X-Workspace-User": user.email },
    cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}