import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const context = body.context || {};

  // Honest simulation: no real LLM provider is configured. Recommendations are
  // derived deterministically from current mock state and clearly labeled as
  // "simulated". Real LLM integration requires provider credentials and a
  // server-side AI integration (not part of the current mock stack).
  const state: any = readMockState();
  const now = new Date().toISOString();

  const provider = (globalThis as any).__mockProvider;
  let recommendations: any[] = [];
  if (provider && typeof provider.generateAIRecommendations === "function") {
    recommendations = await provider.generateAIRecommendations(context);
  } else {
    // Fallback: build recommendations directly from state.
    const now2 = new Date().toISOString();
    for (const p of (state.products || []).filter((x: any) => String(x.seller_id || DEFAULT_SELLER_ID) === sellerId)) {
      const price = Number(p.price) || 0;
      const compPrice = Number(p.competitor_price) || 0;
      const floor = Number(p.min_floor) || 0;
      if (compPrice > 0 && price > compPrice && price > floor + 2) {
        recommendations.push({
          id: crypto.randomUUID(),
          seller_id: sellerId,
          type: "pricing",
          title: `Reprice ${p.asin} toward competitor`,
          description: `Your price ($${price.toFixed(2)}) is above the competitor ($${compPrice.toFixed(2)}).`,
          rationale: `Price gap of $${(price - compPrice).toFixed(2)} vs competitor.`,
          confidence: 0.75,
          impact: price > compPrice + 5 ? "high" : "medium",
          estimated_monthly_lift_usd: Math.round((price - compPrice) * Number(p.daily_velocity || 1) * 30 * 100) / 100,
          asin: p.asin,
          sku: p.sku,
          status: "new",
          source: "simulated",
          model: "rule-based-pricing-v1",
          created_at: now2,
          updated_at: now2,
          reviewed_by: null,
          reviewed_at: null,
        });
      }
    }
    for (const p of (state.products || []).filter((x: any) => String(x.seller_id || DEFAULT_SELLER_ID) === sellerId)) {
      const stock = Number(p.stock) || 0;
      const velocity = Number(p.daily_velocity) || 0;
      const daysSupply = velocity > 0 ? stock / velocity : 999;
      if (daysSupply < 15 && stock > 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          seller_id: sellerId,
          type: "inventory",
          title: `Restock ${p.asin} (${daysSupply.toFixed(1)} days of supply)`,
          description: `Only ${daysSupply.toFixed(1)} days of supply remain.`,
          rationale: `Days of supply below 15 threshold with ${velocity.toFixed(1)} daily velocity.`,
          confidence: 0.85,
          impact: daysSupply < 7 ? "high" : "medium",
          estimated_monthly_lift_usd: Math.round((15 - daysSupply) * velocity * Number(p.price || 0) * 100) / 100,
          asin: p.asin,
          sku: p.sku,
          status: "new",
          source: "simulated",
          model: "rule-based-inventory-v1",
          created_at: now2,
          updated_at: now2,
          reviewed_by: null,
          reviewed_at: null,
        });
      }
    }
  }

  // Deduplicate and persist
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const r of recommendations) {
    const key = `${r.type}|${r.asin || "none"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  (state.ai_recommendations || []).unshift(...deduped);
  if ((state.ai_recommendations as any[]).length > 500) {
    (state.ai_recommendations as any[]).length = 500;
  }
  writeMockState(state);

  return NextResponse.json({
    recommendations: deduped,
    total: deduped.length,
    source: "simulated",
    note: "No real LLM provider configured. Recommendations are rule-based and derived from current mock state.",
  });
}
