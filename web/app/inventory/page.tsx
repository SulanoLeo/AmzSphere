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
      <div className={`metric-accent ${accent}`}></div>
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
  const [shipmentDrafts, setShipmentDrafts] = useState<Array<{
    id: string;
    name: string;
    source: string;
    destination: string;
    createdAt: string;
  }>>([]);
  const [shipmentName, setShipmentName] = useState("");
  const [shipmentSource, setShipmentSource] = useState("");
  const [shipmentDestination, setShipmentDestination] = useState("ONT8 (Moreno Valley, CA)");
  const [purchaseOrderQuantity, setPurchaseOrderQuantity] = useState("1");
  const [maxStockValue, setMaxStockValue] = useState("5000");
  const [bufferDays, setBufferDays] = useState("15");
  const [leadTimeDays, setLeadTimeDays] = useState("21");
  const [reorderScope, setReorderScope] = useState<"all" | "critical" | "watch">("all");
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [calculateReorderOpen, setCalculateReorderOpen] = useState(false);
  const [createShipmentOpen, setCreateShipmentOpen] = useState(false);
  const [viewManifestsOpen, setViewManifestsOpen] = useState(false);
  const [createPOOpen, setCreatePOOpen] = useState<string | null>(null);
  const [adjustMaxOpen, setAdjustMaxOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const [payload, ppc] = await Promise.all([
          provider.getProducts({ page_size: 200 }),
          provider.getPpcData(),
        ]);
        if (active) hydrateProducts(payload.products, ppc.campaigns);
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
      ? Math.max(1, Math.ceil(product.daily_velocity * (product.lead_time_days + 15) - product.stock))
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

  function createShipmentDraft() {
    const id = `SHIP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const draft = {
      id,
      name: shipmentName.trim() || "Untitled shipment",
      source: shipmentSource.trim() || "Unspecified warehouse",
      destination: shipmentDestination,
      createdAt: new Date().toLocaleString(),
    };
    setShipmentDrafts((existing) => [draft, ...existing]);
    setMessage(`Mock shipment draft ${id} created locally. No shipment was sent to Amazon.`);
    setCreateShipmentOpen(false);
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
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <PackageSearch size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>Logistics &amp; Supply Chain</span>
            <span className="text-xs text-muted">/</span>
            <span>Inventory Hub</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Inventory Hub</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <ChartNoAxesCombined size={12} className="mr-1" />
            Mock Replenishment Simulator: Ready
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Sample stock, velocity, and reorder proposals calculated from the local mock catalog.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Sample stock</span>
          </div>
          <Button variant="outline" onClick={() => setCalculateReorderOpen(true)}>
            Calculate Reorder Quantities
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreateShipmentOpen(true)}>
            + Create Inbound Shipment
          </Button>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" aria-live="polite" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}
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
        <Metric label="Shipment Drafts" value={shipmentDrafts.length.toLocaleString()} detail="Local demo drafts only" accent="blue" tag="NO AMAZON SUBMISSION" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel lg:col-span-2 flex flex-col h-full">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Inventory Runway &amp; Stockout Risk Forecasting</h2>
              <div className="panel-subtitle">Predictive depletion curves across next 60 days based on 7d/30d velocity and seasonal surge indexing.</div>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">All Catalog</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Top 20 Velocity</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Seasonal Bundles</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Hazardous</Badge>
            </div>
          </div>
          <div className="panel-content min-h-full flex-1">
            <div className="h-64 w-full">
              <div className="grid h-full place-items-center text-sm text-muted">No inventory history ingested yet.</div>
            </div>
            <div className="mt-3 flex items-center gap-4 p-3 rounded-md bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-on-surface">Burn Velocity: 1,248 units/day</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs text-on-surface">3 high-velocity ASINs entering critical reorder window in next 7 days</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Fulfillment &amp; Warehouse</h2>
                <div className="panel-subtitle">3 Facilities · Active</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Stock Allocation by Node</span>
                  <div className="w-20 h-1 bg-canvas rounded-full overflow-hidden">
                    <div className="h-full bg-teal-700" style={{ width: "69.7%" }} />
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: "20.8%" }} />
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: "10.2%" }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">FBA Fulfillment Centers</span>
                  <span className="text-on-surface tabular-nums">34,120 u · 69.7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">3PL Logistics Hub (West Coast)</span>
                  <span className="text-on-surface tabular-nums">9,800 u · 20.8%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Supplier Factory Floor (WIP)</span>
                  <span className="text-on-surface tabular-nums">5,000 u · 10.2%</span>
                </div>
                <div className="border-t border-line mt-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">FBA Cubic Storage Capacity</span>
                    <span className="text-on-surface">74% Utilized</span>
                  </div>
                  <div className="h-1 bg-canvas rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: "74%" }} />
                  </div>
                  <div className="text-[10px] text-muted">Current: 37,000 cu ft · Limit: 50,000 cu ft</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Inbound Shipment Pipeline &amp; FBA Receiving Queue</h2>
                <div className="panel-subtitle">Active Inflow: 14,250 Units across 8 Shipments</div>
              </div>
              <Button variant="outline" onClick={() => setViewManifestsOpen(true)}>
                View Flight Manifests
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-3 rounded-md border border-line bg-white/50">
                  <div className="text-[10px] text-muted mb-1">FBA-INB-99412</div>
                  <div className="text-xs font-semibold text-indigo-900">3PL West → ONT8 (Moreno Valley)</div>
                  <div className="text-[10px] text-muted">LTL Carrier: Estes Express (BOL #882103)</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-semibold">In Transit</span>
                    <div className="text-[10px] font-semibold text-on-surface">ETA: Nov 03</div>
                  </div>
                </div>
                <div className="p-3 rounded-md border border-line bg-white/50">
                  <div className="text-[10px] text-muted mb-1">FBA-INB-88301</div>
                  <div className="text-xs font-semibold text-indigo-900">Yantian Port → Long Beach (Ocean)</div>
                  <div className="text-[10px] text-muted">Port Departure: Ever Glory / Matsou CLX</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">Customs Clearance</span>
                    <div className="text-[10px] font-semibold text-on-surface">ETA: Nov 12</div>
                  </div>
                </div>
                <div className="p-3 rounded-md border border-line bg-white/50">
                  <div className="text-[10px] text-muted mb-1">FBA-INB-10462</div>
                  <div className="text-xs font-semibold text-indigo-900">Factory → SBDI (San Bernardino)</div>
                  <div className="text-[10px] text-muted">Air Express Direct (DHL Airlift #9021)</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-semibold">Receiving</span>
                    <div className="text-[10px] font-semibold text-on-surface">(85%)</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Inventory Health &amp; Replenishment Matrix</h2>
            <div className="panel-subtitle">Replenishment calculation including trailing 30d run rate, lead-time buffers, and inbound freight confirmations.</div>
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
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCalculateReorderOpen(true)}>Bulk PO Generator</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Sample inventory stock levels and reorder actions</caption>
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Product Details</th>
                  <th scope="col" className="px-4 py-3">Available Stock</th>
                  <th scope="col" className="px-4 py-3">Velocity</th>
                  <th scope="col" className="px-4 py-3">Runway</th>
                  <th scope="col" className="px-4 py-3">Inbound Suggestion</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">PPC ads</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center text-xs text-muted py-4">Loading inventory…</td></tr>
                ) : visibleProducts.length ? visibleProducts.map((product) => {
                  const days = product.daysSupply;
                  const fill = Math.min(100, (days / 45) * 100);
                  const tone = days < 15 ? "warn" : days < 30 ? "pending" : "good";
                  return (
                    <tr key={product.asin} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span> · Electronics</div>
                      </td>
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
                          <>
                            <div className="text-[10px] font-semibold text-on-surface">2,500 u · COO Model</div>
                            <div className="text-[10px] text-muted">Reorder Triggered</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-muted">Suggested Cap met</div>
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
                        {days < 15 ? (
                          <Button variant="outline" onClick={() => openPurchaseOrder(product.asin)}>
                            Create PO
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => {
                            setMaxStockValue(String(product.max_stock ?? 5000));
                            setAdjustMaxOpen(product.asin);
                          }}>
                            Adjust Max
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8} className="text-center text-xs text-muted py-4">No products match this stock filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing {visibleProducts.length} of {products.length} sample SKUs</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        Inventory scan and stock metrics are simulated from local sample data. No Amazon shipment or inventory request is sent.
      </p>

      {/* Modals */}
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

      <Modal open={createShipmentOpen} onClose={() => setCreateShipmentOpen(false)} title="Create Inbound Shipment — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Inbound Shipment</div>
            <div className="text-[10px] text-muted mb-3">Create a local sample shipment draft. This does not submit anything to Amazon.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="shipment-name" className="text-[10px] font-bold text-muted block mb-1">Shipment Name</label>
                <input id="shipment-name" value={shipmentName} onChange={(event) => setShipmentName(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Q4 Holiday Replenishment" />
              </div>
              <div>
                <label htmlFor="shipment-source" className="text-[10px] font-bold text-muted block mb-1">Ship From</label>
                <input id="shipment-source" value={shipmentSource} onChange={(event) => setShipmentSource(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Warehouse West" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="shipment-destination" className="text-[10px] font-bold text-muted block mb-1">Mock Ship To</label>
                <select id="shipment-destination" value={shipmentDestination} onChange={(event) => setShipmentDestination(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>ONT8 (Moreno Valley, CA)</option>
                  <option>SBDI (San Bernardino, CA)</option>
                  <option>Other FBA center</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Record a draft in this page's temporary state</li>
              <li>Review the destination selected above</li>
              <li>Drafts are cleared when the page is refreshed</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateShipmentOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={createShipmentDraft}>Create Mock Draft</Button>
          </div>
        </div>
      </Modal>

      <Modal open={viewManifestsOpen} onClose={() => setViewManifestsOpen(false)} title="Flight Manifests — View">
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-line bg-white/50">
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Local shipment drafts</div>
            {shipmentDrafts.length ? (
              <ul className="mb-3 space-y-2" aria-label="Local shipment drafts">
                {shipmentDrafts.map((draft) => (
                  <li key={draft.id} className="rounded border border-line bg-white p-2">
                    <div className="text-[10px] text-muted">{draft.id} · Created {draft.createdAt}</div>
                    <div className="text-xs font-semibold text-indigo-900">{draft.name}</div>
                    <div className="text-[10px] text-muted">{draft.source} → {draft.destination}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-[10px] text-muted">No drafts created in this page session yet.</p>
            )}
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Static sample shipment records</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="p-2 rounded border border-line bg-white">
                <div className="text-[10px] text-muted mb-1">FBA-INB-99412</div>
                <div className="text-xs font-semibold text-indigo-900">3PL West → ONT8</div>
                <div className="text-[10px] text-muted">ETA: Nov 03 · In Transit</div>
              </div>
              <div className="p-2 rounded border border-line bg-white">
                <div className="text-[10px] text-muted mb-1">FBA-INB-88301</div>
                <div className="text-xs font-semibold text-indigo-900">Yantian Port → Long Beach</div>
                <div className="text-[10px] text-muted">ETA: Nov 12 · Customs Clearance</div>
              </div>
              <div className="p-2 rounded border border-line bg-white">
                <div className="text-[10px] text-muted mb-1">FBA-INB-10462</div>
                <div className="text-xs font-semibold text-indigo-900">Factory → SBDI</div>
                <div className="text-[10px] text-muted">Receiving (85%)</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setViewManifestsOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

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
