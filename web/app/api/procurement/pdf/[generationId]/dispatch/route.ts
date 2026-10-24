import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

type Context = { params: Promise<{ generationId: string }> };

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { generationId } = await params;
  const state = readMockState();
  const now = new Date().toISOString();
  const activity = state.activity || [];
  activity.unshift({
    id: crypto.randomUUID(),
    timestamp: now,
    category: "procurement",
    title: "PO draft dispatched",
    detail: `Generation ${generationId} confirmed for vendor dispatch by ${user.email}.`,
  });
  if (activity.length > 120) activity.length = 120;
  writeMockState(state);
  return NextResponse.json({ ok: true, generation_id: generationId, dispatched_at: now });
}
