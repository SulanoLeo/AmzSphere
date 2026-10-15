import { NextResponse } from "next/server";

import { requireAllowedUser } from "@/lib/require-user";

type Context = { params: Promise<{ operationId: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { operationId } = await params;
  const baseUrl = process.env.AMZSPHERE_BACKEND_URL;
  const apiKey = process.env.AMZSPHERE_PLATFORM_API_KEY;
  if (!baseUrl || !apiKey) return NextResponse.json({ detail: "Backend service connection is not configured." }, { status: 503 });
  const response = await fetch(`${baseUrl}/api/v1/operations/${encodeURIComponent(operationId)}`, {
    headers: { "X-Platform-Key": apiKey, "X-Workspace-User": user.email }, cache: "no-store",
  });
  return NextResponse.json(await response.json(), { status: response.status });
}