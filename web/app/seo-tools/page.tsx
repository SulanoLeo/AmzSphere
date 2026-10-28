"use client";

import Link from "next/link";
import { useState } from "react";
import { PackageSearch, RefreshCw, SlidersHorizontal, Bot, ChartNoAxesCombined, BarChart3, ShoppingCart, ShieldCheck, ToggleRight, Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
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
  const [message, setMessage] = useState("");
  // Modal states
  const [compareBenchmarksOpen, setCompareBenchmarksOpen] = useState(false);
  const [catalogScanOpen, setCatalogScanOpen] = useState(false);
  const [customToolOpen, setCustomToolOpen] = useState(false);
  const [newEventHookOpen, setNewEventHookOpen] = useState(false);
  const [routingLogsOpen, setRoutingLogsOpen] = useState(false);
  const [configureToolOpen, setConfigureToolOpen] = useState<string | null>(null);
  const [telemetryOpen, setTelemetryOpen] = useState(false);

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
          <Button variant="outline" onClick={() => setCompareBenchmarksOpen(true)}>
            Compare Benchmarks
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setCatalogScanOpen(true)}>
            Run Catalog Scan
          </Button>
          <Button variant="outline" onClick={() => setCustomToolOpen(true)}>
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
              <Button variant="outline" onClick={() => setConfigureToolOpen(tool.id)}>
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
            <Button variant="outline" onClick={() => setNewEventHookOpen(true)}>
              New Event Hook
            </Button>
            <Button variant="outline" onClick={() => setRoutingLogsOpen(true)}>
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
              <span className="text-xs text-muted" onClick={() => setTelemetryOpen(true)}>View Telemetry Stream</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted mt-6">
        AmzSphere Operations · Mock engine live · API credentials remain server-side
      </p>

      {/* Modals */}
      <Modal open={compareBenchmarksOpen} onClose={() => setCompareBenchmarksOpen(false)} title="Compare Benchmarks — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Benchmark Configuration</div>
            <div className="text-[10px] text-muted mb-3">Compare your SEO tool performance against industry benchmarks and competitor baselines.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Metric</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>LQS Score Distribution</option>
                  <option>Indexation Rate</option>
                  <option>Keyword Coverage</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Benchmark Against</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Industry Average</option>
                  <option>Top 10% Performers</option>
                  <option>Custom Baseline</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Compare LQS scores across ASINs</li>
              <li>Benchmark indexation rates</li>
              <li>Track keyword coverage vs peers</li>
              <li>Export benchmark reports</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCompareBenchmarksOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCompareBenchmarksOpen(false); setMessage("Benchmark comparison generated."); }}>Run Benchmark</Button>
          </div>
        </div>
      </Modal>

      <Modal open={catalogScanOpen} onClose={() => setCatalogScanOpen(false)} title="Run Catalog Scan — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Catalog Scan Configuration</div>
            <div className="text-[10px] text-muted mb-3">Scan your entire catalog for SEO issues, suppression risks, and optimization opportunities.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Scan Scope</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Full Catalog (1,428 ASINs)</option>
                  <option>Needs Optimization Only</option>
                  <option>Suppressed Listings</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Scan Depth</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Quick (Titles + Bullets)</option>
                  <option>Full (All Fields)</option>
                  <option>Deep (Including Images)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Scan for SEO deficits across catalog</li>
              <li>Detect suppression risk flags</li>
              <li>Generate optimization task queue</li>
              <li>Export scan results to CSV</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCatalogScanOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCatalogScanOpen(false); setMessage("Catalog scan queued. Results will appear in the activity log."); }}>Start Scan</Button>
          </div>
        </div>
      </Modal>

      <Modal open={customToolOpen} onClose={() => setCustomToolOpen(false)} title="Add Custom Tool Pipeline — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Custom Tool Configuration</div>
            <div className="text-[10px] text-muted mb-3">Register a third-party SEO tool or custom pipeline into the AmzSphere cluster.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Tool Name</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="My SEO Tool" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Category</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Keyword Research</option>
                  <option>Listing Optimization</option>
                  <option>Rank Tracking</option>
                  <option>PPC/Advertising</option>
                  <option>Review &amp; Feedback</option>
                  <option>Competitor Analysis</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-muted block mb-1">SP-API Endpoint URL</label>
                <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="https://api.example.com/webhook" />
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-amber-50">
            <div className="text-[10px] font-bold text-amber-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Register custom SEO tools</li>
              <li>Configure SP-API webhook integration</li>
              <li>Assign to execution pipeline</li>
              <li>Monitor tool health and uptime</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setCustomToolOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setCustomToolOpen(false); setMessage("Custom tool pipeline registered."); }}>Register Tool</Button>
          </div>
        </div>
      </Modal>

      <Modal open={newEventHookOpen} onClose={() => setNewEventHookOpen(false)} title="New Event Hook — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Event Hook Configuration</div>
            <div className="text-[10px] text-muted mb-3">Define trigger-driven execution paths for autonomous catalog event responses.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Trigger Event</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>New ASIN Ingest</option>
                  <option>Rank Loss Surge</option>
                  <option>Suppression Risk Flagged</option>
                  <option>Global Catalog Replication</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Execution Cadence</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Real-time (Webhook)</option>
                  <option>Hourly Polling</option>
                  <option>Nightly Batch</option>
                  <option>Immediate (Priority 0)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Define trigger conditions</li>
              <li>Chain autonomous tool execution</li>
              <li>Set enforcement guardrails</li>
              <li>Enable/disable hooks</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setNewEventHookOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setNewEventHookOpen(false); setMessage("Event hook created and activated."); }}>Create Hook</Button>
          </div>
        </div>
      </Modal>

      <Modal open={routingLogsOpen} onClose={() => setRoutingLogsOpen(false)} title="Routing Logs — View">
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-line bg-white/50">
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Pipeline Execution Logs</div>
            <div className="text-[10px] text-muted mb-3">View recent autonomous tool execution chains and their outcomes.</div>
            <div className="h-[200px] overflow-y-auto border border-line rounded-md bg-[#0B0F19] p-3 font-mono text-[9px]">
              <div className="text-teal-400">[14:48:22] NEW_ASIN → LQS Auditor → NeuroRank → BST 249-Packer → Sentinel Check (Approved)</div>
              <div className="text-emerald-400">[14:47:09] RANK_SURGE → SQP Funnel Ingest → NeuroRank Reseed → Remediation Draft (Staged)</div>
              <div className="text-amber-400">[14:46:59] SUPPRESSION_RISK → Brand Sentinel Scan → Auto-Rollback Canonical → SP-API Urgent Patch (Enacted)</div>
              <div className="text-slate-400">[14:45:55] GLOBAL_CATALOG → Cross-Border Localizer → BST 249-Packer → A+ Story Localizer (Pending Review)</div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setRoutingLogsOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>

      {configureToolOpen && (
        <Modal open={true} onClose={() => setConfigureToolOpen(null)} title="Configure Tool — Setup">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Tool Configuration</div>
              <div className="text-[10px] text-muted mb-3">Configure settings for the selected SEO tool in your cluster.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Tool</label>
                  <span className="text-xs text-on-surface">{SEED_TOOLS.find((t) => t.id === configureToolOpen)?.name ?? "Unknown"}</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Status</label>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">ACTIVE</Badge>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-muted block mb-1">API Endpoint</label>
                  <input className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700" placeholder="https://api.tool.example.com/v1" />
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-indigo-50">
              <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
              <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                <li>Configure tool API credentials</li>
                <li>Set execution frequency</li>
                <li>Assign marketplace scope</li>
                <li>Enable/disable tool</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setConfigureToolOpen(null)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setConfigureToolOpen(null); setMessage("Tool configuration saved."); }}>Save Configuration</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={telemetryOpen} onClose={() => setTelemetryOpen(false)} title="SP-API Telemetry Stream — View">
        <div className="space-y-4">
          <div className="p-3 rounded-md border border-line bg-white/50">
            <div className="text-[10px] font-bold text-indigo-900 mb-1">Real-Time Telemetry</div>
            <div className="text-[10px] text-muted mb-3">Live SP-API keyword extraction throughput and cluster latency metrics.</div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted">Current Throughput</span>
              <span className="text-on-surface font-semibold">$40 keywords/sec</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted">Average Latency</span>
              <span className="text-on-surface font-semibold">64ms</span>
            </div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted">Report Queue</span>
              <span className="text-on-surface font-semibold">3 In-Flight</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Active Worker</span>
              <span className="text-on-surface font-semibold">worker-us-east-1-04a</span>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setTelemetryOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
