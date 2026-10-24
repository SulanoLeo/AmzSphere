import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    ok: true,
    mode: config.SP_API_ENABLED === "true" ? "production" : "disabled",
  });
}
