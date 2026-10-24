import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyAdminSecret, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { generation_id: string } }) {
  try {
    verifyAdminSecret(request.headers.get("x-admin-secret"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const row = await queryOne<{ id: string; status: string; pdf_data: string | null }>(
    `SELECT id, status, pdf_data FROM pending_pdf_generations WHERE id = $1`,
    [params.generation_id]
  );

  if (!row) {
    return jsonError("PDF generation record not found", 404);
  }

  if (row.status !== "completed") {
    return jsonError(`PDF is not ready for preview (status: ${row.status})`, 409);
  }

  if (!row.pdf_data) {
    return jsonError("PDF binary data is missing", 404);
  }

  const pdfBytes = Buffer.from(row.pdf_data, "base64");
  const filename = `PO_Draft_${params.generation_id}.pdf`;

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
