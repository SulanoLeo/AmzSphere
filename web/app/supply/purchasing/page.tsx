"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PackageSearch, ClipboardList, FileText, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Order, PurchaseOrder } from "@/lib/provider/types";
import { downloadCsv } from "@/lib/csv";

function Metric({
  label,
  value,
  detail,
  accent,
  tag,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tag?: string;
}) {
  return (
    <section className="metric" data-accent={accent}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
    </section>
  );
}

export default function PurchasingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading purchasing…</div>}>
      <PurchasingWithParams />
    </Suspense>
  );
}

function PurchasingWithParams() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<"orders" | "approvals">(initialTab === "approvals" ? "approvals" : "orders");
  return <PurchasingWorkspace tab={tab} setTab={setTab} />;
}

function PurchasingWorkspace({ tab, setTab }: { tab: "orders" | "approvals"; setTab: (t: "orders" | "approvals") => void }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [createQuoteOpen, setCreateQuoteOpen] = useState(false);
  const [reviewOrderOpen, setReviewOrderOpen] = useState<{ id: string; action: "approve" | "deny" } | null>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [pos, ords] = await Promise.all([provider.getPurchaseOrders(), provider.getOrders()]);
        if (active) { setPurchaseOrders(pos); setOrders(ords); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load purchasing data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadData();
    return () => { active = false; };
  }, []);

  async function decidePurchaseOrder(id: string, action: "approve" | "deny") {
    setIsSaving(true);
    setError("");
    try {
      await provider.decidePurchaseOrder(id, action);
      const payload = await provider.getOrders();
      setOrders(payload);
      setReviewOrderOpen(null);
      setMessage(`Mock purchase workflow ${id} ${action === "approve" ? "approved" : "denied"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase-order decision failed");
    } finally {
      setIsSaving(false);
    }
  }

  function exportApprovalLog() {
    downloadCsv("amzsphere-approval-log.csv", [
      ["Type", "ID", "Product", "Supplier", "Status", "Created"],
      ...orders.map((order) => ["Purchase order", order.id, order.product_name, order.supplier, order.status, order.reviewed_at || ""]),
    ]);
    setMessage(`Exported ${orders.length} mock approval records to CSV.`);
  }

  return (
    <main className="workspace-page bg-canvas">
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <PackageSearch size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>Supply Chain</span>
            <span className="text-xs text-muted">/</span>
            <span>Purchasing &amp; Suppliers</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Purchasing &amp; Suppliers</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Manage sample purchase orders and review pending purchase-order decisions. All flows are simulated in local mock state.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Mock procurement data</span>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}

      <div className="metrics metrics-five mb-6">
        <Metric label="Purchase Orders" value={purchaseOrders.length.toLocaleString()} detail="Sample PO records" accent="blue" tag="MOCK DATA" />
        <Metric label="Pending Approvals" value={orders.filter((o) => o.status === "pending").length.toLocaleString()} detail="Awaiting decision" accent="amber" tag="QUEUE" />
        <Metric label="Approved" value={orders.filter((o) => o.status === "approved").length.toLocaleString()} detail="Mock approval decisions" accent="teal" tag="DONE" />
        <Metric label="Denied" value={orders.filter((o) => o.status === "denied").length.toLocaleString()} detail="Mock denial decisions" accent="rose" tag="CLOSED" />
      </div>

      <div className="flex gap-2 mb-6">
        <button
          role="tab"
          aria-selected={tab === "orders"}
          onClick={() => setTab("orders")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${tab === "orders" ? "bg-[#4338CA] text-white" : "text-slate-400 hover:bg-[#111827] hover:text-white"}`}
        >
          <ClipboardList size={14} className="mr-2" aria-hidden="true" /> Purchase Orders
        </button>
        <button
          role="tab"
          aria-selected={tab === "approvals"}
          onClick={() => setTab("approvals")}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${tab === "approvals" ? "bg-[#4338CA] text-white" : "text-slate-400 hover:bg-[#111827] hover:text-white"}`}
        >
          <ShieldAlert size={14} className="mr-2" aria-hidden="true" /> Approvals
        </button>
      </div>

      {tab === "orders" && (
        <Card className="mb-6">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <h2 className="panel-title">Purchase Orders</h2>
              <div className="panel-subtitle">Sample purchase-order records from local mock state.</div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3">PO ID</th>
                    <th scope="col" className="px-4 py-3">Product</th>
                    <th scope="col" className="px-4 py-3">Supplier</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Units</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center text-xs text-muted py-4">Loading purchase orders…</td></tr>
                  ) : purchaseOrders.length ? purchaseOrders.map((po) => (
                    <tr key={po.id} className="border-t border-line">
                      <td className="px-4 py-3 font-semibold text-indigo-950">{po.id}</td>
                      <td className="px-4 py-3">{po.product_name}</td>
                      <td className="px-4 py-3">{po.supplier}</td>
                      <td className="px-4 py-3 tabular-nums">{po.units.toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge className="bg-amber-50 text-amber-800 border-amber-200">{po.status}</Badge></td>
                      <td className="px-4 py-3 text-[10px] text-muted">{new Date(po.created_at).toLocaleDateString()}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="text-center text-xs text-muted py-4">No purchase orders in mock state.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "approvals" && (
        <>
          <Card className="mb-6">
            <CardHeader className="flex items-center justify-between pb-2">
              <div>
                <h2 className="panel-title">Purchase-Order Decisions</h2>
                <div className="panel-subtitle">Review and decide pending purchase workflows. Approval records the decision in local mock state only.</div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3">Workflow ID</th>
                      <th scope="col" className="px-4 py-3">Product</th>
                      <th scope="col" className="px-4 py-3">Supplier</th>
                      <th scope="col" className="px-4 py-3 tabular-nums">Units</th>
                      <th scope="col" className="px-4 py-3 tabular-nums">Amount</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading approvals…</td></tr>
                    ) : orders.length ? orders.map((order) => (
                      <tr key={order.id} className="border-t border-line">
                        <td className="px-4 py-3 font-semibold text-indigo-950">{order.id}</td>
                        <td className="px-4 py-3">{order.product_name}</td>
                        <td className="px-4 py-3">{order.supplier}</td>
                        <td className="px-4 py-3 tabular-nums">{order.units.toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums">${order.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {order.status === "pending" ? (
                            <Badge className="bg-amber-50 text-amber-800 border-amber-200">{order.status}</Badge>
                          ) : order.status === "approved" ? (
                            <Badge className="bg-teal-50 text-teal-800 border-teal-200">{order.status}</Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-800 border-rose-200">{order.status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {order.status === "pending" ? (
                            <div className="flex gap-1">
                              <Button variant="outline" disabled={isSaving} onClick={() => setReviewOrderOpen({ id: order.id, action: "approve" })}>
                                Approve
                              </Button>
                              <Button variant="outline" disabled={isSaving} onClick={() => setReviewOrderOpen({ id: order.id, action: "deny" })}>
                                Deny
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted">Decided</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No purchase-order decisions awaiting review.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader className="flex items-center justify-between pb-2">
              <div>
                <h2 className="panel-title">B2B Custom Quote Flow</h2>
                <div className="panel-subtitle">Create a custom price quote draft for B2B buyers requiring volume discounts and negotiated terms.</div>
              </div>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreateQuoteOpen(true)}>
                + Create Custom Quote Draft
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4 text-xs text-muted">
                <div className="p-3 rounded-md border border-line bg-indigo-50">
                  <div className="text-[10px] font-bold text-indigo-800 mb-1">Mock workflow</div>
                  <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                    <li>Create custom price quote drafts</li>
                    <li>Apply volume discount curves</li>
                    <li>Validate margin floor (18.5% hard cap)</li>
                    <li>Route to approver for signoff</li>
                  </ul>
                </div>
                <p>Quote drafts are simulated in local mock state. No external B2B or Amazon Business service is contacted.</p>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={exportApprovalLog} className="mb-6">
            <FileText size={13} className="mr-2" aria-hidden="true" /> Download Approval Log (CSV)
          </Button>
        </>
      )}

      <p className="text-right text-[10px] text-muted">
        Purchase orders and approval decisions are simulated from local sample data. No vendor, EDI, or external service is contacted.
      </p>

      {reviewOrderOpen && (
        <Modal open={true} onClose={() => setReviewOrderOpen(null)} title="Review Purchase-Order Decision">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Decision Confirmation</div>
              <div className="text-[10px] text-muted mb-3">Confirm this local mock decision. Approval does not transmit an order to an external vendor or EDI.</div>
              <div className="p-3 rounded-md border border-line bg-white/50">
                <div className="text-[10px] font-bold text-on-surface mb-1">Workflow ID</div>
                <div className="text-xs font-semibold text-indigo-900">{reviewOrderOpen.id}</div>
                <div className="text-[10px] font-bold text-on-surface mt-2">Decision</div>
                <div className="text-xs font-semibold text-indigo-900">{reviewOrderOpen.action}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setReviewOrderOpen(null)}>Cancel</Button>
              <Button disabled={isSaving} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void decidePurchaseOrder(reviewOrderOpen.id, reviewOrderOpen.action); }}>
                {isSaving ? "Saving…" : "Confirm Mock Decision"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={createQuoteOpen} onClose={() => setCreateQuoteOpen(false)} title="Create Custom Quote Draft — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Custom Quote Configuration</div>
            <div className="text-[10px] text-muted mb-3">Create a custom price quote draft for B2B buyers requiring volume discounts and negotiated terms.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Buyer / Organization</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Apex Medical Logistics" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Quote Amount ($)</label>
                <input type="number" step="0.01" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="14630.00" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">ASIN / Product</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="B09YW72KB8L · Solar Power Pod Pro 50W" />
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Create custom price quote drafts</li>
              <li>Apply volume discount curves</li>
              <li>Validate margin floor (18.5% hard cap)</li>
              <li>Route to approver for signoff</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateQuoteOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCreateQuoteOpen(false); setMessage("Custom quote draft created and queued for approval."); }}>Create Quote Draft</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
