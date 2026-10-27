"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      const items = await provider.getSellerStore();
      setSellerStore(items);
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
          <Button variant="outline" onClick={() => {}}>
            Sync Store Insights
          </Button>
          <Button variant="outline" onClick={() => {}}>
            Preview Live Storefront
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>
            + New Page / Subcategory
          </Button>
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => {}}>
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

      <section className="section-grid mb-6">
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Storefront Traffic Funnel &amp; Engagement</h2>
              <div className="panel-subtitle">Multi-touch path analysis from ad impression to verified checkout.</div>
            </div>
            <span className="category-pill">All Pages</span>
          </div>
          <div className="panel-content">
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
            <Button variant="outline" onClick={() => {}}>
              Sort by: 30D Sales (GMV) ▼
            </Button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
                      <button className="p-1 text-muted hover:text-indigo-950" title="Preview"><span className="block w-4 h-4"></span></button>
                      <button className="p-1 text-muted hover:text-indigo-950" title="Edit"><span className="block w-4 h-4"></span></button>
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
          <span className="category-pill">Updated: Just Now (real-time telemetry)</span>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-2 mb-2">
                <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">Bounce Alert</span>
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
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md px-2 py-0.5 text-[10px] font-semibold">In-Flight A/B Test</span>
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

      <p className="text-right text-[10px] text-muted">
        Amazon SP-API · Store Builder Protection; Dry-Run Active · SIMULATED WRITES
      </p>
    </main>
  );
}
