import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { teamMembershipCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  return NextResponse.json({
    team_memberships: (state.team_memberships || []).map((m: any) => ({
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      invited_by: m.invited_by,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      is_active: Boolean(m.is_active),
      created_at: m.created_at,
      updated_at: m.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = teamMembershipCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    organization_id: parsed.data.organization_id,
    user_id: parsed.data.user_id,
    role: parsed.data.role,
    invited_by: parsed.data.invited_by ?? null,
    invited_at: parsed.data.invited_at ?? null,
    accepted_at: parsed.data.accepted_at ?? null,
    is_active: Boolean(parsed.data.is_active),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  (state.team_memberships || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
