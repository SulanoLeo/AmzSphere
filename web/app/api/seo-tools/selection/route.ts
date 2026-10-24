import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

type Context = { params: Promise<{}> };

export const dynamic = "force-dynamic";

const SELECTION_STORAGE_KEY = "amzsphere_seo_selection";

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  return NextResponse.json({
    selected_tool_ids: [],
    source: "localStorage",
    note: "Selection is persisted client-side in localStorage. This endpoint mirrors the mock save/get contract.",
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const body = (await request.json()) as { selected_tool_ids?: string[] };
  const ids: string[] = Array.isArray(body.selected_tool_ids) ? body.selected_tool_ids : [];

  return NextResponse.json({
    selected_tool_ids: ids,
    count: ids.length,
    saved_at: new Date().toISOString(),
    source: "localStorage",
    note: "Persist these IDs in localStorage on the client. This endpoint acknowledges the save contract.",
  });
}
