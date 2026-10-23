import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json({
    name: state.manager?.name || "User",
    role: state.manager?.role || "Procurement manager",
    initials: state.manager?.initials || "U",
  });
}
