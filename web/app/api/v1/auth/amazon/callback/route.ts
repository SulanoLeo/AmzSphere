import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const spapiOauthCode = searchParams.get("spapi_oauth_code");
  const sellingPartnerId = searchParams.get("selling_partner_id");

  if (!state) {
    return jsonError("OAuth state is invalid, expired, or already used", 400);
  }

  const config = getConfig();
  if (!config.LWA_CLIENT_ID || !config.LWA_CLIENT_SECRET) {
    return jsonError("LWA application credentials are not configured", 503);
  }

  const rawState = await queryOne<{ value: string }>(
    `SELECT current_setting('myapp.oauth_state_$1', true) AS value`,
    [state]
  );
  if (!rawState?.value) {
    return jsonError("OAuth state is invalid, expired, or already used", 400);
  }

  const tokenResponse = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: spapiOauthCode || "",
      client_id: config.LWA_CLIENT_ID,
      client_secret: config.LWA_CLIENT_SECRET,
      redirect_uri: config.OAUTH_REDIRECT_URI || "http://localhost:3000/api/v1/auth/amazon/callback",
    }),
  });

  if (!tokenResponse.ok) {
    return jsonError("LWA token exchange failed", 502);
  }

  const credentials = await tokenResponse.json();
  const refreshToken = credentials.refresh_token;
  if (!refreshToken) {
    return jsonError("LWA authorization response did not include a refresh token", 502);
  }

  const callbackState = JSON.parse(rawState.value);
  const { createHmac } = require("crypto");
  const encryptedToken = Buffer.from(refreshToken).toString("base64");

  const seller = await queryOne<{ id: string }>(
    `SELECT id FROM sellers WHERE tenant_id = $1 AND merchant_id = $2 AND marketplace_id = $3`,
    [callbackState.tenant_id, sellingPartnerId, config.SP_API_MARKETPLACE_ID]
  );

  if (seller) {
    await query(
      `UPDATE sellers SET lwa_refresh_token_encrypted = $1, updated_at = NOW() WHERE id = $2`,
      [encryptedToken, seller.id]
    );
  } else {
    await query(
      `INSERT INTO sellers (tenant_id, merchant_id, marketplace_id, region, endpoint, lwa_refresh_token_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [callbackState.tenant_id, sellingPartnerId, config.SP_API_MARKETPLACE_ID, config.SP_API_AWS_REGION || "us-east-1", config.SP_API_ENDPOINT || "https://sellingpartnerapi-na.amazon.com", encryptedToken]
    );
  }

  const redirectUrl = `${config.WEB_APP_URL || "http://localhost:3000"}?amazon_connected=1`;
  return NextResponse.redirect(redirectUrl, 303);
}
