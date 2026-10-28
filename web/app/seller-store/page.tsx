"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ClientProductProvider } from "@/lib/provider/client";
import type { SellerStoreItem } from "@/lib/provider/types";

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

export default function SellerStorePage() {
  const provider = new ClientProductProvider();
  const [sellerStore, setSellerStore] = useState<SellerStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sellerStoreAddAsin, setSellerStoreAddAsin] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [syncInsightsOpen, setSyncInsightsOpen] = useState(false);
  const [previewStorefrontOpen, setPreviewStorefrontOpen] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [toggleVisibilityOpen, setToggleVisibilityOpen] = useState<{ id: string; visible: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    const loadSellerStore = async () => {
      setLoading(true);
      try {
        const items = await provider.getSellerStore();
        if (active) setSellerStore(items);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load seller store");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadSellerStore();
    return () => { active = false; };
  }, [provider]);

  const products = sellerStore;
  const visible = products.filter((p) => p.visible);
  const hidden = products.filter((p) => !p.visible);

  async function toggleVisibility(id: string, visible: boolean) {
    try {
      await provider.toggleSellerStoreVisibility(id, visible);
      setToggleVisibilityOpen({ id, visible: !visible });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update visibility");
    }
  }

  async function addToStore() {
    if (!sellerStoreAddAsin) return;
    try {
      await provider.addToSellerStore(sellerStoreAddAsin);
      setSellerStoreAddAsin("");
      const items = await provider.getSellerStore();
      setSellerStore(items);
      setAddProductOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to add product to seller store");
    }
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
            <span>Seller Store</span>
            <span className="text-xs text-muted">/</span>
            <span>Brand Storefront Manager</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Seller Store &amp; Brand Storefront Manager</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Store Status: Live on Amazon US
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Coordinate brand navigation, visual hierarchy, dynamic inventory-synced strategy pages, customer funnels, and real-time Amazon Brand Insights.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Amazon US</span>
            <span className="text-teal-700 font-semibold">▼</span>
          </div>
          <Button variant="outline" onClick={() => setSyncInsightsOpen(true)}>
            Sync Store Insights
          </Button>
          <Button variant="outline" onClick={() => setPreviewStorefrontOpen(true)}>
            Preview Live Storefront
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setNewPageOpen(true)}>
            + New Page / Subcategory
          </Button>
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => setPublishOpen(true)}>
            Publish Changes to Amazon
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Store Visitors" value="142,850" detail="+18.4% vs 30d" accent="blue" tag="TRAFFIC" />
        <Metric label="Conversion Rate" value="4.2%" detail="Benchmark: 3.1%" accent="teal" tag="CVR" />
        <Metric label="Total Orders" value="5,984" detail="+12.8% vs prev period" accent="blue" tag="VOLUME" />
        <Metric label="Revenue" value="$384,920" detail="+14.2% MoM" accent="green" tag="GROSS" />
        <Metric label="Buy Box Rate" value="96.8%" detail="+0.4% vs last week" accent="teal" tag="OWNERSHIP" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Storefront Traffic Funnel &amp; Engagement</h2>
              <div className="panel-subtitle">Multi-touch path analysis from ad impression to verified checkout.</div>
            </div>
            <span className="category-pill">All Pages</span>
          </div>
          <div className="panel-content min-h-full">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-[10px] font-bold text-on-surface">4,890,210</div>
                <div className="text-[10px] text-muted">Impressions</div>
                <div className="w-full h-1 bg-canvas mt-2">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: "100%" }} />
                </div>
                <div className="text-[10px] text-muted">100% baseline</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-on-surface">142,850</div>
                <div className="text-[10px] text-muted">Page Views</div>
                <div className="w-full h-1 bg-canvas mt-2">
                  <div className="h-full bg-teal-600 rounded-full" style={{ width: "29.2%" }} />
                </div>
                <div className="text-[10px] text-muted">29.7% CTR to Store</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-on-surface">38,249</div>
                <div className="text-[10px] text-muted">Add to Cart</div>
                <div className="w-full h-1 bg-canvas mt-2">
                  <div className="h-full bg-amber-600 rounded-full" style={{ width: "12.7%" }} />
                </div>
                <div className="text-[10px] text-muted">12.7% ATC Rate</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-on-surface">8,028</div>
                <div className="text-[10px] text-muted">Purchases</div>
                <div className="w-full h-1 bg-canvas mt-2">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: "44.0%" }} />
                </div>
                <div className="text-[10px] text-muted">44.0% Checkout CVR</div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Storefront Experience Quality</h2>
                <div className="panel-subtitle">High Intent</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Store visitors spend 3.2x longer browsing catalog compared to standard Amazon product pages.</span>
                <Badge className="bg-teal-50 text-teal-800 border-teal-200">High</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Storefront Navigation Hierarchy</h2>
            <div className="panel-subtitle">6 Pages / 2 Sub-Levels</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Status: All (Live &amp; Draft)</span>
            <Button variant="outline" onClick={() => {}}>Sort by: 30D Sales (GMV) ▼</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">Page Name &amp; URL Path</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 tabular-nums">30D Visitors</th>
                  <th className="px-4 py-3 tabular-nums">30D Sales (GMV)</th>
                  <th className="px-4 py-3 tabular-nums">CVR</th>
                  <th className="px-4 py-3 tabular-nums">Tiles / Layout</th>
                  <th className="px-4 py-3">Linked SB Campaign</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr key="home" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Home Page</div>
                    <div className="product-meta text-[10px] text-muted">Path: /</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-teal-50 text-teal-800 border-teal-200">Live</Badge></td>
                  <td className="px-4 py-3 tabular-nums">69,420</td>
                  <td className="px-4 py-3 tabular-nums">$194,280</td>
                  <td className="px-4 py-3 tabular-nums">5.84%</td>
                  <td className="px-4 py-3 tabular-nums">14 tiles</td>
                  <td className="px-4 py-3">SB · Brand Defense Top Store</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                <tr key="audio" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Audio / Acoustics</div>
                    <div className="product-meta text-[10px] text-muted">Path: /audio</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-teal-50 text-teal-800 border-teal-200">Live</Badge></td>
                  <td className="px-4 py-3 tabular-nums">32,110</td>
                  <td className="px-4 py-3 tabular-nums">$82,410</td>
                  <td className="px-4 py-3 tabular-nums">6.12%</td>
                  <td className="px-4 py-3 tabular-nums">10 tiles</td>
                  <td className="px-4 py-3">SB · ANC Headset Direct</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                <tr key="solar" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Solar Power Hub</div>
                    <div className="product-meta text-[10px] text-muted">Path: /solar-gear · Update</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-amber-50 text-amber-800 border-amber-200">Scheduled</Badge></td>
                  <td className="px-4 py-3 tabular-nums">19,450</td>
                  <td className="px-4 py-3 tabular-nums">$54,120</td>
                  <td className="px-4 py-3 tabular-nums">4.82%</td>
                  <td className="px-4 py-3 tabular-nums">8 tiles</td>
                  <td className="px-4 py-3">SB · Solar Category Push</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                <tr key="office" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Office &amp; Desk Setup</div>
                    <div className="product-meta text-[10px] text-muted">Path: /workstation</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-teal-50 text-teal-800 border-teal-200">Live</Badge></td>
                  <td className="px-4 py-3 tabular-nums">12,640</td>
                  <td className="px-4 py-3 tabular-nums">$31,850</td>
                  <td className="px-4 py-3 tabular-nums">5.40%</td>
                  <td className="px-4 py-3 tabular-nums">12 tiles</td>
                  <td className="px-4 py-3">SB · Ergonomic Hub B2B</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                <tr key="deals" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Deals &amp; Bundles</div>
                    <div className="product-meta text-[10px] text-muted">Path: /deals</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-teal-50 text-teal-800 border-teal-200">Live</Badge></td>
                  <td className="px-4 py-3 tabular-nums">8,210</td>
                  <td className="px-4 py-3 tabular-nums">$28,120</td>
                  <td className="px-4 py-3 tabular-nums">7.10%</td>
                  <td className="px-4 py-3 tabular-nums">6 tiles</td>
                  <td className="px-4 py-3">SB · Seasonal Prime Discounts</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
                <tr key="fitness" className="border-t border-line">
                  <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                  <td className="px-4 py-3">
                    <div className="product-name">Fitness Essentials</div>
                    <div className="product-meta text-[10px] text-muted">Path: /fitness</div>
                  </td>
                  <td className="px-4 py-3"><Badge className="bg-amber-50 text-amber-800 border-amber-200">Draft Revision</Badge></td>
                  <td className="px-4 py-3 tabular-nums">—</td>
                  <td className="px-4 py-3 tabular-nums">—</td>
                  <td className="px-4 py-3 tabular-nums">—</td>
                  <td className="px-4 py-3 tabular-nums">5 tiles</td>
                  <td className="px-4 py-3">Unlinked (Draft)</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview" onClick={() => setPreviewStorefrontOpen(true)}><span className="block w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit" onClick={() => setNewPageOpen(true)}><span className="block w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 6 of 6 Storefront Pages</span>
            <span className="text-muted">Aggregate 30D Sales: $382,788.00 · Global CVR: 5.62%</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">AI Storefront Tile Recommendations &amp; Staging Queue</h2>
            <div className="panel-subtitle">3 optimization actions queued</div>
          </div>
          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Updated: Just Now</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-md border border-line bg-amber-50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-amber-100 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">Bounce Alert</span>
                <Badge className="bg-rose-50 text-rose-700 border-rose-200">PD-9838</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">High Bounce Rate on Hero Tile</div>
              <div className="text-[10px] text-muted mb-3">Static 1200x600 banner is capturing 42% immediate bounce on mobile. Replacing video on mobile ... Trial Product Video for Solar Power Pod generates an expected 1.5x CVR lift.</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">Apply Video Tile Draft</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">Dismiss</Button>
              </div>
            </div>
            <div className="p-4 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-teal-50 text-teal-800 border border-teal-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">Stockout Risk</span>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200">Galn 659</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Hero Stockout — GaN65W Charger</div>
              <div className="text-[10px] text-muted mb-3">Featured grid tile only has 68 units remaining in FBA (35 days). One-click auto-swap will replace with next-best performing equivalent from backup inventory, maintaining box dominance.</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">One-Click Auto-Swap Tile</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">View Variant Analysis</Button>
              </div>
            </div>
            <div className="p-4 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">In-Flight A/B Test</span>
                <Badge className="bg-teal-50 text-teal-800 border-teal-200">ATEP v4.2</Badge>
              </div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Holiday Header vs Minimalist Brand</div>
              <div className="text-[10px] text-muted mb-3">Amazon Storefront Experiment #ST-EXP-44 is running. Variant B (Lifestyle Minimalist) is attributing +41.9% attributed GMV over 14 days of live citation.</div>
              <div className="flex gap-2">
                <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">View Experiment &amp; Finalize</Button>
                <Button variant="outline" className="text-[10px] px-3 py-1.5">Review Data</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-6 text-[10px] text-muted">
        <span>· SP-API PB2B Quotes Stream: ACTIVE · TLS 1.3 Amazon Business Authenticated · Dry-Run Pipeline Safe (Zero accidental push)</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-xs text-muted">Node Pod: us-east-1-pod-09</span>
          <span className="text-xs text-muted">· Latency: 38ms</span>
        </div>
      </div>

      {/* Modals */}
      <Modal open={syncInsightsOpen} onClose={() => setSyncInsightsOpen(false)} title="Sync Store Insights — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Store Insights Sync</div>
            <div className="text-[10px] text-muted mb-3">Pull traffic, conversion, and revenue metrics from Amazon Brand Analytics and Store Insights API.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Marketplace</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Amazon US</option>
                  <option>Amazon EU</option>
                  <option>Amazon JP</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Date Range</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Last 7 days</option>
                  <option>Last 30 days</option>
                  <option>Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Sync traffic and CVR metrics</li>
              <li>Import store page performance</li>
              <li>Refresh conversion funnel data</li>
              <li>Update revenue attribution</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSyncInsightsOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setSyncInsightsOpen(false); setMessage("Store insights synced from Amazon Brand Analytics."); }}>Sync Insights</Button>
          </div>
        </div>
      </Modal>

      <Modal open={previewStorefrontOpen} onClose={() => setPreviewStorefrontOpen(false)} title="Preview Live Storefront">
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-line bg-white/50">
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Storefront Preview</div>
            <div className="text-[10px] text-muted mb-3">See how your storefront appears to shoppers on Amazon. Preview reflects latest published changes.</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="p-3 rounded border border-line bg-white">
                <div className="text-[10px] text-muted mb-1">Home Page</div>
                <div className="text-xs font-semibold text-indigo-900">Live · 69,420 visitors (30d)</div>
              </div>
              <div className="p-3 rounded border border-line bg-white">
                <div className="text-[10px] text-muted mb-1">Audio / Acoustics</div>
                <div className="text-xs font-semibold text-indigo-900">Live · 32,110 visitors (30d)</div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setPreviewStorefrontOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      <Modal open={newPageOpen} onClose={() => setNewPageOpen(false)} title="Create New Page / Subcategory — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">New Storefront Page</div>
            <div className="text-[10px] text-muted mb-3">Create a new category page or subcategory within your Amazon Brand Store.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Page Name</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="New Category" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Parent Category</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Home Page</option>
                  <option>Audio / Acoustics</option>
                  <option>Solar Power Hub</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">Layout Template</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Product Grid</option>
                  <option>Featured Hero + Grid</option>
                  <option>List View</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Create category and subcategory pages</li>
              <li>Choose layout templates</li>
              <li>Link Sponsored Brands campaigns</li>
              <li>Publish to Amazon Store Builder</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setNewPageOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setNewPageOpen(false); setMessage("New storefront page created in draft mode."); }}>Create Page</Button>
          </div>
        </div>
      </Modal>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish Changes to Amazon — Confirm">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Publish Storefront</div>
            <div className="text-[10px] text-muted mb-3">Publish all draft changes to your live Amazon Brand Store. Requires approver role.</div>
            <div className="p-3 rounded-md border border-line bg-amber-50">
              <div className="text-[10px] font-bold text-amber-800 mb-1">Pending Changes</div>
              <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                <li>Solar Power Hub — Scheduled update</li>
                <li>Fitness Essentials — Draft revision</li>
                <li>Hero Tile — Video replacement</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => { setPublishOpen(false); setMessage("Storefront changes published to Amazon."); }}>Publish</Button>
          </div>
        </div>
      </Modal>

      {addProductOpen && (
        <Modal open={true} onClose={() => setAddProductOpen(false)} title="Add Product to Seller Store">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Add Product</div>
              <div className="text-[10px] text-muted mb-3">Select a catalog product to list on your Amazon seller storefront.</div>
              <div className="p-3 rounded-md border border-line bg-white/50">
                <label className="text-[10px] font-bold text-muted block mb-1">ASIN / SKU</label>
                <input
                  value={sellerStoreAddAsin}
                  onChange={(e) => setSellerStoreAddAsin(e.target.value)}
                  className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:border-teal-700"
                  placeholder="B0XXXXXXXX"
                />
                <p className="text-[10px] text-muted mt-1">Search your catalog by ASIN or SKU to add products.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>Cancel</Button>
              <Button disabled={!sellerStoreAddAsin} onClick={() => { void addToStore(); }}>Add to Store</Button>
            </div>
          </div>
        </Modal>
      )}

      {toggleVisibilityOpen && (
        <Modal open={true} onClose={() => setToggleVisibilityOpen(null)} title="Toggle Product Visibility">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Visibility Change</div>
              <div className="text-[10px] text-muted mb-3">Show or hide this product from shoppers on your seller storefront.</div>
              <div className="p-3 rounded-md border border-line bg-white/50">
                <div className="text-[10px] font-bold text-on-surface mb-1">Action</div>
                <div className="text-xs font-semibold text-indigo-900">
                  {toggleVisibilityOpen.visible ? "Hide product from storefront" : "Show product on storefront"}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setToggleVisibilityOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void provider.toggleSellerStoreVisibility(toggleVisibilityOpen.id, !toggleVisibilityOpen.visible); setToggleVisibilityOpen(null); }}>Confirm</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
