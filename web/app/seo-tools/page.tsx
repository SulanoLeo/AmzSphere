"use client";

import Link from "next/link";
import { PackageSearch, RefreshCw, SlidersHorizontal, Bot, ChartNoAxesCombined, BarChart3, ShoppingCart, ShieldCheck, ToggleRight, Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SEED_TOOLS, getAllMarketplaces, marketplaceLabel, computeMonthlyCost, type SeoTool } from "@/lib/seo-tools";

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

export default function SeoToolsPage() {
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
            <span>Product Catalog &amp; Optimization</span>
            <span className="text-xs text-muted">/</span>
            <span>SEO Tool Selector</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">SEO Tool Selector &amp; Algorithmic Engine Workbench</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              CLUSTER v2024.9
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Configure, benchmark, and orchestrate AI keyword harvesters, listing score checkers, search query (SQP) analyzers, and SP-API automated catalog sync routines.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => {}}>
            Compare Benchmarks
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => {}}>
            Run Catalog Scan
          </Button>
          <Button variant="outline" onClick={() => {}}>
            Add Custom Tool Pipeline
          </Button>
        </div>
      </header>

      <div className="flex items-center justify-between text-[10px] font-semibold mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-indigo-600" />
          <span>ENGINE ORCHESTRATOR: Live (v2024.9)</span>
          <span className="text-xs text-muted">·</span>
          <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5">AMAZON SFR SYNC: Enabled (US / EU)</span>
          <span className="text-xs text-muted">·</span>
          <span className="text-xs font-bold text-indigo-900">DAILY TOKEN BUDGET: 84.5% Remaining</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-indigo-900">SP-API RATE CEILING</span>
          <div className="text-sm font-semibold text-on-surface">18.4 / 20.0 rps</div>
        </div>
      </div>

      <div className="metrics metrics-five mb-6">
        <Metric
          label="Active Engines"
          value="7 Connected"
          detail="+2 · 99.9% Custom Uptime"
          accent="blue"
          tag="LIVE"
        />
        <Metric
          label="Keywords Tracked"
          value="42,850"
          detail="+14.2% Top 10: 38.4% MoM"
          accent="teal"
          tag="TRACKED"
        />
        <Metric
          label="Search Query Share"
          value="64.2%"
          detail="+5.1% Across ASINs"
          accent="blue"
          tag="MARKET YOY"
        />
        <Metric
          label="Monthly AI Token Quota"
          value="3.2M / 5.0M"
          detail="64% Consumed Auto-Rollover"
          accent="green"
          tag="REMAINING"
        />
        <Metric
          label="Policy Guardrails"
          value="24 Warnings Halted"
          detail="0 Suspensions / Intercepted"
          accent="warn"
          tag="100%"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-4 mb-6">
        {[...SEED_TOOLS.slice(0, 8)].map((tool) => (
          <Card key={tool.id} className="border-line p-4 hover:bg-canvas/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center">
                  <Bot size={16} className="text-indigo-600" />
                </div>
                <span className="text-xs font-semibold text-indigo-900 truncate w-[120px]">{tool.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge className={tool.is_active ? "bg-teal-50 text-teal-800 border-teal-200" : "bg-amber-50 text-amber-800 border-amber-200"}>
                  {tool.is_active ? "ACTIVE" : "STANDBY"}
                </Badge>
              </div>
            </div>
            <div className="text-[10px] text-muted mb-2">{tool.short_description}</div>
            <div className="flex items-center justify-between text-[10px] mb-2">
              <span className="text-muted">{tool.category}</span>
              <span className="text-indigo-600 font-semibold tabular-nums">${tool.starting_price_usd ?? "—"}/mo</span>
            </div>
            <div className="flex gap-1 mb-3">
              {tool.marketplaces.slice(0, 3).map((mp) => (
                <span key={mp} className="px-1.5 py-0.5 rounded border border-line bg-white text-[9px] text-muted">{mp}</span>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200 text-[9px]">{tool.pricing_model}</Badge>
              <Button variant="outline" onClick={() => {}}>
                Configure
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-indigo-600" />
            <div>
              <h2 className="panel-title">Catalog Event Automation &amp; Pipeline Router</h2>
              <div className="panel-subtitle">Trigger-driven chained execution paths. Defines how specialized tools react autonomously to catalog ingest, rank volatility, and suppression flags.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {}}>
              New Event Hook
            </Button>
            <Button variant="outline" onClick={() => {}}>
              Routing Logs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Catalog Event Trigger</th>
                  <th className="px-4 py-3">Autonomous Tool Execution Chain</th>
                  <th className="px-4 py-3">Execution Cadence</th>
                  <th className="px-4 py-3">Enforcement Guardrail</th>
                  <th className="px-4 py-3">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr key="new-asin" className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs font-semibold text-indigo-900">New ASIN Ingest</span>
                      <div className="text-[10px] text-muted">Event: SP_API_LISTING_CREATE</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">1. LQS Auditor</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">2. NeuroRank</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">3. BST 249-Packer</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-rose-50 text-rose-700">4. Sentinel Check</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted">Real-time (Webhook)</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-teal-50 text-teal-800 border-teal-200">Require Human B2B Signoff</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted">Enabled</span>
                    </div>
                  </td>
                </tr>
                <tr key="rank-surge" className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-semibold text-indigo-900">Rank Loss Surge</span>
                      <div className="text-[10px] text-muted">Condition: Organic Rank Drop &gt; 5</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">1. SQP Funnel Ingest</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">2. NeuroRank Reseed</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">3. Remediation Draft</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted">Hourly Polling</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200">Slack Alert + Draft Staging</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted">Enabled</span>
                    </div>
                  </td>
                </tr>
                <tr key="suppression" className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span className="text-xs font-semibold text-indigo-900">Suppression Risk Flagged</span>
                      <div className="text-[10px] text-muted">Condition: Listing Status ≠ Active</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">1. Brand Sentinel Scan</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">2. Auto-Rollback Canonical</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">3. SP-API Urgent Patch</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted">Immediate (Priority 0)</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-rose-50 text-rose-700 border-rose-200">Auto-Rollback Enacted</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted">ACTIVE</span>
                    </div>
                  </td>
                </tr>
                <tr key="global-catalog" className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-semibold text-indigo-900">Global Catalog Replication</span>
                      <div className="text-[10px] text-muted">Target: EU &amp; LATAM Nodes</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">1. Cross-Border Localizer</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">2. BST 249-Packer (ES/DE)</span>
                      <span className="text-xs text-muted">→</span>
                      <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700">3. A+ Story Localizer</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted">Nightly Batch (02:00 UTC)</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-amber-50 text-amber-800 border-amber-200">Pending Localization Review</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-muted">Enabled</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Real-Time SP-API Telemetry &amp; Keyword Extraction Throughput</h2>
            <div className="panel-subtitle">STREAM · $40 keywords /sec · AVG CLUSTER LATENCY: 64ms</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-teal-50 text-teal-800 border-teal-200">STREAM</Badge>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">$40 keywords/sec</Badge>
            <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">64ms LATENCY</Badge>
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">REPORT QUEUE: 3 In-Flight</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48 w-full">
            <div className="flex items-center justify-center h-full text-sm text-muted">SP-API Sync Worker: worker-us-east-1-04a (Active)</div>
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

      <p className="text-right text-[10px] text-muted mt-6">
        AmzSphere Operations · Mock engine live · API credentials remain server-side
      </p>
    </main>
  );
}
