import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  return NextResponse.json({ ok: true, source: "mock" });
}
