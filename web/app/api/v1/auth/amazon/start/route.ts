import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenant_id");

  if (!tenantId) {
    return jsonError("tenant_id is required", 400);
  }

  if (tenantId.trim().toLowerCase() !== workspaceUser) {
    return jsonError("OAuth tenant must match the authenticated user", 403);
  }

  const { getConfig } = require("@/lib/config");
  const config = getConfig();
  if (!config.SP_API_APPLICATION_ID) {
    return jsonError("SP_API_APPLICATION_ID is not configured", 503);
  }

  const state = require("crypto").randomBytes(32).toString("base64url");
  const value = JSON.stringify({ tenant_id: tenantId, issued_at: new Date().toISOString() });

  await query(
    `SET LOCAL myapp.oauth_state_$1 = $2`,
    [state, value]
  );

  const consentParams: Record<string, string> = {
    application_id: config.SP_API_APPLICATION_ID,
    state,
  };
  if (config.SP_API_LISTINGS_API_VERSION) {
    consentParams.version = "2021-08-01";
  }

  const consentUrl = `https://sellercentral.amazon.com/apps/authorize/consent?${new URLSearchParams(consentParams)}`;

  return NextResponse.json({
    authorization_url: consentUrl,
    expires_in: config.OAUTH_STATE_TTL_SECONDS,
  });
}
