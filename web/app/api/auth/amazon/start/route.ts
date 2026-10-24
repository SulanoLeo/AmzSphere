import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  return NextResponse.json({
    ok: true,
    source: "mock",
    message: "SP-API authorization is simulated. Connect a seller account in mock mode to begin.",
    authorization_url: null,
  });
}
