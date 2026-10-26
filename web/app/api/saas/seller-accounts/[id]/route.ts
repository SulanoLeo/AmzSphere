import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { sellerAccountUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const a = (state.seller_accounts || []).find((x: any) => x.id === id);
  if (!a) {
    return NextResponse.json({ detail: `Seller account not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: a.id,
    organization_id: a.organization_id,
    merchant_id: a.merchant_id,
    marketplace_id: a.marketplace_id,
    region: a.region,
    sp_api_connected: Boolean(a.sp_api_connected),
    created_at: a.created_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = sellerAccountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const a = (state.seller_accounts || []).find((x: any) => x.id === id);
  if (!a) {
    return NextResponse.json({ detail: `Seller account not found: ${id}` }, { status: 404 });
  }
  Object.assign(a, parsed.data);
  writeMockState(state);
  return NextResponse.json({
    id: a.id,
    organization_id: a.organization_id,
    merchant_id: a.merchant_id,
    marketplace_id: a.marketplace_id,
    region: a.region,
    sp_api_connected: Boolean(a.sp_api_connected),
    created_at: a.created_at,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const idx = (state.seller_accounts || []).findIndex((x: any) => x.id === id);
  if (idx === -1) {
    return NextResponse.json({ detail: `Seller account not found: ${id}` }, { status: 404 });
  }
  (state.seller_accounts as any[]).splice(idx, 1);
  writeMockState(state);
  return NextResponse.json({ detail: `Seller account deleted: ${id}` });
}
