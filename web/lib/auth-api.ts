import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getConfig, isSpApiEnabled } from "./config";

export interface AuthResult {
  email: string;
  isApprover: boolean;
  workspaceUser: string;
}

export interface AuthErrorResponse {
  response: ReturnType<typeof NextResponse.json>;
}

export function verifyPlatformKey(xPlatformKey: string | undefined | null): void {
  const config = getConfig();
  const configured = config.PLATFORM_API_KEY;
  if (!configured) {
    throw new Error("PLATFORM_API_KEY is not configured");
  }
  if (!xPlatformKey || !timingSafeEqual(Buffer.from(xPlatformKey), Buffer.from(configured))) {
    throw new Error("Unauthorized");
  }
}

export function requireWorkspaceUser(xWorkspaceUser: string | undefined | null): string {
  const user = (xWorkspaceUser || "").trim().toLowerCase();
  if (!user || user.length > 254 || user.includes("\n") || user.includes("\r")) {
    throw new Error("Authenticated workspace user required");
  }
  return user;
}

export function assertSellerTenant(seller: { tenant_id: string } | null, workspaceUser: string): { tenant_id: string } {
  if (!seller || seller.tenant_id.trim().toLowerCase() !== workspaceUser) {
    throw new Error("Seller not found");
  }
  return seller;
}

export function verifyAdminSecret(xAdminSecret: string | undefined | null): void {
  const config = getConfig();
  const configured = config.ADMIN_WEBHOOK_SECRET;
  if (!configured) {
    throw new Error("ADMIN_WEBHOOK_SECRET is not configured");
  }
  if (!xAdminSecret || !timingSafeEqual(Buffer.from(xAdminSecret), Buffer.from(configured))) {
    throw new Error("Invalid admin webhook secret");
  }
}

export function verifyAmazonSignature(
  body: Buffer | string,
  signature: string | undefined | null,
  secret: string | undefined | null,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(typeof body === "string" ? Buffer.from(body) : body).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function jsonError(message: string, status: number): ReturnType<typeof NextResponse.json> {
  return NextResponse.json({ detail: message }, { status });
}

export function requireSpApiEnabled(): void {
  if (!isSpApiEnabled()) {
    throw new Error("SP-API integration is disabled");
  }
}

export function parseUuid(value: string, fieldName = "id"): string {
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return value.toLowerCase();
}
