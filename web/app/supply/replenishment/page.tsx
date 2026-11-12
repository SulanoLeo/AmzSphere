"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { InventoryScanResult, Product } from "@/lib/provider/types";
import { useAmzStore } from "@/lib/useAmzStore";

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

export default function ReplenishmentPage() {
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scanResult, setScanResult] = useState<InventoryScanResult | null>(null);
  const [reorderScope, setReorderScope] = useState<"all" | "critical" | "watch">("all");
  const [bufferDays, setBufferDays] = useState("15");
  const [leadTimeDays, setLeadTimeDays] = useState("21");
  const [purchaseOrderQuantity, setPurchaseOrderQuantity] = useState("1");
  const [createPOOpen, setCreatePOOpen] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [calculateReorderOpen, setCalculateReorderOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts({ page_size: 200 });
        if (active) hydrateProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load replenishment data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [hydrateProducts]);

  const lowStock = products.filter((product) => product.daysSupply < 15);

  async function calculateReorder() {
    setIsSaving(true);
    setError("");
    try {
      const result = await provider.runInventoryScan("mock-seller", {
        buffer_days: Number(bufferDays),
        lead_time_days: Number(leadTimeDays),
        scope: reorderScope,
      });
      const refreshed = await provider.getProducts();
      hydrateProducts(refreshed.products);
      setScanResult(result);
      setMessage(`Mock scan complete: ${result.restock_proposal_count} reorder proposals across ${result.products_scanned} sample SKUs.`);
      setCalculateReorderOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not calculate mock reorder quantities.");
    } finally {
      setIsSaving(false);
    }
  }

  function openPurchaseOrder(asin: string) {
    const product = products.find((item) => item.asin === asin);
    const targetUnits = product
      ? Math.max(1, Math.ceil(product.daily_velocity * (product.lead_time_days + 15) - product.stockLevel))
      : 1;
    setPurchaseOrderQuantity(String(targetUnits));
    setCreatePOOpen(asin);
  }

  async function createPurchaseOrder() {
    if (!createPOOpen) return;
    setIsSaving(true);
    setError("");
    try {
      const order = await provider.addPurchaseOrder({
        product_asin: createPOOpen,
        units: Number(purchaseOrderQuantity),
      });
      setMessage(`Mock purchase order ${order.id} saved as a draft for ${order.units.toLocaleString()} units.`);
      setCreatePOOpen(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save purchase-order draft.");
    } finally {
      setIsSaving(false);
    }
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
            <span>Replenishment</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Replenishment</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <Truck size={12} className="mr-1" />
            Mock reorder simulator: Ready
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Reorder proposals and stockout risk calculated from sample velocity, lead time, and buffer values.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Sample replenishment</span>
          </div>
          <Button variant="outline" onClick={() => setCalculateReorderOpen(true)}>
            Calculate Reorder Quantities
          </Button>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}
      {scanResult && (
        <section className="mb-6 rounded-lg border border-line bg-white p-4" aria-labelledby="reorder-proposals-heading">
          <h2 id="reorder-proposals-heading" className="text-sm font-semibold text-on-surface">Latest mock reorder proposals</h2>
          {scanResult.restock_proposals.length ? (
            <ul className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {scanResult.restock_proposals.map((proposal) => (
                <li key={proposal.asin} className="rounded border border-line bg-canvas p-2">
                  <span className="font-semibold">{proposal.name}</span>
                  <span className="block text-muted">{proposal.restock_qty.toLocaleString()} units · estimated ${proposal.est_restock_cost_usd.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-muted">No sample SKUs need a reorder.</p>}
        </section>
      )}

      <div className="metrics metrics-five mb-6">
        <Metric label="Critical Stock" value={`${lowStock.length} SKUs`} detail="Under 15 days of sample supply" accent="rose" tag="REORDER REVIEW" />
        <Metric label="Proposals" value={(scanResult?.restock_proposal_count ?? 0).toLocaleString()} detail="From latest mock scan" accent="teal" tag="SAMPLE" />
        <Metric label="Estimated Restock Cost" value={`$${(scanResult?.total_est_restock_cost_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} detail="Calculated from sample unit landed cost" accent="blue" tag="MOCK COGS" />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Stockout danger list</h2>
            <div className="panel-subtitle">SKUs under 15 days of sample supply are candidates for a purchase-order draft.</div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table aria-busy={loading} className="w-full text-left text-xs">
              <caption className="sr-only">Low-stock sample SKUs and reorder actions</caption>
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">ASIN</th>
                  <th scope="col" className="px-4 py-3">SKU</th>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Stock</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Days supply</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Velocity / day</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading inventory…</td></tr>
                ) : lowStock.length ? lowStock.map((product) => (
                  <tr key={product.asin} className="border-t border-line">
                    <td className="px-4 py-3 text-left">{product.asin}</td>
                    <td className="px-4 py-3">{product.sku}</td>
                    <td className="px-4 py-3">{product.title}</td>
                    <td className="px-4 py-3 tabular-nums">{product.stockLevel}</td>
                    <td className="px-4 py-3 tabular-nums">{Number.isFinite(product.daysSupply) ? product.daysSupply.toFixed(1) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{product.daily_velocity}</td>
                    <td className="px-4 py-3">
                      <Button variant="outline" onClick={() => openPurchaseOrder(product.asin)} disabled={isSaving}>
                        Create PO
                      </Button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No SKUs are currently under 15 days of supply.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        Replenishment proposals and PO drafts are simulated from local sample data. No vendor or approval service is contacted.
      </p>

      {createPOOpen && (
        <Modal open={true} onClose={() => setCreatePOOpen(null)} title="Create Purchase Order">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">PO Details</div>
              <div className="text-[10px] text-muted mb-3">Save a sample purchase-order draft in local mock state.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">ASIN</label>
                  <span className="text-xs text-on-surface">{createPOOpen}</span>
                </div>
                <div>
                  <label htmlFor="purchase-order-quantity" className="text-[10px] font-bold text-muted block mb-1">Quantity</label>
                  <input id="purchase-order-quantity" type="number" min="1" step="1" value={purchaseOrderQuantity} onChange={(event) => setPurchaseOrderQuantity(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-amber-50">
              <div className="text-[10px] font-bold text-amber-800 mb-1">Mock workflow</div>
              <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                <li>Draft POs for below-threshold SKUs</li>
                <li>Quantity starts from the sample demand estimate</li>
                <li>Draft is held in temporary mock state</li>
                <li>No vendor or approval service is contacted</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreatePOOpen(null)}>Cancel</Button>
              <Button disabled={isSaving || !Number.isInteger(Number(purchaseOrderQuantity)) || Number(purchaseOrderQuantity) <= 0} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void createPurchaseOrder(); }}>{isSaving ? "Saving…" : "Create Mock PO Draft"}</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={calculateReorderOpen} onClose={() => setCalculateReorderOpen(false)} title="Calculate Reorder Quantities — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Reorder Calculation</div>
            <div className="text-[10px] text-muted mb-3">Calculate sample reorder quantities using mock velocity, lead time, and buffer values.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="buffer-days" className="text-[10px] font-bold text-muted block mb-1">Buffer Days</label>
                <input id="buffer-days" type="number" min="0" max="365" step="1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={bufferDays} onChange={(event) => setBufferDays(event.target.value)} />
              </div>
              <div>
                <label htmlFor="lead-time-days" className="text-[10px] font-bold text-muted block mb-1">Lead Time (days)</label>
                <input id="lead-time-days" type="number" min="0" max="365" step="1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="reorder-scope" className="text-[10px] font-bold text-muted block mb-1">Scope</label>
                <select id="reorder-scope" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]" value={reorderScope} onChange={(event) => setReorderScope(event.target.value as "all" | "critical" | "watch")}>
                  <option value="all">All low-stock SKUs</option>
                  <option value="critical">Critical only (&lt;15 days)</option>
                  <option value="watch">Watch only (15–30 days)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Calculate proposals from each SKU's sample velocity</li>
              <li>Apply the lead-time and buffer days above</li>
              <li>Review the resulting reorder proposals below</li>
              <li>Create separate local purchase-order drafts as needed</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCalculateReorderOpen(false)}>Cancel</Button>
            <Button disabled={isSaving || !Number.isInteger(Number(bufferDays)) || Number(bufferDays) < 0 || Number(bufferDays) > 365 || !Number.isInteger(Number(leadTimeDays)) || Number(leadTimeDays) < 0 || Number(leadTimeDays) > 365} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void calculateReorder(); }}>{isSaving ? "Calculating…" : "Calculate Reorder"}</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
