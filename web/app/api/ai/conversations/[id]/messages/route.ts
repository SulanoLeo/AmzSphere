import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { aiMessageCreateSchema } from "@/lib/validation";

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

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const state: any = readMockState();
  const conv = (state.ai_conversations || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!conv) {
    return NextResponse.json({ detail: `Conversation not found: ${id}` }, { status: 404 });
  }
  const messages = (state.ai_messages || [])
    .filter((m: any) => String(m.conversation_id) === id)
    .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((m: any) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    }));
  return NextResponse.json({ messages, total: messages.length });
}

export async function POST(request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = aiMessageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const state: any = readMockState();
  const conv = (state.ai_conversations || []).find(
    (x: any) => x.id === id && String(x.seller_id || DEFAULT_SELLER_ID) === sellerId,
  );
  if (!conv) {
    return NextResponse.json({ detail: `Conversation not found: ${id}` }, { status: 404 });
  }
  conv.updated_at = new Date().toISOString();
  const record: any = {
    id: crypto.randomUUID(),
    conversation_id: id,
    role: parsed.data.role,
    content: parsed.data.content,
    created_at: new Date().toISOString(),
  };
  (state.ai_messages || []).push(record);
  if ((state.ai_messages as any[]).length > 1000) {
    (state.ai_messages as any[]).length = 1000;
  }
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
