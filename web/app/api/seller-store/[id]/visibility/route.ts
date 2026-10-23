import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function PATCH(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { id } = await params;
  const body = (await _request.json()) as { visible?: boolean };
  const visible = body.visible;
  if (visible === undefined) {
    return NextResponse.json({ detail: "visible is required" }, { status: 400 });
  }
  const state = readMockState();
  const item = (state.seller_store || []).find((i: any) => i.id === id);
  if (!item) {
    return NextResponse.json({ detail: `Seller store item not found: ${id}` }, { status: 404 });
  }
  item.visible = visible;
  writeMockState(state);
  return NextResponse.json({
    id: item.id,
    asin: item.asin,
    name: item.name,
    sku: item.sku,
    category: item.category,
    price: Number(item.price),
    stock: Number(item.stock),
    visible: item.visible,
    added_at: item.added_at || null,
  });
}
