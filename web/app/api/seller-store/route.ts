import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  const items = (state.seller_store || []).map((item: any) => ({
    id: item.id,
    asin: item.asin,
    name: item.name,
    sku: item.sku,
    category: item.category,
    price: Number(item.price),
    stock: Number(item.stock),
    visible: Boolean(item.visible),
    added_at: item.added_at || null,
  }));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as { asin?: string };
  const asin = body.asin;
  if (!asin) {
    return NextResponse.json({ detail: "asin is required" }, { status: 400 });
  }
  const state = readMockState();
  const product = (state.products || []).find((p: any) => p.asin === asin);
  if (!product) {
    return NextResponse.json({ detail: `Product not found: ${asin}` }, { status: 404 });
  }
  const existing = (state.seller_store || []).find((i: any) => i.asin === asin);
  if (existing) {
    return NextResponse.json({ detail: `Product already in seller store: ${asin}` }, { status: 409 });
  }
  const item: any = {
    id: crypto.randomUUID(),
    asin: product.asin,
    name: product.name,
    sku: product.sku,
    category: product.category,
    price: Number(product.price),
    stock: Number(product.stock),
    visible: true,
    added_at: new Date().toISOString(),
  };
  (state.seller_store || []).push(item);
  writeMockState(state);
  return NextResponse.json({
    id: item.id,
    asin: item.asin,
    name: item.name,
    sku: item.sku,
    category: item.category,
    price: item.price,
    stock: item.stock,
    visible: item.visible,
    added_at: item.added_at,
  });
}
