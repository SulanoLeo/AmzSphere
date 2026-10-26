import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { userUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const u = (state.users || []).find((x: any) => x.id === id);
  if (!u) {
    return NextResponse.json({ detail: `User not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: u.id,
    organization_id: u.organization_id,
    email: u.email,
    name: u.name,
    role: u.role,
    is_active: Boolean(u.is_active),
    created_at: u.created_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const u = (state.users || []).find((x: any) => x.id === id);
  if (!u) {
    return NextResponse.json({ detail: `User not found: ${id}` }, { status: 404 });
  }
  Object.assign(u, body);
  writeMockState(state);
  return NextResponse.json({
    id: u.id,
    organization_id: u.organization_id,
    email: u.email,
    name: u.name,
    role: u.role,
    is_active: Boolean(u.is_active),
    created_at: u.created_at,
  });
}
