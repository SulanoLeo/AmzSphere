import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { sellerAccountCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    seller_accounts: (state.seller_accounts || []).map((a: any) => ({
      id: a.id,
      organization_id: a.organization_id,
      merchant_id: a.merchant_id,
      marketplace_id: a.marketplace_id,
      region: a.region,
      sp_api_connected: Boolean(a.sp_api_connected),
      created_at: a.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = sellerAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    organization_id: parsed.data.organization_id,
    merchant_id: parsed.data.merchant_id,
    marketplace_id: parsed.data.marketplace_id,
    region: parsed.data.region,
    sp_api_connected: Boolean(parsed.data.sp_api_connected),
    created_at: new Date().toISOString(),
  };
  (state.seller_accounts || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
