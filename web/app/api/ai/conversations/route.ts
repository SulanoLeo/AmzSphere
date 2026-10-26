import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

const DEFAULT_SELLER_ID = "mock-seller";

function resolveSellerId(request: Request): string {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("seller_id");
    if (q) return q;
  } catch {}
  return DEFAULT_SELLER_ID;
}

export async function GET(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const state: any = readMockState();
  const convs = (state.ai_conversations || [])
    .filter((c: any) => String(c.seller_id || DEFAULT_SELLER_ID) === sellerId)
    .sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .map((c: any) => ({
      id: c.id,
      seller_id: c.seller_id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  return NextResponse.json({ conversations: convs, total: convs.length });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "New conversation";
  if (!title) {
    return NextResponse.json({ detail: "title is required." }, { status: 422 });
  }
  const state: any = readMockState();
  const now = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    title,
    created_at: now,
    updated_at: now,
  };
  (state.ai_conversations || []).push(record);
  if ((state.ai_conversations as any[]).length > 500) {
    (state.ai_conversations as any[]).length = 500;
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
