"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import { downloadCsv } from "@/lib/csv";
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

export default function InventoryPage() {
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const upsertProducts = useAmzStore((state) => state.upsertProducts);
  const togglePpcStatus = useAmzStore((state) => state.togglePpcStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [scanResult, setScanResult] = useState<InventoryScanResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [adjustMaxOpen, setAdjustMaxOpen] = useState<string | null>(null);
  const [maxStockValue, setMaxStockValue] = useState("5000");

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts({ page_size: 200 });
        if (active) hydrateProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load inventory");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [hydrateProducts]);

  const lowStock = products.filter((product) => product.daysSupply < 15);
  const totalStock = products.reduce((sum, product) => sum + product.stockLevel, 0);
  const stockValue = products.reduce((sum, product) => sum + product.stockLevel * product.unit_cost, 0);
  const productsWithFiniteSupply = products.filter((product) => Number.isFinite(product.daysSupply));
  const averageSupply = productsWithFiniteSupply.length
    ? productsWithFiniteSupply.reduce((sum, product) => sum + product.daysSupply, 0) / productsWithFiniteSupply.length
    : 0;
  const visibleProducts = products.filter((product) => {
    const days = product.daysSupply;
    if (stockFilter === "critical") return days < 15;
    if (stockFilter === "watch") return days >= 15 && days < 30;
    if (stockFilter === "healthy") return days >= 30;
    return true;
  });

  async function saveMaxStock() {
    if (!adjustMaxOpen) return;
    setIsSaving(true);
    setError("");
    try {
      const updatedProduct = await provider.updateProduct(adjustMaxOpen, { max_stock: Number(maxStockValue) });
      upsertProducts([updatedProduct]);
      setMessage(`Mock maximum stock updated for ${adjustMaxOpen}.`);
      setAdjustMaxOpen(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update maximum stock.");
    } finally {
      setIsSaving(false);
    }
  }

  function exportInventory() {
    downloadCsv("amzsphere-inventory.csv", [
      ["ASIN", "SKU", "Product", "Stock", "Daily velocity", "Days of supply", "Status"],
      ...products.map((product) => {
        const days = product.daysSupply;
        return [
          product.asin,
          product.sku,
          product.name,
          product.stockLevel,
          product.daily_velocity,
          days.toFixed(1),
          days < 15 ? "Critical" : days < 30 ? "Watch" : "Optimal",
        ];
      }),
    ]);
    setMessage(`Exported ${products.length} sample inventory rows to CSV.`);
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
            <span>Inventory</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Inventory</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <ChartNoAxesCombined size={12} className="mr-1" />
            Mock inventory simulator: Ready
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Sample stock levels and inventory list calculated from the local mock catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Sample stock</span>
          </div>
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
        <Metric label="Total Sample Stock" value={totalStock.toLocaleString()} detail={`Across ${products.length} sample SKUs`} accent="blue" tag="MOCK DATA" />
        <Metric label="Estimated Stock Cost" value={`$${stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} detail="Calculated from sample unit costs" accent="teal" tag="MOCK COGS" />
        <Metric label="Critical Stock" value={`${lowStock.length} SKUs`} detail="Under 15 days of sample supply" accent="rose" tag="REORDER REVIEW" />
        <Metric label="Average Days of Supply" value={productsWithFiniteSupply.length ? `${averageSupply.toFixed(1)} Days` : "—"} detail="Computed from local stock and velocity" accent="teal" tag="SAMPLE" />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Inventory list</h2>
            <div className="panel-subtitle">Sample inventory stock levels and reorder actions.</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">
              Stock status
              <select aria-label="Filter inventory by stock status" className="h-9 rounded-md border border-line bg-white px-2" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="critical">Critical</option>
                <option value="watch">Watch</option>
                <option value="healthy">Healthy</option>
              </select>
            </label>
            <Button variant="outline" onClick={exportInventory}>Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table aria-busy={loading} className="w-full text-left text-xs">
              <caption className="sr-only">Sample inventory stock levels and reorder actions</caption>
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Product Details</th>
                  <th scope="col" className="px-4 py-3">Available Stock</th>
                  <th scope="col" className="px-4 py-3">Velocity</th>
                  <th scope="col" className="px-4 py-3">Runway</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">PPC ads</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading inventory…</td></tr>
                ) : visibleProducts.length ? visibleProducts.map((product) => {
                  const days = product.daysSupply;
                  const fill = Math.min(100, (days / 45) * 100);
                  const tone = days < 15 ? "warn" : days < 30 ? "pending" : "good";
                  return (
                    <tr key={product.asin} className="border-t border-line">
                      <th scope="row" className="px-4 py-3 text-left">
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span> · Electronics</div>
                      </th>
                      <td className="px-4 py-3 tabular-nums">
                        <div className="stock-cell">
                          <div className="stock-number"><span>{product.stockLevel} units</span><span>{days.toFixed(1)}d</span></div>
                          <div className="stock-track"><div className={`stock-fill ${tone}`} style={{ width: `${fill}%` }} /></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{product.daily_velocity} / day</td>
                      <td className="px-4 py-3 tabular-nums">
                        {days < 15 ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-2 py-0.5 text-[10px]">{days.toFixed(0)} Days</span>
                        ) : days < 30 ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[10px]">{days.toFixed(0)} Days</span>
                        ) : (
                          <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5 text-[10px]">{days.toFixed(0)} Days</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {days < 15 ? (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200">Critical</Badge>
                        ) : days < 30 ? (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200">Watch</Badge>
                        ) : (
                          <Badge className="bg-teal-50 text-teal-800 border-teal-200">Optimal</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.adStatus === "inactive" ? (
                          <span className="text-[10px] text-muted">No active campaign</span>
                        ) : (
                          <div className="flex flex-col items-start gap-2">
                            <span className={`status ${product.adStatus === "active" ? "good" : "pending"}`}>
                              {product.adStatus === "active" ? "Active" : "Paused"}
                            </span>
                            <button
                              className="rounded-md border border-muted px-2 py-1 text-[10px] font-semibold text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                              type="button"
                              onClick={() => {
                                togglePpcStatus(product.sku);
                                setMessage(`Mock ads ${product.adStatus === "active" ? "paused" : "resumed"} for ${product.sku}.`);
                              }}
                            >
                              {product.adStatus === "active" ? "Pause ads" : "Resume ads"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" onClick={() => {
                          setMaxStockValue(String(product.max_stock ?? 5000));
                          setAdjustMaxOpen(product.asin);
                        }}>
                          Adjust Max
                        </Button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No products match this stock filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span role="status" aria-live="polite" aria-atomic="true">
              Showing {visibleProducts.length} of {products.length} sample SKUs
            </span>
          </div>
        </CardContent>
      </Card>

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-xs text-muted">No inventory data available.</p>
        </div>
      )}

      <p className="text-right text-[10px] text-muted">
        Inventory scan and stock metrics are simulated from local sample data. No Amazon shipment or inventory request is sent.
      </p>

      {adjustMaxOpen && (
        <Modal open={true} onClose={() => setAdjustMaxOpen(null)} title="Adjust Max Stock — Setup">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Stock Cap Adjustment</div>
              <div className="text-[10px] text-muted mb-3">Adjust the maximum stock suggestion for this SKU.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">ASIN</label>
                  <span className="text-xs text-on-surface">{adjustMaxOpen}</span>
                </div>
                <div>
                  <label htmlFor="max-stock-value" className="text-[10px] font-bold text-muted block mb-1">Max Units</label>
                  <input id="max-stock-value" type="number" min="0" step="1" value={maxStockValue} onChange={(event) => setMaxStockValue(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAdjustMaxOpen(null)}>Cancel</Button>
              <Button disabled={isSaving || !Number.isInteger(Number(maxStockValue)) || Number(maxStockValue) < 0} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void saveMaxStock(); }}>{isSaving ? "Saving…" : "Save Mock Adjustment"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
