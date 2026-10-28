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

export default function RepricerPage() {
  const provider = new ClientProductProvider();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [exportAuditOpen, setExportAuditOpen] = useState(false);
  const [createStrategyOpen, setCreateStrategyOpen] = useState(false);
  const [adjustFloorOpen, setAdjustFloorOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts();
        if (active) setProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load repricer data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [provider]);

  const last_updated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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
            <span>Algorithmic Pricing</span>
            <span className="text-xs text-muted">/</span>
            <span>Repricer Monitor</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Repricer Monitor &amp; Buy Box Sentinel</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-1.5 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              Algorithmic Engine: High-Frequency Active
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">Sub-sec · SP-API Events</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Competitive offers refresh every 10 seconds with a protected minimum margin floor.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>1H</span>
            <span className="bg-indigo-600 text-white px-1.5 rounded text-[9px]">24H</span>
            <span>30D</span>
            <span>Simulate Scenarios</span>
          </div>
          <Button variant="outline" onClick={() => setExportAuditOpen(true)}>
            Export Audit (CSV)
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCreateStrategyOpen(true)}>
            + Create Repricing Strategy
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Buy Box Ownership" value="94.2%" detail="+2.8% vs prev cycle" accent="teal" tag="Target: 96.2%" />
        <Metric label="Monitored SKUs" value="1,280 / 1,428" detail="89.6% Automated AS Coverage" accent="blue" tag="Manual" />
        <Metric label="Average Margin Achieved" value="26.4%" detail="+$1.40 Net Realized/unit" accent="green" tag="Optimal" />
        <Metric label="Daily Reprice Events" value="18,450" detail="Today" accent="blue" tag="Avg 14.4d" />
        <Metric label="At-Risk Price Wars" value="4" detail="Floors Engaged" accent="rose" tag="ASINs Engaged" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel lg:col-span-2 flex flex-col h-full">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Buy Box Price &amp; Velocity Dynamics</h2>
              <div className="panel-subtitle">Hourly tracking of AmzSphere Price, Lowest Buy Box Target, Competitor Floor. Buy Box Benchmark and Unit Sales Velocity.</div>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-teal-50 text-teal-800 border-teal-200">24h Live</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Price Telem</Badge>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200">All Reprice Strategies</Badge>
            </div>
          </div>
          <div className="panel-content min-h-full flex-1">
            <div className="h-64 w-full">
              <div className="grid h-full place-items-center text-sm text-muted">No price history ingested yet.</div>
            </div>
            <div className="mt-3 flex items-center gap-4 p-3 rounded-md bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-on-surface">Auto-Throttle Guard: Active. Zero runaway downward spirals detected in 72 hours.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-xs text-on-surface">Peak Hourly Conversion: 21 units @ $51.99</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Rule Profiles &amp; Safety</h2>
                <div className="panel-subtitle">3 Active</div>
              </div>
              <Button variant="outline" onClick={() => setCreateStrategyOpen(true)}>Create Rule Profile</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2 p-3 rounded-md border border-line bg-white/50">
                  <span className="text-xs font-semibold text-indigo-900">AI Profit Maximizer</span>
                  <div className="text-[10px] text-muted">Matches Buy Box winner with +$0.50 premium when Prime lead time is faster. Auto-raises price upon competitor stockout.</div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md border border-line bg-white/50">
                  <span className="text-xs font-semibold text-indigo-900">Velocity Liquidation</span>
                  <div className="text-[10px] text-muted">Dynamic 1% undercut down to break-even margin for aged inventory &gt;60 days in FBA storage.</div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md border border-line bg-white/50">
                  <span className="text-xs font-semibold text-indigo-900">Anti-Price-War Dampener</span>
                  <div className="text-[10px] text-muted">Pauses price drops when competitor executes 3 consecutive cuts in &lt;15 min to prevent price-loop outs.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Real-Time Reprice Event Policies</h2>
                <div className="panel-subtitle">Active</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Match Prime Competitors Only</span>
                  <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Auto-Raise on Competitor Stockout</span>
                  <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Strict 18.5% Margin Floor (Hard Lock)</span>
                  <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Locked</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Active Repricing Matrix &amp; Competitor Radar</h2>
            <div className="panel-subtitle">Live multi-offer radar, floor envelopes, algorithmic state, and real-time Buy Box retention metrics.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">All Statuses</span>
            <span className="text-xs font-semibold text-muted">▾ Bulk Edit Min/Max</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">Product Details &amp; SKU</th>
                  <th className="px-4 py-3">Our Price &amp; Buy Box</th>
                  <th className="px-4 py-3">Floors / Ceiling Limits</th>
                  <th className="px-4 py-3">Net Margin</th>
                  <th className="px-4 py-3">Competitor Landscape</th>
                  <th className="px-4 py-3">Strategy</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading offers…</td></tr>
                ) : products.length ? products.map((product) => {
                  const gap = product.price - product.competitor_price;
                  const position = gap <= 0 ? <span className="status good">At or below market</span> : <span className="status warn">Price opportunity</span>;
                  return (
                    <tr key={product.asin} className="border-t border-line">
                      <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                      <td className="px-4 py-3">
                        <div className="product-name">{product.name}</div>
                        <div className="product-meta">{product.sku} · <span className="asin">{product.asin}</span></div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="price">${product.price.toFixed(2)}</div>
                        <div className="sub-price">Your offer</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="price">${product.min_floor.toFixed(2)}</div>
                        <div className="sub-price">${product.max_price.toFixed(2)} ceiling</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{((product.price - product.unit_cost) / product.price * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="price">${product.competitor_price.toFixed(2)}</div>
                        <div className="sub-price">Lowest competitor</div>
                      </td>
                      <td className="px-4 py-3">
                        {position}
                        <div className="mt-1 text-[10px] text-muted">Floor: ${product.min_floor.toFixed(2)}</div>
                        <Button variant="outline" onClick={() => setAdjustFloorOpen(product.asin)} className="mt-1 text-[10px] px-2 py-0.5">Adjust Floor</Button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No offers monitored yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 1–5 of 1,280 Automated SKUs · Filtered from 1,428 catalog records</span>
            <div className="flex items-center gap-1">
              <button className="button button-outline button-sm disabled">Previous</button>
              <button className="button button-primary button-sm">1</button>
              <button className="button button-outline button-sm">2</button>
              <button className="button button-outline button-sm">3</button>
              <span className="px-2 text-[10px]">...</span>
              <button className="button button-outline button-sm">256</button>
              <button className="button button-outline button-sm">Next</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Real-Time Reprice Feed &amp; Competitor Interceptions</h2>
            <div className="panel-subtitle">Continuous SP-API Notification Stream (Sub-minute)</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-teal-50 text-teal-800 border-teal-200">WebSockets: Connected</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-96 overflow-y-auto border border-line rounded-md bg-[#0B0F19] p-3 font-mono text-[10px]">
            <div className="text-teal-400">[14:48:22.104] REDIS_OUTBOX · ACK event: amz.spa.pricing.patch hash=0x8f7a2b ASIN=B09YW72KB8L status=260_OK Latency=84ms</div>
            <div className="text-emerald-400">[14:47:09.840] CELERY_TASK · repricing.mutate_keyword_bid(keyword="solar power pod" proposed CPC spike to $6.80. Allowed.</div>
            <div className="text-amber-400">[14:46:59.840] GUARDIAL_INTERCEPT · VIOLATION_TRIGGED proposed bid of $8.90 strictly clamped to $4.50 max CPC.</div>
            <div className="text-teal-400">[14:45:55.792] SP-API_DRIVER · POST /fba/inventory/v1/replenishmentPlan (SIMULATED) status=201_CREATED track=true units=2500</div>
            <div className="text-emerald-400">[14:43:02.190] CELERY_TASK · catalog.inject_generic_keywords(ASIN=B07X81M3L9, tokens=["camping","portable solar","lamp"])</div>
            <div className="text-slate-400">AmzSphere High-Frequency Repricer Sentinel: Active SP-API OfferChanged notification stream. Zero API throttling detected.</div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px]">
            <span className="text-muted">SP-API Sync Worker: worker-us-east-1-04a (Active)</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="text-xs text-muted">View Telemetry Stream</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        AmzSphere High-Frequency Repricer Sentinel: Active SP-API OfferChanged notification stream. Zero API throttling detected. · Engine: v4.2.1-turbo · Sub-sec · Region: US-EAST-1 (MBS) · Polling cycle: 10s
      </p>

      {/* Modals */}
      <Modal open={exportAuditOpen} onClose={() => setExportAuditOpen(false)} title="Export Audit — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Export Configuration</div>
            <div className="text-[10px] text-muted mb-3">Export repricer audit data for offline analysis or compliance review.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Format</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>CSV</option>
                  <option>Excel (.xlsx)</option>
                  <option>JSON</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Date Range</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Export all reprice events with timestamps</li>
              <li>Include floor interventions and guardrails</li>
              <li>Download for compliance and audit review</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setExportAuditOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setExportAuditOpen(false); setMessage("Repricer audit exported to downloads."); }}>Export CSV</Button>
          </div>
        </div>
      </Modal>

      <Modal open={createStrategyOpen} onClose={() => setCreateStrategyOpen(false)} title="Create Repricing Strategy — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Strategy Configuration</div>
            <div className="text-[10px] text-muted mb-3">Create a new algorithmic repricing strategy with rule profiles and safety guardrails.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Strategy Name</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Q4 Profit Maximizer" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Margin Floor (%)</label>
                <input type="number" step="0.1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="18.5" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">Rule Profiles</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>AI Profit Maximizer</option>
                  <option>Velocity Liquidation</option>
                  <option>Anti-Price-War Dampener</option>
                  <option>Custom Hybrid</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Algorithmic bid and price adjustments</li>
              <li>Hard margin floor protection</li>
              <li>Competitor stockout auto-raise</li>
              <li>Anti-price-war throttling</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCreateStrategyOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCreateStrategyOpen(false); setMessage("Repricing strategy created and activated."); }}>Create Strategy</Button>
          </div>
        </div>
      </Modal>

      {adjustFloorOpen && (
        <Modal open={true} onClose={() => setAdjustFloorOpen(null)} title="Adjust Floor Price">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Floor Adjustment</div>
              <div className="text-[10px] text-muted mb-3">Adjust the minimum price floor for this SKU. Hard lock at 18.5% margin.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">ASIN</label>
                  <span className="text-xs text-on-surface">{adjustFloorOpen}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">New Floor ($)</label>
                  <input type="number" step="0.01" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" defaultValue="0.00" />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-amber-50">
              <div className="text-[10px] font-bold text-amber-800 mb-1">Guardrail</div>
              <div className="text-[10px] text-muted">Floor cannot go below 18.5% margin. Changes require approver signoff.</div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAdjustFloorOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setAdjustFloorOpen(null); setMessage(`Floor adjusted for ${adjustFloorOpen}.`); }}>Save Floor</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
