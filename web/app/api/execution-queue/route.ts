import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.execution_queue || []).map((q: any) => ({
      id: q.id,
      action: q.action,
      payload: q.payload || {},
      status: q.status,
      created_at: q.created_at,
      completed_at: q.completed_at || null,
    }))
  );
}
