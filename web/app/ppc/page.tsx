"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined } from "lucide-react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClientProductProvider } from "@/lib/provider/client";
import type { Dashboard } from "@/lib/provider/types";

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
  const provider = new ClientProductProvider();
  const [data, setData] = useState<{ campaigns: any[]; search_terms: any[]; targeted_exact_keywords: any[]; negative_keywords: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadPpc = async () => {
      setLoading(true);
      try {
        const payload = await provider.getPpcData();
        if (active) setData(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load PPC data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPpc();
    return () => { active = false; };
  }, [provider]);

  const autonomousBids = true;
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
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
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
            Autopilot Bidding: Active
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Autonomous keyword harvesting, algorithmic target bidding &amp; Sponsored Products budget pacing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>7D</span>
            <span className="bg-indigo-600 text-white px-1.5 rounded text-[9px]">30D</span>
            <span>90D</span>
            <span>Lifetime</span>
          </div>
          <Button variant="outline" onClick={() => {}}>
            Export Search Terms
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>
            + Launch Campaign
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Ad Spend" value="$24,850.40" detail="+4.2% vs prev 30d" accent="blue" tag="Pacing" />
        <Metric label="Attributed Sales" value="$118,335.20" detail="+12.8% ($13.4k incremental)" accent="green" tag="Velocity" />
        <Metric label="Blended ROAS" value="4.76x / ttgt" detail="4.58x above benchmark" accent="teal" tag="Optimal" />
        <Metric label="Trailing ACoS" value="21.0%" detail="Target buffer intact: 1.0%" accent="green" tag="Target" />
        <Metric label="TACoS (Total ACOS)" value="9.8%" detail="of Gross Sales" accent="blue" tag="Healthy" />
      </div>

      <section className="section-grid mb-6">
        <div className="panel lg:col-span-2">
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
          <div className="panel-content">
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
            <div className="panel-subtitle">Real-time Amazon Advertising SP-API telemetry &amp; live automated bid interventions.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {}}>
              Bulk Adjust Target ACoS
            </Button>
            <Button onClick={() => {}}>
              Reallocate Budget
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs font-semibold text-muted">State: All Enabled</span>
            <span className="text-xs font-semibold text-muted">Format: All (SP, SB, SD)</span>
            <span className="text-xs font-semibold text-muted">Portfolio: All Lines</span>
            <Button variant="outline" onClick={() => {}}>
              Reset Filters
            </Button>
          </div>
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">Campaign &amp; Target ASIN</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 tabular-nums">Daily Budget</th>
                  <th className="px-4 py-3 tabular-nums">Impressions</th>
                  <th className="px-4 py-3 tabular-nums">Clicks</th>
                  <th className="px-4 py-3 tabular-nums">CPC</th>
                  <th className="px-4 py-3 tabular-nums">SPEN</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center text-xs text-muted py-4">Loading campaigns…</td></tr>
                ) : campaigns.length ? campaigns.map((c) => {
                  const week = (c.ad_history || []).slice(-7);
                  const spend = week.reduce((sum: number, day: any) => sum + day.spend, 0);
                  const sales = week.reduce((sum: number, day: any) => sum + day.sales, 0);
                  const acos = sales ? (spend / sales) * 100 : 0;
                  const over = acos > 25;
                  return (
                    <tr key={c.name} className="border-t border-line">
                      <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                      <td className="px-4 py-3">
                        <div className="product-name">{c.name}</div>
                        <div className="product-meta text-[10px]">{c.sku}</div>
                      </td>
                      <td className="px-4 py-3">{c.type}</td>
                      <td className="px-4 py-3"><span className={`status ${over ? "warn" : "good"}`}>{over ? "Over limit" : "Within limit"}</span></td>
                      <td className="px-4 py-3 tabular-nums">${spend.toFixed(0)}</td>
                      <td className="px-4 py-3 tabular-nums">{week.reduce((s: number, d: any) => s + d.impressions, 0)}</td>
                      <td className="px-4 py-3 tabular-nums">{week.reduce((s: number, d: any) => s + d.clicks, 0)}</td>
                      <td className="px-4 py-3 tabular-nums">${c.bid_floor}</td>
                      <td className="px-4 py-3 tabular-nums">${acos.toFixed(1)}%</td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={9} className="text-center text-xs text-muted py-4">No campaigns.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 5 of 52 active campaigns</span>
            <span className="text-green-700 font-semibold">• All Amazon SP-API sync events verified</span>
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
                    <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
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
                    <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
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
                    <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1">Promote to Exact</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
