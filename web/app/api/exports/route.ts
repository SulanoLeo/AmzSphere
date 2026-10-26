import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";
import { readMockState, writeMockState } from "@/lib/mock-state";
import { exportCreateSchema } from "@/lib/validation";

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

  const status = searchParams.get("status") || undefined;
  const format = searchParams.get("format") || undefined;

  let exports: any[] = (state.exports || [])
    .filter((e: any) => String(e.seller_id || DEFAULT_SELLER_ID) === sellerId);

  if (status) {
    exports = exports.filter((e: any) => e.status === status);
  }
  if (format) {
    exports = exports.filter((e: any) => e.format === format);
  }

  exports = exports.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  return NextResponse.json({
    exports: exports.map((e: any) => ({
      id: e.id,
      seller_id: e.seller_id,
      report_id: e.report_id,
      format: e.format,
      status: e.status,
      created_at: e.created_at,
      completed_at: e.completed_at,
      download_url: e.download_url,
      record_count: Number(e.record_count),
      error: e.error,
    })),
    total: exports.length,
  });
}

export async function POST(request: Request) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const sellerId = resolveSellerId(request);
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = exportCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detail: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const data = parsed.data;
  const state: any = readMockState();
  const record: any = {
    id: crypto.randomUUID(),
    seller_id: sellerId,
    report_id: data.report_id === null || data.report_id === undefined ? null : data.report_id,
    format: data.format,
    status: "queued",
    created_at: new Date().toISOString(),
    completed_at: null,
    download_url: null,
    record_count: 0,
    error: null,
  };
  (state.exports || []).push(record);
  writeMockState(state);
  return NextResponse.json(record, { status: 201 });
}
