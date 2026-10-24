import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));
  const body = await request.json().catch(() => ({}));
  const token = body.helium10_api_key;

  if (!token || typeof token !== "string") {
    return jsonError("helium10_api_key is required", 422);
  }

  await query(
    `SET LOCAL myapp.helium10_token = $1 WHERE current_setting('myapp.helium10_token', true) IS DISTINCT FROM $2`,
    [token, token]
  );

  return NextResponse.json({ ok: true });
}
