import { NextResponse } from "next/server";
import { readMockState } from "@/lib/mock-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = readMockState();
  return NextResponse.json({ ...state, generated_at: new Date().toISOString() });
}
