import { NextResponse } from "next/server";
import { requireAllowedUser, requireSameOrigin } from "@/lib/require-user";

export async function GET(request: Request) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ connected: false }, { status: 503 });
  }
  try {
    const response = await fetch(`${baseUrl}/api/v1/catalog/helium10/status`, {
      headers: {
        "X-Platform-Key": apiKey,
        "X-Workspace-User": user.email,
      },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ connected: false }, { status: response.status });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ connected: false });
  }
}
