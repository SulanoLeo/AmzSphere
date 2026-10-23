import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.orders || []).map((o: any) => ({
      id: o.id,
      product_name: o.product_name,
      supplier: o.supplier,
      amount: Number(o.amount),
      units: Number(o.units),
      status: o.status,
      reviewed_by: o.reviewed_by,
      reviewed_at: o.reviewed_at,
    }))
  );
}
