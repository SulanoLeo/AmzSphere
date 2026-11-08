"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { PpcData } from "@/lib/provider/types";
import { downloadCsv } from "@/lib/csv";
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

export default function PpcPage() {
  const [data, setData] = useState<PpcData | null>(null);
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const togglePpcStatus = useAmzStore((state) => state.togglePpcStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [launchCampaignOpen, setLaunchCampaignOpen] = useState(false);
  const [exportTermsOpen, setExportTermsOpen] = useState(false);
  const [bidEngineOpen, setBidEngineOpen] = useState(false);
  const [placementOpen, setPlacementOpen] = useState(false);
  const [daypartingOpen, setDaypartingOpen] = useState(false);
  const [promoteKeywordOpen, setPromoteKeywordOpen] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignBudget, setCampaignBudget] = useState("50");
  const [campaignTargeting, setCampaignTargeting] = useState<"Automatic" | "Manual">("Automatic");
  const [maxBidCap, setMaxBidCap] = useState("4.50");
  const [targetAcos, setTargetAcos] = useState("22.0");
  const [topSearchModifier, setTopSearchModifier] = useState("45");
  const [detailPageModifier, setDetailPageModifier] = useState("15");

  function exportSearchTerms() {
    downloadCsv("amzsphere-search-terms.csv", [
      ["Search term", "ASIN", "Campaign ID", "Clicks", "Spend", "Conversions", "ACoS", "Automation status"],
      ...search_terms.map((term) => {
        const status = exactTerms.has(term.term) ? "Exact target" : negativeTerms.has(term.term) ? "Negative" : "Monitoring";
        return [term.term, term.asin, term.campaign_id, term.clicks, term.spend, term.conversions, `${term.acos.toFixed(1)}%`, status];
      }),
    ]);
    setExportTermsOpen(false);
    setMessage(`Exported ${search_terms.length} mock search terms to CSV.`);
  }

  function createCampaignDraft() {
    const name = campaignName.trim();
    const budget = Number(campaignBudget);
    if (!name || !Number.isFinite(budget) || budget <= 0 || !data) return;
    const sampleProduct = data.campaigns[0];
    const draft = {
      id: `mock-campaign-${crypto.randomUUID()}`,
      name,
      asin: sampleProduct?.asin || "MOCK-ASIN",
      sku: `${campaignTargeting} targeting · $${budget.toFixed(2)}/day`,
      base_acos: 22,
      ad_share: 0,
      avg_cpc: 0,
      bid_floor: 0,
      acos_modifier: 1,
      bid_changes: [],
      ad_history: [],
      trailing_acos: null,
    };
    setData({ ...data, campaigns: [draft, ...data.campaigns] });
    setCampaignName("");
    setCampaignBudget("50");
    setLaunchCampaignOpen(false);
    setMessage(`Mock campaign draft "${name}" created locally. Nothing was submitted to Amazon.`);
  }

  useEffect(() => {
    let active = true;
    const loadPpc = async () => {
      setLoading(true);
      try {
        const [payload, catalog] = await Promise.all([
          provider.getPpcData(),
          provider.getProducts({ page_size: 200 }),
        ]);
        if (active) hydrateProducts(catalog.products, payload.campaigns);
        if (active) setData(payload);
        if (active) setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load PPC data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPpc();
    return () => { active = false; };
  }, [hydrateProducts]);

  const search_terms = data?.search_terms || [];
  const targeted_exact_keywords = data?.targeted_exact_keywords || [];
  const negative_keywords = data?.negative_keywords || [];
  const campaigns = data?.campaigns || [];
  const totalSpend = search_terms.reduce((sum, t) => sum + t.spend, 0);
  const totalClicks = search_terms.reduce((sum, t) => sum + t.clicks, 0);
  const qualified = targeted_exact_keywords.length;
  const negatives = negative_keywords.length;

  const currentAcos = () => {
    const spend = campaigns.reduce((s: number, c: any) => {
      const week = (c.ad_history || []).slice(-7);
      return s + week.reduce((sum: number, d: any) => sum + d.spend, 0);
    }, 0);
    const sales = campaigns.reduce((s: number, c: any) => {
      const week = (c.ad_history || []).slice(-7);
      return s + week.reduce((sum: number, d: any) => sum + d.sales, 0);
    }, 0);
    return sales ? (spend / sales) * 100 : 8.2;
  };

  const exactTerms = new Set(targeted_exact_keywords.map((k) => k.term));
  const negativeTerms = new Set(negative_keywords.map((k) => k.term));

  const rows = search_terms.map((term) => {
    const exact = exactTerms.has(term.term);
    const negative = negativeTerms.has(term.term);
    const automation = exact ? "Exact target" : negative ? "Negative" : "Monitoring";
    const tone = exact ? "good" : negative ? "denied" : "pending";
    return (
      <tr key={term.term} className="border-t border-line">
        <td><div className="keyword-term">{term.term}</div><div className="keyword-source">Customer search term</div></td>
        <td className="number-cell">{term.clicks}</td>
        <td className="number-cell">${term.spend}</td>
        <td className="number-cell">{term.conversions}</td>
        <td className="number-cell">{term.acos.toFixed(1)}%</td>
        <td><span className={`status ${tone}`}>{automation}</span></td>
      </tr>
    );
  });

  const acosHistory = [
    { day: "Oct 1", spend: 420, revenue: 1820, acos: 21.0 },
    { day: "Oct 2", spend: 380, revenue: 1740, acos: 20.5 },
    { day: "Oct 3", spend: 410, revenue: 1920, acos: 20.8 },
    { day: "Oct 4", spend: 390, revenue: 1880, acos: 20.2 },
    { day: "Oct 5", spend: 405, revenue: 1950, acos: 20.1 },
    { day: "Oct 6", spend: 430, revenue: 2010, acos: 19.8 },
    { day: "Oct 7", spend: 415, revenue: 1980, acos: 20.0 },
    { day: "Oct 8", spend: 395, revenue: 1850, acos: 20.6 },
    { day: "Oct 9", spend: 425, revenue: 2080, acos: 19.9 },
    { day: "Oct 10", spend: 400, revenue: 1900, acos: 20.3 },
    { day: "Oct 11", spend: 415, revenue: 2050, acos: 20.1 },
    { day: "Oct 12", spend: 390, revenue: 1870, acos: 20.4 },
    { day: "Oct 13", spend: 420, revenue: 2090, acos: 19.6 },
    { day: "Oct 14", spend: 405, revenue: 2020, acos: 19.7 },
    { day: "Oct 15", spend: 410, revenue: 2060, acos: 19.8 },
    { day: "Oct 16", spend: 430, revenue: 2110, acos: 19.4 },
    { day: "Oct 17", spend: 400, revenue: 1980, acos: 20.2 },
    { day: "Oct 18", spend: 395, revenue: 1940, acos: 20.5 },
    { day: "Oct 19", spend: 415, revenue: 2070, acos: 19.9 },
    { day: "Oct 20", spend: 400, revenue: 2010, acos: 20.1 },
    { day: "Oct 21", spend: 420, revenue: 2080, acos: 19.8 },
    { day: "Oct 22", spend: 410, revenue: 2030, acos: 20.0 },
    { day: "Oct 23", spend: 405, revenue: 2040, acos: 19.9 },
    { day: "Oct 24", spend: 425, revenue: 2100, acos: 19.7 },
    { day: "Oct 25", spend: 400, revenue: 1990, acos: 20.0 },
    { day: "Oct 26", spend: 415, revenue: 2060, acos: 19.8 },
    { day: "Oct 27", spend: 410, revenue: 2050, acos: 19.9 },
    { day: "Oct 28", spend: 420, revenue: 2090, acos: 19.6 },
    { day: "Oct 29", spend: 405, revenue: 2010, acos: 20.1 },
    { day: "Oct 30", spend: 415, revenue: 2070, acos: 19.8 },
  ];

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
            <span>Advertising</span>
            <span className="text-xs text-muted">/</span>
            <span>PPC Ads Engine</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">PPC Ads Engine</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-1.5 mt-1">
            <ChartNoAxesCombined size={12} className="mr-1" />
            Mock Bid Simulator: Ready
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Explore sample search terms, campaign metrics, and local bidding configuration examples.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>7D</span>
            <span className="bg-indigo-600 text-white px-1.5 rounded text-[9px]">30D</span>
            <span>90D</span>
            <span>Lifetime</span>
          </div>
          <Button variant="outline" onClick={() => setExportTermsOpen(true)}>
            Export Search Terms
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setLaunchCampaignOpen(true)}>
            + Launch Campaign
          </Button>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
      <p role="status" aria-live="polite" className={message ? "mb-4 rounded-md border border-line bg-white px-3 py-2 text-sm text-on-surface-variant" : "sr-only"}>
        {message}
      </p>

      <div className="metrics metrics-five mb-6">
        <Metric label="Ad Spend" value="$24,850.40" detail="+4.2% vs prev 30d" accent="blue" tag="Pacing" />
        <Metric label="Attributed Sales" value="$118,335.20" detail="+12.8% ($13.4k incremental)" accent="green" tag="Velocity" />
        <Metric label="Blended ROAS" value="4.76x / ttgt" detail="4.58x above benchmark" accent="teal" tag="Optimal" />
        <Metric label="Trailing ACoS" value="21.0%" detail="Target buffer intact: 1.0%" accent="green" tag="Target" />
        <Metric label="TACoS (Total ACOS)" value="9.8%" detail="of Gross Sales" accent="blue" tag="Healthy" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel flex flex-col h-full">
          <div className="panel-header flex items-center justify-between pb-2">
            <div>
              <h2 className="panel-title">ACoS vs Spend &amp; Attributed Revenue Trend</h2>
              <div className="panel-subtitle">Historical correlation between algorithmic daily pacing and target ACoS compression.</div>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Sponsored Products</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Sponsored Brands</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Sponsored Display</Badge>
            </div>
          </div>
          <div className="panel-content min-h-full flex-1">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={acosHistory} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#e7ebf0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Bar dataKey="spend" name="Ad Spend ($)" fill="#007185" opacity={0.3} />
                  <Bar dataKey="revenue" name="Attributed Rev ($)" fill="#10B981" opacity={0.3} />
                  <Line dataKey="acos" stroke="#007185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-end justify-between text-[10px] mt-2">
                <span className="text-muted">Current ACoS: 21.0%</span>
                <span className="text-green-700 font-semibold">Target Threshold: (22.0%)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Bid Engine &amp; PACER</h2>
                <div className="panel-subtitle">PID 2.4 · Active</div>
              </div>
              <Button variant="outline" onClick={() => setBidEngineOpen(true)}>Configure Bid Engine</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Bid Adjustments Today</span>
                  <span className="text-on-surface">344 Automated Shifts</span>
                </div>
                <div className="flex items-center justify-between text-indigo-600 font-semibold">Active</div>
                <div className="h-1 bg-indigo-100 rounded-full mb-1">
                  <div className="h-full bg-indigo-600 rounded-full w-[85%]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Negatives Auto-Harvested</span>
                  <span className="text-green-700 font-semibold">+$412/wk saved</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>18 Wasted Queries Negated</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Placement Modifiers</h2>
                <div className="panel-subtitle">Edit Rules</div>
              </div>
              <Button variant="outline" onClick={() => setPlacementOpen(true)}>Edit Placement Rules</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Top of Search (First Page)</span>
                  <span className="text-green-700 font-semibold">+45%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Product Detail Pages</span>
                  <span className="text-on-surface">+15%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">Rest of Search</span>
                  <span className="text-muted">(Base)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Dayparting &amp; Boost Matrix</h2>
                <div className="panel-subtitle">Peak 14:00 - 21:00 EST</div>
              </div>
              <Button variant="outline" onClick={() => setDaypartingOpen(true)}>Configure Dayparting</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted">Auto-Pacer Throttle</span>
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-2 py-0.5">Pause Auto-Pacer</span>
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {[0, 4, 8, 12, 16, 20, 23].map((hour) => (
                    <div key={hour} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted">{hour}:00</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hour >= 14 && hour <= 21 ? "#10B981" : "#CBD5E1" }} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Active Campaign Portfolio</h2>
            <div className="panel-subtitle">Campaign metrics generated from the local mock dataset.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBidEngineOpen(true)}>Configure Mock Bidding</Button>
            <Button onClick={() => setDaypartingOpen(true)}>Review Mock Pacing</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs font-semibold text-muted">{campaigns.length} sample campaigns</span>
            <span className="text-xs font-semibold text-muted">No live advertising account connected</span>
          </div>
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Campaign &amp; Target ASIN</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 tabular-nums">Daily Budget</th>
                  <th className="px-4 py-3 tabular-nums">Impressions</th>
                  <th className="px-4 py-3 tabular-nums">Clicks</th>
                  <th className="px-4 py-3 tabular-nums">CPC</th>
                  <th className="px-4 py-3 tabular-nums">SPEN</th>
                  <th className="px-4 py-3">PPC state</th>
                </tr>
              </thead>
                <tbody aria-busy={loading}>
                  {loading ? (
                    <tr><td colSpan={9} className="text-center text-xs text-muted py-4">Loading campaigns…</td></tr>
                  ) : campaigns.length ? campaigns.map((c) => {
                    const week = (c.ad_history || []).slice(-7);
                    const spend = week.reduce((sum: number, day: any) => sum + day.spend, 0);
                    const sales = week.reduce((sum: number, day: any) => sum + day.sales, 0);
                    const acos = sales ? (spend / sales) * 100 : 0;
                    const over = acos > 25;
                    const product = products.find((item) => item.sku === c.sku);
                    const adStatus = product?.adStatus ?? "inactive";
                    return (
                      <tr key={c.name} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="product-name">{c.name}</div>
                        <div className="product-meta text-[10px]">{c.sku}</div>
                      </td>
                      <td className="px-4 py-3">Sponsored Products</td>
                      <td className="px-4 py-3"><span className={`status ${over ? "warn" : "good"}`}>{over ? "Over limit" : "Within limit"}</span></td>
                      <td className="px-4 py-3 tabular-nums">${spend.toFixed(0)}</td>
                      <td className="px-4 py-3 tabular-nums">{week.reduce((s: number, d: any) => s + d.impressions, 0)}</td>
                      <td className="px-4 py-3 tabular-nums">{week.reduce((s: number, d: any) => s + d.clicks, 0)}</td>
                      <td className="px-4 py-3 tabular-nums">${c.bid_floor}</td>
                      <td className="px-4 py-3 tabular-nums">${acos.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        {product ? (
                          <div className="flex flex-col items-start gap-2">
                            <span className={`status ${adStatus === "active" ? "good" : adStatus === "inactive" ? "denied" : "pending"}`}>
                              {adStatus === "active" ? "Active" : adStatus === "inactive" ? "Inactive" : "Paused"}
                            </span>
                            <button
                              className="rounded-md border border-muted px-2 py-1 text-[10px] font-semibold text-on-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                              type="button"
                              onClick={() => {
                                togglePpcStatus(c.sku);
                                setMessage(`Mock ads ${adStatus === "active" ? "paused" : "resumed"} for ${c.sku}.`);
                              }}
                            >
                              {adStatus === "active" ? "Pause ads" : "Resume ads"}
                            </button>
                          </div>
                        ) : <span className="text-xs text-muted">Product unavailable</span>}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="text-center text-xs text-muted py-4">No campaigns.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing {campaigns.length} sample campaigns</span>
            <span className="text-muted font-semibold">Mock data only · no sync events</span>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined size={14} className="text-indigo-600" />
            <div>
              <h3 className="panel-title">Search Term Harvester &amp; Discovery Queue</h3>
              <div className="panel-subtitle">Automated search query candidates exceeding 12% conversion rate &amp; 4+ orders within discovery campaigns. Click to promote to isolate as Exact Match targets.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">3 Ready for Graduation</Badge>
            <Badge className="bg-teal-50 text-teal-800 border-teal-200">Promote All Validated (3)</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-3 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-3 mb-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">CR: 24.4%</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-900 truncate">portable solar battery 50w fast charge</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Isolate</Badge>
                  </div>
                  <div className="text-[10px] text-muted truncate">ASIN: B09YW72KB8L · Auto Broad Harvest</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><div className="text-[10px] text-muted">IMPR.</div><div className="text-xs font-semibold text-on-surface">3,240</div></div>
                <div><div className="text-[10px] text-muted">ORDERS</div><div className="text-xs font-semibold text-on-surface">14 units</div></div>
                <div><div className="text-[10px] text-muted">ACoS</div><div className="text-xs font-semibold text-on-surface">12.1%</div></div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-on-surface tabular-nums">$1.12</span>
                    <span className="text-[10px] text-muted">Exact</span>
                    <Button onClick={() => setPromoteKeywordOpen("portable solar battery 50w fast charge")} className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-3 mb-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">CR: 19.2%</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-900 truncate">"active noise cancelling earbuds</span>
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200">running sweatproof"</Badge>
                  </div>
                  <div className="text-[10px] text-muted truncate">ASIN: B07X81M3L9 · Phrase Expansion</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><div className="text-[10px] text-muted">IMPR.</div><div className="text-xs font-semibold text-on-surface">4,120</div></div>
                <div><div className="text-[10px] text-muted">ORDERS</div><div className="text-xs font-semibold text-on-surface">9 units</div></div>
                <div><div className="text-[10px] text-muted">ACoS</div><div className="text-xs font-semibold text-on-surface">15.8%</div></div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-on-surface tabular-nums">$0.94</span>
                    <span className="text-[10px] text-muted">Exact</span>
                    <Button onClick={() => setPromoteKeywordOpen("active noise cancelling earbuds running sweatproof")} className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-white/50">
              <div className="flex items-start gap-3 mb-2">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold">CR: 16.5%</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-indigo-900 truncate">"dual monitor arm lamp clamp</span>
                    <Badge className="bg-teal-50 text-teal-800 border-teal-200">architecture"</Badge>
                  </div>
                  <div className="text-[10px] text-muted truncate">ASIN: B08K39PW410 · Auto Substitute</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div><div className="text-[10px] text-muted">IMPR.</div><div className="text-xs font-semibold text-on-surface">5,890</div></div>
                <div><div className="text-[10px] text-muted">ORDERS</div><div className="text-xs font-semibold text-on-surface">11 units</div></div>
                <div><div className="text-[10px] text-muted">ACoS</div><div className="text-xs font-semibold text-on-surface">18.4%</div></div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-on-surface tabular-nums">$1.35</span>
                    <span className="text-[10px] text-muted">Exact</span>
                    <Button onClick={() => setPromoteKeywordOpen("dual monitor arm lamp clamp architecture")} className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <Modal open={launchCampaignOpen} onClose={() => setLaunchCampaignOpen(false)} title="Launch New Campaign — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Campaign Configuration</div>
            <div className="text-[10px] text-muted mb-3">Create a campaign draft visible only in this page session. No ad campaign is launched externally.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="campaign-name" className="text-[10px] font-bold text-muted block mb-1">Campaign Name</label>
                <input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="Q4 Holiday Push" />
              </div>
              <div>
                <label htmlFor="campaign-budget" className="text-[10px] font-bold text-muted block mb-1">Sample Daily Budget ($)</label>
                <input id="campaign-budget" type="number" min="0.01" step="0.01" value={campaignBudget} onChange={(event) => setCampaignBudget(event.target.value)} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="campaign-targeting" className="text-[10px] font-bold text-muted block mb-1">Targeting Type</label>
                <select id="campaign-targeting" value={campaignTargeting} onChange={(event) => setCampaignTargeting(event.target.value as "Automatic" | "Manual")} className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Draft is added to the sample campaign table</li>
              <li>Draft disappears when the page is refreshed</li>
              <li>No ads or Amazon account settings are changed</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setLaunchCampaignOpen(false)}>Cancel</Button>
            <Button disabled={!campaignName.trim() || !Number.isFinite(Number(campaignBudget)) || Number(campaignBudget) <= 0} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={createCampaignDraft}>Create Mock Draft</Button>
          </div>
        </div>
      </Modal>

      <Modal open={exportTermsOpen} onClose={() => setExportTermsOpen(false)} title="Export Search Terms — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Export Configuration</div>
            <div className="text-[10px] text-muted mb-3">Download all {search_terms.length} sample search-term rows, including clicks, spend, conversions, ACoS, and mock status.</div>
            <p className="text-xs font-semibold text-on-surface">Format: CSV · Scope: all sample rows</p>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Export search terms with clicks, spend, conversions</li>
              <li>Include ACoS and automation status</li>
              <li>Download ready for Google Sheets / Excel</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setExportTermsOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={exportSearchTerms}>Download CSV</Button>
          </div>
        </div>
      </Modal>

      <Modal open={bidEngineOpen} onClose={() => setBidEngineOpen(false)} title="Bid Engine & PACER — Configuration">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Bid Engine Settings</div>
            <div className="text-[10px] text-muted mb-3">Edit local sample settings for the bidding simulator. These values do not change Amazon ads.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="max-bid-cap" className="text-[10px] font-bold text-muted block mb-1">Max Bid Cap ($)</label>
                <input id="max-bid-cap" type="number" min="0" step="0.01" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={maxBidCap} onChange={(event) => setMaxBidCap(event.target.value)} />
              </div>
              <div>
                <label htmlFor="target-acos" className="text-[10px] font-bold text-muted block mb-1">Target ACoS (%)</label>
                <input id="target-acos" type="number" min="0" max="100" step="0.1" className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={targetAcos} onChange={(event) => setTargetAcos(event.target.value)} />
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Configuration remains in this browser session</li>
              <li>Sample bids are not submitted to an ad account</li>
              <li>No automated bid shifts are performed</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setBidEngineOpen(false)}>Cancel</Button>
            <Button disabled={!Number.isFinite(Number(maxBidCap)) || Number(maxBidCap) < 0 || !Number.isFinite(Number(targetAcos)) || Number(targetAcos) < 0 || Number(targetAcos) > 100} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setBidEngineOpen(false); setMessage(`Mock bidding settings saved: $${Number(maxBidCap).toFixed(2)} max bid and ${Number(targetAcos).toFixed(1)}% target ACoS.`); }}>Save Mock Settings</Button>
          </div>
        </div>
      </Modal>

      <Modal open={placementOpen} onClose={() => setPlacementOpen(false)} title="Placement Modifiers — Edit Rules">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Placement Bid Modifiers</div>
            <div className="text-[10px] text-muted mb-3">Adjust bids for specific placement types to control where your ads appear.</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="top-search-modifier" className="text-muted">Top of Search (First Page)</label>
                <input id="top-search-modifier" type="number" min="0" max="900" step="1" className="w-16 h-7 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={topSearchModifier} onChange={(event) => setTopSearchModifier(event.target.value)} />%
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="detail-page-modifier" className="text-muted">Product Detail Pages</label>
                <input id="detail-page-modifier" type="number" min="0" max="900" step="1" className="w-16 h-7 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" value={detailPageModifier} onChange={(event) => setDetailPageModifier(event.target.value)} />%
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Rest of Search</span>
                <span className="text-[10px] text-muted">(Base — not adjustable)</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setPlacementOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      <Modal open={daypartingOpen} onClose={() => setDaypartingOpen(false)} title="Dayparting & Boost Matrix — Configure">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Dayparting Schedule</div>
            <div className="text-[10px] text-muted mb-3">Set boost hours for peak conversion periods. Peak window: 14:00 - 21:00 EST.</div>
            <div className="grid grid-cols-8 gap-1">
              {[0, 4, 8, 12, 16, 20, 23].map((hour) => (
                <div key={hour} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted">{hour}:00</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hour >= 14 && hour <= 21 ? "#10B981" : "#CBD5E1" }} />
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-amber-50">
            <div className="text-[10px] font-bold text-amber-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Boost bids during peak hours</li>
              <li>Pause auto-pacer when needed</li>
              <li>Time-zone aware scheduling</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDaypartingOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setDaypartingOpen(false); setMessage("Dayparting schedule saved."); }}>Save Schedule</Button>
          </div>
        </div>
      </Modal>

      {promoteKeywordOpen && (
        <Modal open={true} onClose={() => setPromoteKeywordOpen("")} title="Promote Keyword to Exact Match">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Keyword Promotion</div>
              <div className="text-[10px] text-muted mb-3">Promote this high-converting search term to an exact match target in your campaigns.</div>
              <div className="p-3 rounded-md border border-line bg-white/50">
                <div className="text-[10px] font-bold text-on-surface mb-1">Keyword</div>
                <div className="text-xs font-semibold text-indigo-900">{promoteKeywordOpen}</div>
                <div className="text-[10px] text-muted mt-1">Match type: Exact</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setPromoteKeywordOpen("")}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setPromoteKeywordOpen(""); setMessage(`Keyword "${promoteKeywordOpen}" promoted to exact match target.`); }}>Promote</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
