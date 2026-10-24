import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  const rows = await query(
    `SELECT id, merchant_id, marketplace_id, region FROM sellers WHERE tenant_id = $1 ORDER BY created_at`,
    [workspaceUser]
  );

  return NextResponse.json(
    rows.map((row: any) => ({
      id: row.id,
      merchant_id: row.merchant_id,
      marketplace_id: row.marketplace_id,
      region: row.region,
    }))
  );
}
