import { NextResponse } from "next/server";
import { query, queryOne, transaction, type PoolClient } from "@/lib/db";
import { verifyPlatformKey, requireWorkspaceUser, jsonError } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

interface BulkProcurementApprovalRequest {
  purchase_order_ids: (string | number)[];
  execution_strategy: "IMMEDIATE_STAGING" | "CONSOLIDATE_BY_VENDOR";
}

export async function POST(request: Request) {
  try {
    verifyPlatformKey(request.headers.get("x-platform-key"));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unauthorized", 401);
  }

  const workspaceUser = requireWorkspaceUser(request.headers.get("x-workspace-user"));

  let body: BulkProcurementApprovalRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!Array.isArray(body.purchase_order_ids) || body.purchase_order_ids.length === 0 || body.purchase_order_ids.length > 200) {
    return jsonError("No valid purchase order IDs provided", 400);
  }

  if (!["IMMEDIATE_STAGING", "CONSOLIDATE_BY_VENDOR"].includes(body.execution_strategy)) {
    return jsonError("execution_strategy must be IMMEDIATE_STAGING or CONSOLIDATE_BY_VENDOR", 400);
  }

  const batchToken = require("crypto").randomUUID();
  const requestedIds: string[] = [];

  for (const rawId of body.purchase_order_ids) {
    const idStr = String(rawId);
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(idStr)) {
      requestedIds.push(idStr.toLowerCase());
    }
  }

  if (requestedIds.length === 0) {
    return jsonError("No valid purchase order IDs provided", 400);
  }

  return await transaction(async (client: PoolClient) => {
    const placeholders = requestedIds.map((_, i) => `$${i + 1}`).join(",");
    const rows = await query<{ id: string; vendor_id: string | null; status: string }>(
      `SELECT id, vendor_id, status FROM purchase_orders WHERE id IN (${placeholders})`,
      requestedIds,
      client
    );

    const foundIds = new Set(rows.map((r) => r.id));
    const missingIds = requestedIds.filter((id) => !foundIds.has(id));

    const mutableRows = rows.filter((r) => r.status === "pending_review");
    const immutableIds = rows.filter((r) => r.status !== "pending_review").map((r) => r.id);

    if (mutableRows.length === 0) {
      return jsonError("No purchase orders are in a mutable (pending_review) state", 409);
    }

    const approvedIds = mutableRows.map((r) => r.id);
    const approvedPlaceholders = approvedIds.map((_, i) => `$${i + 1}`).join(",");
    await query(
      `UPDATE purchase_orders SET status = 'approved', updated_at = NOW() WHERE id IN (${approvedPlaceholders})`,
      approvedIds,
      client
    );

    const vendorIds = [...new Set(mutableRows.map((r) => r.vendor_id).filter((v): v is string => v !== null))];
    const vendorNames: Record<string, string> = {};
    if (vendorIds.length > 0) {
      const vendorPlaceholders = vendorIds.map((_, i) => `$${i + 1}`).join(",");
      const vendors = await query<{ id: string; name: string }>(
        `SELECT id, name FROM vendors WHERE id IN (${vendorPlaceholders})`,
        vendorIds,
        client
      );
      for (const v of vendors) {
        vendorNames[v.id] = v.name;
      }
    }

    let stagedCount = 0;
    let vendorGroupCount = 0;

    if (body.execution_strategy === "CONSOLIDATE_BY_VENDOR") {
      const groups: Record<string, string[]> = {};
      for (const po of mutableRows) {
        const key = po.vendor_id ?? "null";
        if (!groups[key]) groups[key] = [];
        groups[key].push(po.id);
      }

      for (const [vendorIdKey, poIds] of Object.entries(groups)) {
        const vid = vendorIdKey === "null" ? null : vendorIdKey;
        const vendorName = vid ? (vendorNames[vid] || "Unknown Vendor") : "Unknown Vendor";
        const payload = {
          strategy: "CONSOLIDATE_BY_VENDOR",
          vendor_id: vid,
          vendor_name: vendorName,
          purchase_order_ids: poIds,
          po_count: poIds.length,
          batch_token: batchToken,
        };
        await query(
          `INSERT INTO pending_pdf_generations (vendor_id, batch_token, execution_strategy, payload, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [vid, batchToken, body.execution_strategy, JSON.stringify(payload)],
          client
        );
        vendorGroupCount++;
        stagedCount++;
      }
    } else {
      for (const po of mutableRows) {
        const payload = {
          strategy: "IMMEDIATE_STAGING",
          purchase_order_id: po.id,
          vendor_id: po.vendor_id,
          vendor_name: po.vendor_id ? (vendorNames[po.vendor_id] || "Unknown Vendor") : "Unknown Vendor",
          batch_token: batchToken,
        };
        await query(
          `INSERT INTO pending_pdf_generations (purchase_order_id, vendor_id, batch_token, execution_strategy, payload, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [po.id, po.vendor_id, batchToken, body.execution_strategy, JSON.stringify(payload)],
          client
        );
        stagedCount++;
      }
    }

    return NextResponse.json({
      batch_token: batchToken,
      execution_strategy: body.execution_strategy,
      total_requested: requestedIds.length,
      total_approved: approvedIds.length,
      total_skipped: missingIds.length + immutableIds.length,
      vendor_groups: body.execution_strategy === "CONSOLIDATE_BY_VENDOR" ? vendorGroupCount : 0,
      message: `${approvedIds.length} purchase order(s) approved and staged for PDF generation under batch token ${batchToken}.`,
      timestamp: new Date().toISOString(),
    });
  });
}
