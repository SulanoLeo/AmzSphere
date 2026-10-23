import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const state = readMockState();
  return NextResponse.json(
    (state.reviews || []).map((r: any) => ({
      id: r.id,
      product: r.product,
      rating: Number(r.rating),
      date: r.date,
      theme: r.theme,
      text: r.text,
    }))
  );
}
