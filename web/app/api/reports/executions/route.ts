import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState } from "@/lib/mock-state";

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
  const { searchParams } = new URL(request.url);

  const reportId = searchParams.get("report_id") || undefined;
  let executions: any[] = (state.report_executions || [])
    .filter((e: any) => String(e.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (reportId) {
    executions = executions.filter((e: any) => String(e.report_id) === reportId);
  }

  executions = executions.sort((a: any, b: any) => String(b.started_at).localeCompare(String(a.started_at)));

  return NextResponse.json({
    report_executions: executions.map((e: any) => ({
      id: e.id,
      report_id: e.report_id,
      seller_id: e.seller_id,
      status: e.status,
      started_at: e.started_at,
      completed_at: e.completed_at,
      records_processed: Number(e.records_processed),
      error: e.error,
    })),
    total: executions.length,
  });
}
