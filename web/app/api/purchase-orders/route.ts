import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { purchaseOrderCreateSchema } from "@/lib/validation";

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

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const parsed = purchaseOrderCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const state = readMockState();
  const product = (state.products || []).find((item: any) => item.asin === parsed.data.product_asin);
  if (!product) {
    return NextResponse.json({ detail: "Product not found" }, { status: 404 });
  }

  const purchaseOrder = {
    id: `po-${crypto.randomUUID()}`,
    product_asin: product.asin,
    product_name: product.name || product.title,
    supplier: product.supplier || "Unassigned supplier",
    units: parsed.data.units,
    status: "draft",
    created_at: new Date().toISOString(),
    seller_id: product.seller_id || "mock-seller",
    created_by: user.email,
  };
  state.purchase_orders = state.purchase_orders || [];
  state.purchase_orders.unshift(purchaseOrder);
  writeMockState(state);

  return NextResponse.json(purchaseOrder, { status: 201 });
}
