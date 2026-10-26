import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    billing_plans: (state.billing_plans || []).map((p: any) => ({
      id: p.id,
      plan: p.plan,
      name: p.name,
      description: p.description,
      price_usd_cents: Number(p.price_usd_cents),
      currency: p.currency,
      interval: p.interval,
      max_sellers: Number(p.max_sellers),
      max_marketplaces: Number(p.max_marketplaces),
      features: p.features,
      is_active: Boolean(p.is_active),
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  });
}
