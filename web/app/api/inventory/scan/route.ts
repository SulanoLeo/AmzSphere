import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { MockSimulator } from "@/lib/simulator";
import { inventoryScanSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function daysOfSupply(stock: number, velocity: number): number {
  return stock / Math.max(velocity || 0.1, 0.1);
}

function restockQty(daysSupply: number, velocity: number, leadTime: number, minOrderQty: number): number {
  const coverageTargetDays = 45;
  const neededDays = Math.max(coverageTargetDays - daysSupply, leadTime);
  const qty = Math.ceil(neededDays * Math.max(velocity || 0.1, 0.1));
  return Math.max(qty, minOrderQty);
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as { seller_id?: string };
  const parsed = inventoryScanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const sellerId = parsed.data.seller_id;

  const state = readMockState();
  const sim = new MockSimulator();
  sim.tick(state);

  const DEFAULT_SELLER_ID = "mock-seller";
  const productsRaw = (state.products || []).filter(
    (p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  const suppliersById: Record<string, any> = {};
  for (const s of state.suppliers || []) {
    suppliersById[s.id] = s;
  }
  const landedByProductId: Record<string, any> = {};
  for (const lc of state.landed_costs || []) {
    landedByProductId[lc.product_id] = lc;
  }

  const products: any[] = productsRaw.map((p: any) => {
    const stock = Number(p.stock) || 0;
    const velocity = Number(p.daily_velocity) || 0;
    const daysSupply = daysOfSupply(stock, velocity);
    const reorderFlag = daysSupply < 15;
    const supplierId = p.supplier_id || null;
    const supplier = supplierId ? suppliersById[supplierId] : null;
    const leadTime = supplier ? Number(supplier.lead_time_days) : Number(p.lead_time_days) || 21;
    const minOrderQty = supplier ? Number(supplier.min_order_qty) : 1;
    const qty = restockQty(daysSupply, velocity, leadTime, minOrderQty);
    const lc = landedByProductId[p.id];
    const unitCost = lc ? Number(lc.total_landed_cost) : Number(p.unit_cost) || 0;
    const estCost = qty * unitCost;
    return {
      sku: p.sku,
      asin: p.asin,
      name: p.name || p.title,
      stock,
      daily_velocity: velocity,
      days_of_supply: Math.round(daysSupply * 10) / 10,
      reorder_flag: reorderFlag,
      opt_score: p.opt_score,
      opt_status: p.opt_status,
      po_draft_id: p.po_draft_id || null,
      supplier_id: supplierId,
      supplier_name: supplier ? supplier.name : p.supplier || null,
      lead_time_days: leadTime,
      min_order_qty: minOrderQty,
      restock_qty: qty,
      est_restock_cost_usd: Math.round(estCost * 100) / 100,
      unit_landed_cost_usd: unitCost,
    };
  });

  const lowStock = products.filter((p) => p.reorder_flag);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalVelocity = products.reduce((sum, p) => sum + p.daily_velocity, 0);
  const restockProposals = products.filter((p) => p.reorder_flag);
  const totalEstRestockCost = restockProposals.reduce((sum, p) => sum + p.est_restock_cost_usd, 0);

  writeMockState(state);

  return NextResponse.json({
    operation_id: crypto.randomUUID(),
    status: "completed",
    seller_id: sellerId,
    products_scanned: products.length,
    low_stock_count: lowStock.length,
    total_stock: totalStock,
    total_velocity: totalVelocity,
    restock_proposal_count: restockProposals.length,
    total_est_restock_cost_usd: Math.round(totalEstRestockCost * 100) / 100,
    products,
    restock_proposals: restockProposals.map((p) => ({
      sku: p.sku,
      asin: p.asin,
      name: p.name,
      stock: p.stock,
      daily_velocity: p.daily_velocity,
      days_of_supply: p.days_of_supply,
      supplier_name: p.supplier_name,
      lead_time_days: p.lead_time_days,
      min_order_qty: p.min_order_qty,
      restock_qty: p.restock_qty,
      unit_landed_cost_usd: p.unit_landed_cost_usd,
      est_restock_cost_usd: p.est_restock_cost_usd,
    })),
  });
}
