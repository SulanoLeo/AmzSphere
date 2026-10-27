import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { SEO_CATEGORIES, type SeoToolCategory, type SeoToolCategoryDef } from "@/lib/seo-tools";
import type { SeoCategoryPatchInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

function findCategoryIndex(id: SeoToolCategory): number {
  return SEO_CATEGORIES.findIndex((c) => c.id === id);
}

export async function GET(_request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  return NextResponse.json(SEO_CATEGORIES);
}

export async function POST(request: Request) {
  const user = await requireAllowedUser("approver");
  if ("response" in user) return user.response;

  const body: unknown = await request.json();
  const { id, label, description } = body as {
    id?: string;
    label?: string;
    description?: string;
  };
  if (!id || !label) {
    return NextResponse.json({ detail: "id and label are required" }, { status: 422 });
  }
  const categoryId = id as SeoToolCategory;
  if (findCategoryIndex(categoryId) !== -1) {
    return NextResponse.json({ detail: `Category already exists: ${id}` }, { status: 409 });
  }
  const now = new Date().toISOString();
  const category: SeoToolCategoryDef = {
    id: categoryId,
    label,
    description: description ?? "",
    is_active: true,
  };
  SEO_CATEGORIES.push(category);
  return NextResponse.json(category, { status: 201 });
}
