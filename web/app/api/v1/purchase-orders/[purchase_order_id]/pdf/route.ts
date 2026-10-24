import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, assertSellerTenant, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { purchase_order_id: string } }) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  const purchaseOrder = await queryOne<{ id: string; seller_id: string; pdf_bytes: string | null; status: string }>(
    `SELECT id, seller_id, pdf_bytes, status FROM purchase_orders WHERE id = $1`,
    [params.purchase_order_id]
  );

  if (!purchaseOrder || !purchaseOrder.pdf_bytes) {
    return jsonError("Purchase order PDF not found", 404);
  }

  const seller = await queryOne<{ tenant_id: string }>(
    `SELECT tenant_id FROM sellers WHERE id = $1`,
    [purchaseOrder.seller_id]
  );
  assertSellerTenant(seller, workspaceUser);

  const pdfBytes = Buffer.from(purchaseOrder.pdf_bytes, "base64");

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="purchase-order-${params.purchase_order_id}.pdf"`,
      "Content-Length": String(pdfBytes.length),
      "Cache-Control": "no-store",
    },
  });
}
