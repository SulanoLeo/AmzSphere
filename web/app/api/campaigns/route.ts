import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.campaigns || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      asin: c.asin,
      sku: c.sku,
      base_acos: Number(c.base_acos),
      ad_share: Number(c.ad_share),
      avg_cpc: Number(c.avg_cpc),
      bid_floor: Number(c.bid_floor),
      acos_modifier: Number(c.acos_modifier || 1),
      bid_changes: c.bid_changes || [],
      ad_history: c.ad_history || [],
      trailing_acos: c.trailing_acos,
      last_guardrail_date: c.last_guardrail_date,
    }))
  );
}
