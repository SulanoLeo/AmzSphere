import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { teamMembershipUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const m = (state.team_memberships || []).find((x: any) => x.id === id);
  if (!m) {
    return NextResponse.json({ detail: `Team membership not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
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
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = teamMembershipUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const m = (state.team_memberships || []).find((x: any) => x.id === id);
  if (!m) {
    return NextResponse.json({ detail: `Team membership not found: ${id}` }, { status: 404 });
  }
  Object.assign(m, parsed.data);
  m.updated_at = new Date().toISOString();
  writeMockState(state);
  return NextResponse.json({
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
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const idx = (state.team_memberships || []).findIndex((x: any) => x.id === id);
  if (idx === -1) {
    return NextResponse.json({ detail: `Team membership not found: ${id}` }, { status: 404 });
  }
  (state.team_memberships as any[]).splice(idx, 1);
  writeMockState(state);
  return NextResponse.json({ detail: `Team membership deleted: ${id}` });
}
