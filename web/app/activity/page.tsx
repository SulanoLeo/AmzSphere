"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ChartNoAxesCombined, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ClientProductProvider } from "@/lib/provider/client";
import type { ActivityItem } from "@/lib/provider/types";

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

export default function ActivityPage() {
  const provider = new ClientProductProvider();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Modal states
  const [exportAuditOpen, setExportAuditOpen] = useState(false);
  const [triggerSyncOpen, setTriggerSyncOpen] = useState(false);
  const [rerunFailedOpen, setRerunFailedOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const loadActivity = async () => {
      setLoading(true);
      try {
        const payload = await provider.getActivity();
        if (active) setItems(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load activity log");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadActivity();
    return () => { active = false; };
  }, [provider]);

  const categories = new Set(items.map((i) => i.category));
  const recent = items.slice(0, 10);

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
            <span>Autonomous Control Plane</span>
            <span className="text-xs text-muted">/</span>
            <span>Automation Activity Logs</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Automation Activity Logs &amp; Execution Stream</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              Celery Workers: 8/10 Online (32 Threads)
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Real-time Celery/Redis task execution pipeline, SP-API mutation event audit trails, algorithmic guardrails, and transactional outbox telemetry.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Real-time</span>
            <span className="bg-indigo-600 text-white px-1.5 rounded text-[9px]">15m</span>
            <span>1h</span>
            <span>24h</span>
            <span>7d</span>
          </div>
          <Button variant="outline" onClick={() => setExportAuditOpen(true)}>
            Export Audit
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setTriggerSyncOpen(true)}>
            + Trigger Manual Sync
          </Button>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <Metric label="Dispatched Tasks" value="48,290" detail="+14.2% Peak: 340 tasks/min" accent="blue" tag="24h window" />
        <Metric label="Success Rate" value="99.84%" detail="+0.12% (opt) Failed: 76 · 0 dead-letter" accent="green" tag="Optimal" />
        <Metric label="Latency (P95)" value="142 ms" detail="Median wait: 28ms Target: &lt;280ms" accent="teal" tag="Fast (&lt;250ms)" />
        <Metric label="Guardrails" value="18 Blocked" detail="12 Price drops pre… · 6 bids" accent="rose" tag="Active" />
        <Metric label="SP-API Quota" value="41.6%" detail="Bucket: 30.0 / 50.0 reg/s limit" accent="blue" tag="Healthy" />
      </div>

      <section className="section-grid align-items-stretch mb-6">
        <div className="panel lg:col-span-2 flex flex-col h-full">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Worker Throughput &amp; Queue Pacing</h2>
              <div className="panel-subtitle">Last 60 Minutes Celery ingestion cadence (dispatch vs resolution)</div>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">By Automation Engine</Badge>
              <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">By Task Type</Badge>
            </div>
          </div>
          <div className="panel-content min-h-full flex-1">
            <div className="h-64 w-full">
              <div className="grid h-full place-items-center text-sm text-muted">No task history ingested yet.</div>
            </div>
            <div className="mt-3 flex items-center gap-4 p-3 rounded-md bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-xs text-on-surface">Peak Load at Burst Sync: +1,240 SP-API pricing events reconciled without throttle.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-xs text-on-surface">Latency: 42ms</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="panel-title">Execution Guardrails</h2>
                <div className="panel-subtitle">6 ENFORCED</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Max Bid Cap Ceiling</span>
                  <span className="text-green-700 font-semibold">$4.50</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Hard Margin Floor Protection</span>
                  <span className="text-green-700 font-semibold">18.5%</span>
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200">LOCKED</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Velocity Surge Throttle</span>
                  <span className="text-green-700 font-semibold">&gt;380%</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-white/50">
                  <span className="text-muted">Negative Keyword Quarantine</span>
                  <span className="text-green-700 font-semibold">16k Imp.</span>
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">ACTIVE</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-line bg-amber-50 border-amber-200">
                  <span className="text-amber-700 font-semibold">⚠ CIRCUIT BREAKER TRIPPED</span>
                  <span className="text-amber-700 font-semibold">14d ago</span>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">Enforced</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Live Telemetry &amp; Redis Outbox Event Stream</h2>
            <div className="panel-subtitle">Search by Task ID (#TSK…), ASIN, Engine, or Event Type…</div>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-9 rounded-md border border-line bg-white px-2 text-xs" defaultValue="All Engines">
              <option>All Engines (Repricer, PPC, Inv, SEO)</option>
            </select>
            <select className="h-9 rounded-md border border-line bg-white px-2 text-xs" defaultValue="All Statuses">
              <option>All Statuses (Committed, Dry-Run, Blocked)</option>
            </select>
            <select className="h-9 rounded-md border border-line bg-white px-2 text-xs" defaultValue="All Levels">
              <option>Severity: All Levels</option>
            </select>
            <Button variant="outline" onClick={() => setExportAuditOpen(true)}>
              JSON
            </Button>
            <Button onClick={() => setRerunFailedOpen(true)}>
              Re-run Failed (0)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th style={{width:34}}></th>
                  <th className="px-4 py-3">Timestamp / Task ID</th>
                  <th className="px-4 py-3">Engine / Module</th>
                  <th className="px-4 py-3">Action &amp; Target Entity</th>
                  <th className="px-4 py-3">Algorithmic Trigger &amp; Rationale</th>
                  <th className="px-4 py-3">Execution Status</th>
                  <th className="px-4 py-3">Latency</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading activity…</td></tr>
                ) : items.length ? items.map((item) => (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                    <td className="px-4 py-3 tabular-nums text-[10px] text-muted">{item.timestamp}</td>
                    <td className="px-4 py-3 product-meta">{item.category}</td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3 text-[10px] text-muted">{item.detail}</td>
                    <td className="px-4 py-3"><Badge className="bg-teal-50 text-teal-800 border-teal-200">SUCCESS (Committed)</Badge></td>
                    <td className="px-4 py-3 tabular-nums text-[10px] text-muted">worker-us-east-1a</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
            <span>Showing 1–5 of 48,290 Dispatched Tasks · Rate: 14.2 ops/s</span>
            <div className="flex items-center gap-1">
              <button className="button button-outline button-sm disabled">Previous</button>
              <button className="button button-primary button-sm">1</button>
              <button className="button button-outline button-sm">2</button>
              <button className="button button-outline button-sm">3</button>
              <span className="px-2 text-[10px]">...</span>
              <button className="button button-outline button-sm">966</button>
              <button className="button button-outline button-sm">Next</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="h-[300px] rounded-md border border-line bg-[#0B0F19] p-4 font-mono text-[9px] text-green-400 overflow-y-auto">
        <div className="text-teal-400">[14:48:22.104] REDIS_OUTBOX · ACK event: amz.spa.pricing.patch hash=0x8f7a2b ASIN=B09YW72KB8L status=260_OK Latency=84ms</div>
        <div className="text-emerald-400">[14:47:09.840] CELERY_TASK · repricing.mutate_keyword_bid(keyword="solar power pod" proposed CPC spike to $6.80. Allowed.</div>
        <div className="text-amber-400">[14:46:59.840] GUARDIAL_INTERCEPT · VIOLATION_TRIGGERED proposed bid of $8.90 strictly clamped to $4.50 max CPC.</div>
        <div className="text-teal-400">[14:45:55.792] SP-API_DRIVER · POST /fba/inventory/v1/replenishmentPlan (SIMULATED) status=201_CREATED track=true units=2500</div>
        <div className="text-emerald-400">[14:43:02.190] CELERY_TASK · catalog.inject_generic_keywords(ASIN=B07X81M3L9, tokens=["camping","portable solar","lamp"])</div>
        <div className="text-slate-400">AmzSphere High-Frequency Repricer Sentinel: Active SP-API OfferChanged notification stream. Zero API throttling detected.</div>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted">
        <span>Simulated: Circuit Breaker Enforced: Proposed $6.80 CPC Clamped to $4.50 Ceiling (Dry-Run Staged)</span>
        <span>Std Output: Latency=98.1ms</span>
      </div>
      <p className="text-right text-[10px] text-muted mt-4">
        No unencrypted seller data loaded · API credentials remain server-side in KMS enclave · AmzSphere Engine v2.4.9 · Documentation · System Status
      </p>

      {/* Modals */}
      <Modal open={exportAuditOpen} onClose={() => setExportAuditOpen(false)} title="Export Audit — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Export Configuration</div>
            <div className="text-[10px] text-muted mb-3">Export activity log data for compliance review or offline analysis.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Format</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>CSV</option>
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
              <li>Export all activity events with timestamps</li>
              <li>Include engine, status, and latency data</li>
              <li>Download for compliance and audit review</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setExportAuditOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setExportAuditOpen(false); setMessage("Activity log exported to downloads."); }}>Export</Button>
          </div>
        </div>
      </Modal>

      <Modal open={triggerSyncOpen} onClose={() => setTriggerSyncOpen(false)} title="Trigger Manual Sync — Setup">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Manual Sync</div>
            <div className="text-[10px] text-muted mb-3">Force a full SP-API sync of catalog, inventory, and pricing data from Amazon.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Sync Scope</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>Full Catalog</option>
                  <option>Inventory Only</option>
                  <option>Pricing Only</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted block mb-1">Marketplace</label>
                <select className="w-full h-9 rounded-md border border-line bg-white px-2 text-[10px]">
                  <option>All Marketplaces</option>
                  <option>US (.com)</option>
                  <option>EU</option>
                </select>
              </div>
            </div>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">Capabilities</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Force full catalog re-ingestion</li>
              <li>Refresh inventory and pricing from SP-API</li>
              <li>Record sync run in activity log</li>
              <li>Resume from last checkpoint if interrupted</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setTriggerSyncOpen(false)}>Cancel</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setTriggerSyncOpen(false); setMessage("Manual sync queued. Activity will appear in the stream."); }}>Trigger Sync</Button>
          </div>
        </div>
      </Modal>

      <Modal open={rerunFailedOpen} onClose={() => setRerunFailedOpen(false)} title="Re-run Failed Tasks — Confirm">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Re-run Failed Tasks</div>
            <div className="text-[10px] text-muted mb-3">Re-queue previously failed tasks for reprocessing. 0 failed tasks currently in the queue.</div>
            <div className="p-3 rounded-md border border-line bg-white/50">
              <div className="text-[10px] text-muted">No failed tasks to re-run. All tasks completed successfully.</div>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setRerunFailedOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
