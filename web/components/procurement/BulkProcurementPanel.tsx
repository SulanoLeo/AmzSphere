"use client";

import { useCallback, useMemo, useState } from "react";

import { AlertCircle, CheckSquare, Layers, ShoppingBag, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type ExecutionStrategy = "IMMEDIATE_STAGING" | "CONSOLIDATE_BY_VENDOR";

export interface PurchaseOrderRow {
  id: string;
  vendor: string;
  vendor_id: string | null;
  status: string;
  total_amount_minor: number;
  currency: string;
  lines: Array<{ sku: string; quantity: number }>;
}

export interface BulkProcurementApprovalResponse {
  batch_token: string;
  execution_strategy: string;
  total_requested: number;
  total_approved: number;
  total_skipped: number;
  vendor_groups: number;
  message: string;
  timestamp: string;
}

interface BulkProcurementPanelProps {
  orders: PurchaseOrderRow[];
}

const API_BASE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
})();

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function BulkProcurementPanel({ orders }: BulkProcurementPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [strategy, setStrategy] = useState<ExecutionStrategy>("IMMEDIATE_STAGING");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<BulkProcurementApprovalResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isSelectAll = orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const isIndeterminate =
    selectedIds.size > 0 && selectedIds.size < orders.length;
  const mutableCount = orders.filter((o) => o.status === "pending_review").length;

  const toggleSelectAll = useCallback(() => {
    if (isSelectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  }, [orders, isSelectAll]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearResult = useCallback(() => {
    setSubmitResult(null);
    setSubmitError(null);
  }, []);

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const payload = {
        purchase_order_ids: Array.from(selectedIds),
        execution_strategy: strategy,
      };

      const result = await json<BulkProcurementApprovalResponse>(
        `${API_BASE_URL}/api/procurement/bulk-approve`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setSubmitResult(result);
      // Clear selection after successful submission.
      setSelectedIds(new Set());
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Bulk approval failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, strategy]);

  const totalAmount = useMemo(
    () =>
      orders
        .filter((o) => selectedIds.has(o.id))
        .reduce((sum, o) => sum + o.total_amount_minor, 0),
    [orders, selectedIds],
  );

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));

  return (
    <section className="space-y-5">
      {/* Header / summary bar */}
      <Card className={cn("border-line rounded-xl")}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingBag size={20} className="text-indigo-600" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">
                  Bulk procurement approval
                </p>
                <h2 className="text-sm font-semibold text-indigo-950">
                  Approve selected purchase orders
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-muted">
                {selectedIds.size} of {orders.length} selected
              </span>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-indigo-950 tabular-nums">
                  ${(totalAmount / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Strategy selector (shown when anything is selected) */}
          {selectedIds.size > 0 && (
            <div className="mt-4 pt-4 border-t border-line flex items-center gap-4">
              <p className="text-xs font-semibold text-muted">Execution strategy</p>
              <div className="flex gap-2 rounded-md border border-line bg-white p-1">
                <label className="cursor-pointer select-none">
                  <input
                    type="radio"
                    name="execution_strategy"
                    value="IMMEDIATE_STAGING"
                    checked={strategy === "IMMEDIATE_STAGING"}
                    onChange={() => setStrategy("IMMEDIATE_STAGING")}
                    className="peer sr-only"
                  />
                  <span className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    strategy === "IMMEDIATE_STAGING"
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                      : "text-muted hover:bg-amber-50",
                  )}>
                    Immediate staging
                  </span>
                </label>
                <label className="cursor-pointer select-none">
                  <input
                    type="radio"
                    name="execution_strategy"
                    value="CONSOLIDATE_BY_VENDOR"
                    checked={strategy === "CONSOLIDATE_BY_VENDOR"}
                    onChange={() => setStrategy("CONSOLIDATE_BY_VENDOR")}
                    className="peer sr-only"
                  />
                  <span className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    strategy === "CONSOLIDATE_BY_VENDOR"
                      ? "bg-amber-100 text-amber-700 border-amber-200"
                      : "text-muted hover:bg-amber-50",
                  )}>
                    Consolidate by vendor
                  </span>
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission result / error */}
      {submitResult && (
        <Card className={cn("border-teal-200 bg-teal-50 rounded-xl")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-teal-600" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-teal-900">
                  Bulk approval submitted
                </h3>
                <p className="mt-0.5 text-xs text-teal-800">
                  {submitResult.message}
                </p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] font-bold uppercase tracking-tighter text-teal-700">
                  Batch token
                </div>
                <div className="text-xs tabular-nums text-teal-900 font-mono">
                  {submitResult.batch_token.slice(0, 8)}…
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="px-3 py-2 rounded-lg border border-teal-200 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-tighter text-teal-700">
                  Approved
                </p>
                <p className="text-sm font-semibold text-teal-900 tabular-nums">
                  {submitResult.total_approved}
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg border border-amber-200 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-tighter text-amber-700">
                  Skipped
                </p>
                <p className="text-sm font-semibold text-amber-900 tabular-nums">
                  {submitResult.total_skipped}
                </p>
              </div>
              <div className="px-3 py-2 rounded-lg border border-blue-200 bg-white">
                <p className="text-[10px] font-bold uppercase tracking-tighter text-blue-700">
                  Vendor groups
                </p>
                <p className="text-sm font-semibold text-blue-900 tabular-nums">
                  {submitResult.vendor_groups}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearResult}
              className="mt-4 inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:underline"
            >
              Dismiss <CheckSquare size={14} aria-hidden="true" />
            </button>
          </CardContent>
        </Card>
      )}

      {submitError && (
        <Card className={cn("border-red-200 bg-red-50 rounded-xl")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="text-red-600" aria-hidden="true" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900">Bulk approval failed</h3>
                <p className="mt-0.5 text-xs text-red-800">{submitError}</p>
              </div>
              <button
                type="button"
                onClick={clearResult}
                className="text-[10px] font-semibold text-indigo-600 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating action bar when rows are selected */}
      {selectedIds.size > 0 && !submitResult && !submitError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Card className={cn("border-amber-300 bg-amber-50 shadow-lg rounded-xl")}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Layers size={18} className="text-amber-700" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-tighter text-amber-800">
                      {selectedIds.size} order{selectedIds.size === 1 ? "" : "s"} ready
                    </p>
                    <p className="text-sm font-semibold text-indigo-950">
                      Approve &amp; stage PDF generation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-800">
                    ${(totalAmount / 100).toFixed(2)} total
                  </span>
                  <Button
                    onClick={handleBulkApprove}
                    disabled={isSubmitting || mutableCount === 0}
                    className="h-10 px-5 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Processing…
                      </>
                    ) : (
                      "Approve selected"
                    )}
                  </Button>
                  {mutableCount < selectedIds.size && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                      {selectedIds.size - mutableCount} not mutable
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Order list with selection column */}
      <Card className={cn("border-line rounded-xl overflow-hidden")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isSelectAll}
                onChange={toggleSelectAll}
                aria-label="Select all"
                className="rounded-md border-indigo-600 bg-indigo-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-muted uppercase tracking-tighter">
                Select all ({orders.length})
              </span>
            </div>
            <span className="text-[10px] font-bold text-muted uppercase tracking-tighter">
              {mutableCount} mutable · {orders.length - mutableCount} locked
            </span>
          </div>
        </CardHeader>
        <div className="divide-y divide-line">
          {orders.map((order) => {
            const isSelected = selectedIds.has(order.id);
            const isMutable = order.status === "pending_review";
            return (
              <div
                key={order.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3 transition-colors",
                  isSelected && "bg-indigo-50",
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleId(order.id)}
                    disabled={!isMutable}
                    aria-label={`Select ${order.vendor}`}
                    className={cn(
                      "rounded-md border-indigo-600 text-indigo-600 focus:ring-indigo-500",
                      !isMutable && "text-slate-400 border-slate-400 bg-slate-50",
                      isSelected && "bg-indigo-950",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-950 truncate">
                      {order.vendor}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {order.lines.map((line) => `${line.sku} × ${line.quantity}`).join("; ") || "No line items"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tabular-nums font-semibold text-indigo-950">
                      ${(order.total_amount_minor / 100).toFixed(2)}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded",
                        isMutable
                          ? "border-amber-100 bg-amber-50 text-amber-700"
                          : "border-slate-100 bg-slate-50 text-slate-500",
                      )}
                    >
                      {order.status.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted">No purchase orders available for bulk approval.</p>
            </div>
          )}
        </div>
      </Card>

      {mutableCount < orders.length && orders.length > 0 && (
        <p className="text-[10px] text-muted">
          Only orders in "Pending review" status can be bulk-approved. Locked orders are excluded from submission.
        </p>
      )}
    </section>
  );
}
