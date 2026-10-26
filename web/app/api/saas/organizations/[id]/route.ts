import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { organizationUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const o = (state.organizations || []).find((x: any) => x.id === id);
  if (!o) {
    return NextResponse.json({ detail: `Organization not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    created_at: o.created_at,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state: any = readMockState();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = organizationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const o = (state.organizations || []).find((x: any) => x.id === id);
  if (!o) {
    return NextResponse.json({ detail: `Organization not found: ${id}` }, { status: 404 });
  }
  Object.assign(o, parsed.data);
  writeMockState(state);
  return NextResponse.json({
    id: o.id,
    name: o.name,
    slug: o.slug,
    plan: o.plan,
    created_at: o.created_at,
  });
}
