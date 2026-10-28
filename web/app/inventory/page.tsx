"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ClientProductProvider } from "@/lib/provider/client";
import type { Product } from "@/lib/provider/types";

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
  const provider = new ClientProductProvider();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
        const payload = await provider.getProducts();
        if (active) setProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load inventory");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [provider]);

  const lowStock = products.filter((p) => (p.stock / Math.max(p.daily_velocity || 1, 1)) < 15);
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalVelocity = products.reduce((sum, p) => sum + p.daily_velocity, 0);

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
            Auto-Replenish Sentinel: Active
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Multi-channel FBA/FBM pipeline, SKU velocity tracking, low-stock forecasts &amp; warehouse transfer orchestration.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>7D</span>
            <span className="bg-indigo-600 text-white px-1.5 rounded text-[9px]">Last 30 Days</span>
            <span>90D</span>
            <span>Projection (60D)</span>
          </div>
          <Button variant="outline" onClick={() => setCalculateReorderOpen(true)}>
            Calculate Reorder Quantities
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreateShipmentOpen(true)}>
            + Create Inbound Shipment
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Total Sellable Units" value="48,920" detail="+2.4% vs 30d" accent="blue" tag="IN-STOCK RATE: 99.1%" />
        <Metric label="Estimated Stock Value" value="$412,850.00" detail="+$514.2k vs last month" accent="teal" tag="COGS: $184.2k" />
        <Metric label="At-Risk Stock" value="<16 SKUs" detail="Est. last rev: $8,420/wk" accent="rose" tag="IMMEDIATE REORDER REQ." />
        <Metric label="Average Days of Supply" value="38.5 Days" detail="Target buffer: 30-45 days" accent="teal" tag="Healthy Range" />
        <Metric label="Inbound &amp; In-Transit" value="14,250 Units" detail="8 Active Shipments" accent="blue" tag="TRANSIT VALUATION: $62.8k" />
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
            <span className="text-xs font-semibold text-muted">All Stock Statuses</span>
            <Button variant="outline" onClick={() => {}}>Export CSV</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCalculateReorderOpen(true)}>Bulk PO Generator</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">Product Details</th>
                  <th className="px-4 py-3">Available Stock</th>
                  <th className="px-4 py-3">Velocity</th>
                  <th className="px-4 py-3">Runway</th>
                  <th className="px-4 py-3">Inbound Suggestion</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center text-xs text-muted py-4">Loading inventory…</td></tr>
                ) : products.length ? products.map((product) => {
                  const days = product.stock / Math.max(product.daily_velocity || 1, 1);
                  const fill = Math.min(100, (days / 45) * 100);
                  const tone = days < 15 ? "warn" : days < 30 ? "pending" : "good";
                  return (
                    <tr key={product.asin} className="border-t border-line">
                      <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                      <td className="px-4 py-3">
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span> · Electronics</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <div className="stock-cell">
                          <div className="stock-number"><span>{product.stock} units</span><span>{days.toFixed(1)}d</span></div>
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
                        {days < 15 ? (
                          <Button variant="outline" onClick={() => setCreatePOOpen(product.asin)}>
                            Create PO
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => setAdjustMaxOpen(product.asin)}>
                            Adjust Max
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={8} className="text-center text-xs text-muted py-4">No products in catalog.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 5 of 1,428 tracked items</span>
            <div className="flex items-center gap-1">
              <button className="button button-outline button-sm disabled">Previous</button>
              <button className="button button-primary button-sm">1</button>
              <button className="button button-outline button-sm">2</button>
              <button className="button button-outline button-sm">3</button>
              <span className="px-2 text-[10px]">...</span>
              <button className="button button-outline button-sm">286</button>
              <button className="button button-outline button-sm">Next</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        AmzSphere High-Frequency Sentinel Protocol: 256-bit AES KMS SP-API Gated. Safe dry-run verified. · Region: US-EAST-1 · Node: Pod-FBA-04 · Latency: 18ms
      </p>

      {/* Modals */}
      <Modal open={calculateReorderOpen} onClose={() => setCalculateReorderOpen(false)} title="Calculate Reorder Quantities — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Reorder Calculation</div>
            <div className="text-[10px] text-muted mb-3">Calculate optimal reorder quantities based on trailing velocity, lead-time buffers, and inbound freight confirmations.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Buffer Days</label>
                <input type="number" step="1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="15" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Lead Time (days)</label>
                <input type="number" step="1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="21" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">Scope</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>All low-stock SKUs</option>
                  <option>Critical only (&lt;15 days)</option>
                  <option>Watch only (&lt;30 days)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Auto-calculate reorder quantities per SKU</li>
              <li>Factor in lead-time and buffer days</li>
              <li>Generate bulk purchase orders</li>
              <li>Export to CSV or send to vendor</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCalculateReorderOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCalculateReorderOpen(false); setMessage("Reorder quantities calculated and PO drafts generated."); }}>Calculate Reorder</Button>
          </div>
        </div>
      </Modal>

      <Modal open={createShipmentOpen} onClose={() => setCreateShipmentOpen(false)} title="Create Inbound Shipment — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Inbound Shipment</div>
            <div className="text-[10px] text-muted mb-3">Create a new inbound shipment to Amazon FBA fulfillment centers.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Shipment Name</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Q4 Holiday Replenishment" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Ship From</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Warehouse West" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">Ship To (FBA)</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
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
              <li>Create FBA inbound shipments via SP-API</li>
              <li>Generate shipment labels and BOLs</li>
              <li>Track receiving status in real-time</li>
              <li>Auto-adjust inventory on receiving</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateShipmentOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCreateShipmentOpen(false); setMessage("Inbound shipment created and queued for SP-API submission."); }}>Create Shipment</Button>
          </div>
        </div>
      </Modal>

      <Modal open={viewManifestsOpen} onClose={() => setViewManifestsOpen(false)} title="Flight Manifests — View">
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-line bg-white/50">
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Active Inbound Shipments</div>
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
              <div className="text-[10px] text-muted mb-3">Generate a purchase order draft for critical replenishment.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">ASIN</label>
                  <span className="text-xs text-on-surface">{createPOOpen}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Quantity</label>
                  <input type="number" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="2500" />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-amber-50">
              <div className="text-[10px] font-bold text-amber-800 mb-1">Capabilities</div>
              <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                <li>Draft POs for below-threshold SKUs</li>
                <li>Auto-calculate quantity based on velocity</li>
                <li>Route to approver for signoff</li>
                <li>Track PO status in activity log</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setCreatePOOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCreatePOOpen(null); setMessage(`PO draft created for ${createPOOpen}.`); }}>Create PO Draft</Button>
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
                  <label className="text-[10px] font-bold text-muted block mb-1">Max Units</label>
                  <input type="number" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="5000" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAdjustMaxOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setAdjustMaxOpen(null); setMessage(`Max stock adjusted for ${adjustMaxOpen}.`); }}>Save Adjustment</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
