import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export type RemediationResolutionType =
  | "price_correction"
  | "catalog_rewrite"
  | "text_correction"
  | "manual_review";

export interface RemediateRequest {
  event_id: string;
  action: "approve";
  resolution_type: RemediationResolutionType;
  proposed_price?: number;
  proposed_bullets?: string[];
  proposed_title?: string;
  notes?: string;
}

export interface RemediateResponse {
  accepted: boolean;
  remediation_id: string;
  status: string;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as RemediateRequest;
  if (!body.event_id) {
    return NextResponse.json({ detail: "event_id is required" }, { status: 422 });
  }
  const state = readMockState();
  const activity = state.activity || [];
  const now = new Date().toISOString();
  const remediationId = `rem-${crypto.randomUUID()}`;
  activity.unshift({
    id: remediationId,
    timestamp: now,
    category: "listing_health",
    title: `Listing remediation ${body.action}d`,
    detail: `Event ${body.event_id} resolved via ${body.resolution_type || body.action} by ${user.email}.${body.notes ? ` Notes: ${body.notes}` : ""}`,
  });
  if (activity.length > 120) activity.length = 120;
  writeMockState(state);

  const response: RemediateResponse = {
    accepted: true,
    remediation_id: remediationId,
    status: "approved",
  };
  return NextResponse.json(response);
}
