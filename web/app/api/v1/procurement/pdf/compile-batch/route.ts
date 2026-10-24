import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyAdminSecret, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    verifyAdminSecret(request.headers.get("x-admin-secret"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

  const rows = await query<{
    id: string;
    batch_token: string;
    execution_strategy: string;
    payload: any;
    purchase_order_id: string | null;
    vendor_id: string | null;
  }>(
    `SELECT id, batch_token, execution_strategy, payload, purchase_order_id, vendor_id
     FROM pending_pdf_generations
     WHERE status = 'pending'
     ORDER BY created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 5`
  );

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let batchToken: string | null = null;

  for (const row of rows) {
    batchToken = row.batch_token;
    processed++;

    try {
      const poId = row.purchase_order_id;
      if (!poId) throw new Error(`Purchase order ${row.id} not found`);

      const purchaseOrder = await queryOne<{ id: string; currency: string; lines: any; status: string }>(
        `SELECT id, currency, lines, status FROM purchase_orders WHERE id = $1`,
        [poId]
      );
      if (!purchaseOrder) throw new Error(`Purchase order ${poId} not found`);

      let vendor: { name: string } | null = null;
      if (row.vendor_id) {
        vendor = await queryOne<{ name: string }>(`SELECT name FROM vendors WHERE id = $1`, [row.vendor_id]);
      }

      const pdfBytes = await buildPoPdf({
        vendor,
        purchaseOrder,
        batchToken: row.batch_token,
        executionStrategy: row.execution_strategy,
        payload: row.payload || {},
      });

      await query(
        `UPDATE pending_pdf_generations SET pdf_data = $1, status = 'completed', completed_at = NOW(), error_details = NULL WHERE id = $2`,
        [Buffer.from(pdfBytes).toString("base64"), row.id]
      );
      succeeded++;
    } catch (error) {
      await query(
        `UPDATE pending_pdf_generations SET status = 'failed', completed_at = NOW(), error_details = $1 WHERE id = $2`,
        [String(error).slice(0, 500), row.id]
      );
      failed++;
    }
  }

  return NextResponse.json({
    processed,
    succeeded,
    failed,
    batch_token: batchToken,
    message: `Compiled ${succeeded} PDF(s) successfully; ${failed} failed. Batch token: ${batchToken || "—"}`,
    timestamp: new Date().toISOString(),
  });
}

async function buildPoPdf(opts: {
  vendor: { name: string } | null;
  purchaseOrder: { id: string; currency: string; lines: any; status: string };
  batchToken: string;
  executionStrategy: string;
  payload: any;
}): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  let y = height - 50;

  const writeText = (text: string, x: number, yPos: number, size = 10, useBold = false, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x, y: yPos, size, font: useBold ? boldFont : font, color });
  };

  writeText("AmzSphere B2B Procurement", 50, y, 16, true, rgb(0.12, 0.23, 0.54));
  y -= 22;
  writeText("Amazon Seller Operations Workspace · Purchase Order Draft", 50, y, 9);
  y -= 12;
  writeText("DRAFT - NOT AN ORDER TRANSMISSION", 50, y, 10, true, rgb(0.75, 0.11, 0.11));
  y -= 30;

  const vendorName = opts.vendor?.name || "Unknown Vendor";
  const poIdStr = String(opts.purchaseOrder.id);
  const now = new Date().toUTCString();

  const infoRows = [
    ["Vendor", vendorName, "Batch Token", opts.batchToken.slice(0, 12)],
    ["Vendor Code", "", "Execution Strategy", opts.executionStrategy],
    ["PO ID", poIdStr, "Currency", opts.purchaseOrder.currency],
    ["Status", opts.purchaseOrder.status, "Generated", now],
  ];

  const col1X = 50;
  const col2X = 150;
  const col3X = 320;
  const col4X = 420;
  const rowHeight = 20;

  for (const [label1, value1, label2, value2] of infoRows) {
    page.drawRectangle({ x: col1X, y: y - 14, width: 90, height: 16, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
    page.drawRectangle({ x: col3X, y: y - 14, width: 90, height: 16, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
    writeText(label1, col1X + 4, y - 10, 8, true);
    writeText(String(value1), col1X + 45, y - 10, 8);
    writeText(label2, col3X + 4, y - 10, 8, true);
    writeText(String(value2), col3X + 45, y - 10, 8);
    y -= rowHeight;
  }

  y -= 20;
  writeText("Line Items", 50, y, 11, true, rgb(0.12, 0.23, 0.54));
  y -= 20;

  const tableHeaderY = y;
  writeText("SKU", 50, tableHeaderY, 8, true, rgb(1, 1, 1));
  writeText("Product / Item", 120, tableHeaderY, 8, true, rgb(1, 1, 1));
  writeText("Qty", 320, tableHeaderY, 8, true, rgb(1, 1, 1));
  writeText("Unit Cost", 380, tableHeaderY, 8, true, rgb(1, 1, 1));
  writeText("Subtotal", 460, tableHeaderY, 8, true, rgb(1, 1, 1));
  y -= 18;

  let grandTotal = 0;
  const lines = opts.purchaseOrder.lines || [];
  for (const line of lines) {
    const sku = String(line.sku || "");
    const title = String(line.title || line.asin || "");
    const qty = Number(line.quantity || 0);
    const unitPrice = Number(line.unit_price || 0);
    const subtotal = qty * unitPrice;
    grandTotal += subtotal;

    page.drawRectangle({ x: 50, y: y - 10, width: 540, height: 16, color: y % 40 < 20 ? rgb(1, 1, 1) : rgb(0.97, 0.98, 0.98), borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 0.5 });
    writeText(sku, 54, y - 7, 8);
    writeText(title, 124, y - 7, 8);
    writeText(String(qty), 324, y - 7, 8);
    writeText(unitPrice.toFixed(2), 384, y - 7, 8);
    writeText(subtotal.toFixed(2), 464, y - 7, 8);
    y -= 18;
  }

  page.drawRectangle({ x: 50, y: y - 10, width: 540, height: 16, color: rgb(0.93, 0.96, 1), borderColor: rgb(0.12, 0.23, 0.54), borderWidth: 1 });
  writeText("Grand Total", 384, y - 7, 10, true);
  writeText(grandTotal.toFixed(2), 464, y - 7, 10, true, rgb(0.12, 0.23, 0.54));
  y -= 40;

  writeText(
    "This document is a draft generated by the AmzSphere B2B Procurement workspace. It does not constitute a transmitted purchase order until formally approved and submitted through the vendor channel.",
    50, y, 7, false, rgb(0.42, 0.45, 0.5)
  );

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
