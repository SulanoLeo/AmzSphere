import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.purchase_orders || []).map((po: any) => ({
      id: po.id,
      product_asin: po.product_asin,
      product_name: po.product_name,
      supplier: po.supplier,
      units: Number(po.units),
      status: po.status,
      created_at: po.created_at,
    }))
  );
}
