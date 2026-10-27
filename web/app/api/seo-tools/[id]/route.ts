import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { SEED_TOOLS, type SeoTool, type SeoToolCategory, type Marketplace } from "@/lib/seo-tools";
import { seoToolPatchSchema, type SeoToolPatchInput } from "@/lib/validation";

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
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;

  const { id } = await params;
  const index = findIndex(id);
  if (index === -1) {
    return NextResponse.json({ detail: `Tool not found: ${id}` }, { status: 404 });
  }
  const body: unknown = await request.json();
  const parsed = seoToolPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data as SeoToolPatchInput;
  const now = new Date().toISOString();
  const updated: SeoTool = {
    ...SEED_TOOLS[index],
    ...input,
    id,
    category: input.category ? (input.category as SeoToolCategory) : SEED_TOOLS[index].category,
    marketplaces: input.marketplaces as Marketplace[],
    updated_at: now,
  };
  (SEED_TOOLS as SeoTool[])[index] = updated;
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;

  const { id } = await params;
  const index = findIndex(id);
  if (index === -1) {
    return NextResponse.json({ detail: `Tool not found: ${id}` }, { status: 404 });
  }
  const removed = (SEED_TOOLS as SeoTool[]).splice(index, 1)[0];
  return NextResponse.json({ id: removed.id, name: removed.name, deleted: true });
}
