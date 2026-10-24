import { NextResponse } from "next/server";
import { requireAllowedUser } from "@/lib/require-user";

type Context = { params: Promise<{ generationId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Context) {
  const user = await requireAllowedUser();
  if ("response" in user) return user.response;
  const { generationId } = await params;
  const pdfBytes = Buffer.from(`%PDF-1.4\nMock purchase order draft ${generationId}\n%%EOF\n`);
  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=PO_Draft_${generationId}.pdf`,
      "Cache-Control": "private, no-store",
    },
  });
}
