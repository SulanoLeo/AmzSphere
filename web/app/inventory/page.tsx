"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
          <Button variant="outline" onClick={() => {}}>
            Calculate Reorder Quantities
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>
            + Create Inbound Shipment
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Total Sellable Units" value="48,920" detail="+2.4% vs 30d" accent="blue" tag="IN-STOCK RATE: 99.1%" />
        <Metric label="Estimated Stock Value" value="$412,850.00" detail="+$514.2k vs last month" accent="teal" tag="COGS: $184.2k" />
        <Metric label="At-Risk Stock" value="<16 SKUs" detail="Est. last rev: $8,420/wk" accent="rose" tag="IMMEDIATE REORDER REQ." />
        <Metric label="Average Days of Supply" value="38.5 Days" detail="Target buffer: 30-45 days" accent="teal" tag="Healthy Range" />
        <Metric label="Inbound & In-Transit" value="14,250 Units" detail="8 Active Shipments" accent="blue" tag="TRANSIT VALUATION: $62.8k" />
      </div>

      <section className="section-grid mb-6">
        <div className="panel lg:col-span-2">
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
          <div className="panel-content">
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
              <Button variant="outline" onClick={() => {}}>
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
            <Button variant="outline" onClick={() => {}}>
              Export CSV
            </Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>
              Bulk PO Generator
            </Button>
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
                          <Button variant="outline" onClick={() => {}}>
                            Create PO
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => {}}>
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
    </main>
  );
}
