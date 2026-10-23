import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.product_revisions || []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      asin: r.asin,
      field_changes: r.field_changes || {},
      status: r.status,
      created_by: r.created_by,
      created_at: r.created_at,
    }))
  );
}
