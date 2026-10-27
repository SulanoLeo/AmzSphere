import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { selectionSaveSchema } from "@/lib/validation";

type Context = { params: Promise<{}> };

export const dynamic = "force-dynamic";

// In-memory per-user selection store keyed by email. Mirrors the client-side
// localStorage contract for logged-in users; resets with the server process
// (mock stack). The client persists durably to localStorage in all cases.
const userSelections = new Map<string, string[]>();

function selectionKey(email: string): string {
  return email.toLowerCase().trim();
}

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const ids = userSelections.get(selectionKey(user.email)) ?? [];
  return NextResponse.json({
    selected_tool_ids: ids,
    count: ids.length,
    source: "server",
    user: user.email,
  });
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;

  const body: unknown = await request.json();
  const parsed = selectionSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const ids = Array.from(new Set(parsed.data.selected_tool_ids.filter(Boolean)));
  userSelections.set(selectionKey(user.email), ids);

  return NextResponse.json({
    selected_tool_ids: ids,
    count: ids.length,
    saved_at: new Date().toISOString(),
    source: "server",
    user: user.email,
  });
}
