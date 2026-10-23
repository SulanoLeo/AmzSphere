import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { MockSimulator } from "@/lib/simulator";

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as { seller_id?: string };
  const sellerId = body.seller_id;
  if (!sellerId) {
    return NextResponse.json({ detail: "Select a seller." }, { status: 400 });
  }

  const state = readMockState();
  const sim = new MockSimulator();
  sim.tick(state);

  const products: any[] = (state.products || []).map((p: any) => ({
    sku: p.sku,
    name: p.name || p.title,
    stock: Number(p.stock) || 0,
    daily_velocity: Number(p.daily_velocity) || 0,
    opt_score: p.opt_score,
    opt_status: p.opt_status,
    po_draft_id: p.po_draft_id || null,
  }));

  const lowStock = products.filter((p) => p.stock / Math.max(p.daily_velocity || 1, 1) < 15);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalVelocity = products.reduce((sum, p) => sum + p.daily_velocity, 0);

  writeMockState(state);

  return NextResponse.json({
    operation_id: crypto.randomUUID(),
    status: "completed",
    seller_id: sellerId,
    products_scanned: products.length,
    low_stock_count: lowStock.length,
    total_stock: totalStock,
    total_velocity: totalVelocity,
    products,
  });
}
