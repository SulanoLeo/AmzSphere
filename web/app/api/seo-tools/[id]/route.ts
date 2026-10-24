import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { SEED_TOOLS, type SeoTool } from "@/lib/seo-tools";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function findIndex(id: string): number {
  return SEED_TOOLS.findIndex((t) => t.id === id);
}

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const { id } = await params;
  const tool = SEED_TOOLS.find((t) => t.id === id);
  if (!tool) {
    return NextResponse.json({ detail: `Tool not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json(tool);
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const { id } = await params;
  const index = findIndex(id);
  if (index === -1) {
    return NextResponse.json({ detail: `Tool not found: ${id}` }, { status: 404 });
  }
  const body = (await request.json()) as Partial<SeoTool>;
  const now = new Date().toISOString();
  const updated: SeoTool = {
    ...SEED_TOOLS[index],
    ...body,
    id,
    updated_at: now,
  };
  (SEED_TOOLS as SeoTool[])[index] = updated;
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const { id } = await params;
  const index = findIndex(id);
  if (index === -1) {
    return NextResponse.json({ detail: `Tool not found: ${id}` }, { status: 404 });
  }
  const removed = (SEED_TOOLS as SeoTool[]).splice(index, 1)[0];
  return NextResponse.json({ id: removed.id, name: removed.name, deleted: true });
}
