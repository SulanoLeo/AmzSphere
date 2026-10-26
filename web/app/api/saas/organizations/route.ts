import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    organizations: (state.organizations || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      created_at: o.created_at,
    })),
  });
}
