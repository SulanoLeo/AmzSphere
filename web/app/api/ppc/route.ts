import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json({
    campaigns: (state.campaigns || []).map((c: any) => ({
      id: c.id,
      name: c.name,
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
    })),
    search_terms: (state.search_terms || []).map((t: any) => ({
      term: t.term,
      clicks: Number(t.clicks),
      spend: Number(t.spend),
      conversions: Number(t.conversions),
      acos: Number(t.acos),
      sales: t.sales,
      impressions: t.impressions,
      order_value: t.order_value,
    })),
    targeted_exact_keywords: (state.targeted_exact_keywords || []).map((k: any) => ({
      term: k.term,
      added_at: k.added_at,
      source: k.source,
    })),
    negative_keywords: (state.negative_keywords || []).map((k: any) => ({
      term: k.term,
      added_at: k.added_at,
      source: k.source,
    })),
  });
}
