import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    users: (state.users || []).map((u: any) => ({
      id: u.id,
      organization_id: u.organization_id,
      email: u.email,
      name: u.name,
      role: u.role,
      is_active: Boolean(u.is_active),
      created_at: u.created_at,
    })),
  });
}
