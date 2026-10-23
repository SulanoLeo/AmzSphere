import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.search_terms || []).map((t: any) => ({
      term: t.term,
      asin: t.asin,
      campaign_id: t.campaign_id,
      clicks: Number(t.clicks),
      spend: Number(t.spend),
      conversions: Number(t.conversions),
      acos: Number(t.acos),
      sales: t.sales,
      impressions: t.impressions,
      order_value: t.order_value,
    }))
  );
}
