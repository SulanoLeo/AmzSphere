import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import {
  SEO_CATEGORIES,
  SEED_TOOLS,
  type SeoToolCategory,
  type SeoToolCategoryDef,
} from "@/lib/seo-tools";
import { seoCategoryPatchSchema, type SeoCategoryPatchInput } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function findCategoryIndex(id: SeoToolCategory): number {
  return SEO_CATEGORIES.findIndex((c) => c.id === id);
}

export async function PATCH(_request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;

  const { id } = await params;
  const categoryId = id as SeoToolCategory;
  const index = findCategoryIndex(categoryId);
  if (index === -1) {
    return NextResponse.json({ detail: `Category not found: ${id}` }, { status: 404 });
  }
  const body: unknown = await _request.json();
  const parsed = seoCategoryPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const updated: SeoToolCategoryDef = {
    ...SEO_CATEGORIES[index],
    ...parsed.data,
    id: categoryId,
  };
  SEO_CATEGORIES[index] = updated;
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Context) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;

  const { id } = await params;
  const categoryId = id as SeoToolCategory;
  const index = findCategoryIndex(categoryId);
  if (index === -1) {
    return NextResponse.json({ detail: `Category not found: ${id}` }, { status: 404 });
  }
  const inUse = SEED_TOOLS.some((t) => t.category === categoryId);
  if (inUse) {
    return NextResponse.json(
      { detail: `Category ${id} is in use by one or more tools. Disable it instead.` },
      { status: 409 },
    );
  }
  const removed = SEO_CATEGORIES.splice(index, 1)[0];
  return NextResponse.json({ id: removed.id, name: removed.label, deleted: true });
}
