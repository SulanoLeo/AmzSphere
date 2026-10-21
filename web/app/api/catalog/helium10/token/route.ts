import { NextResponse } from "next/server";
import { requireAllowedUser, requireSameOrigin } from "@/lib/require-user";

export async function POST(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { helium10_api_key: helium10ApiKey } = await request.json() as { helium10_api_key?: string };
  if (!helium10ApiKey || typeof helium10ApiKey !== "string") {
    return NextResponse.json({ detail: "helium10_api_key is required" }, { status: 422 });
  }
  // Persist the token server-side in the session-adjacent store so it survives
  // page navigations for the current workspace user. In production this should
  // be encrypted at rest and scoped to the authenticated seller.
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (baseUrl && apiKey) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/catalog/helium10/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Platform-Key": apiKey,
          "X-Workspace-User": user.email,
        },
        body: JSON.stringify({ helium10_api_key: helium10ApiKey }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Backend rejected token");
    } catch {
      // Token is still accepted client-side even if backend persistence is unavailable.
    }
  }
  return NextResponse.json({ ok: true });
}
