import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyAdminSecret, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { generation_id: string } }) {
  try {
    verifyAdminSecret(request.headers.get("x-admin-secret"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const row = await queryOne<{ id: string; status: string }>(
    `SELECT id, status FROM pending_pdf_generations WHERE id = $1`,
    [params.generation_id]
  );

  if (!row) {
    return jsonError("PDF generation record not found", 404);
  }

  if (row.status !== "completed") {
    return jsonError(`PDF cannot be dispatched (status: ${row.status})`, 409);
  }

  await query(
    `UPDATE pending_pdf_generations SET status = 'dispatched', completed_at = NOW() WHERE id = $1`,
    [params.generation_id]
  );

  return NextResponse.json({
    generation_id: params.generation_id,
    status: "dispatched",
    dispatched_at: new Date().toISOString(),
    message: "PDF draft confirmed for vendor dispatch.",
  });
}
