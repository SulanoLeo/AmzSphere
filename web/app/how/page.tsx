"use client";

import Link from "next/link";
import { PackageSearch, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function HowPage() {
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
            <span>How It Works</span>
            <span className="text-xs text-muted">/</span>
            <span>%</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">How It Works</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">One shared product record drives every page: catalog → optimize → approval → publish → all pages reflect the update.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-teal-50 text-teal-800 border-teal-200">System Guide</Badge>
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex flex-col">
            <h2 className="panel-title">How AmzSphere works</h2>
            <p className="panel-subtitle">One shared product record drives every page: catalog → optimize → approval → publish → all pages reflect the update.</p>
          </div>
          <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">System Guide</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <Card>
            <CardHeader>
              <div>
                <h3 className="panel-title">Single source of truth: products</h3>
                <div className="panel-subtitle">Every page reads and writes one product record. The flow is the same in mock and in the later SP-API swap.</div>
              </div>
              <Badge className="bg-teal-50 text-teal-800 border-teal-200">Shared product record</Badge>
            </CardHeader>
            <CardContent>
              <div className="flow-steps space-y-4">
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">01</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Add or sync a product</div>
                    <div className="flow-copy text-[10px] text-muted">Import by ASIN/SKU from the catalog or create manually. Sync upserts by ASIN + marketplace (idempotent, re-runnable) and records each run in the activity log.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">POST /api/products · POST /api/sync</span>
                  </div>
                </div>
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">02</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Score every listing</div>
                    <div className="flow-copy text-[10px] text-muted">Deterministic rules score 0–100 on title length/keywords, bullets, images, description, backend keywords, and suppression. Score below 70 flags needs_optimization with human-readable issues.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">scoring.compute_opt_score</span>
                  </div>
                </div>
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">03</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Draft an optimization</div>
                    <div className="flow-copy text-[10px] text-muted">Side-by-side current vs suggested copy (title, bullets, keywords, description). Saving creates a product_revision with status draft_ready or pending_approval; nothing touches Amazon until approved.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">POST /api/products/{'{' + 'id' + '}'}/optimize</span>
                  </div>
                </div>
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">04</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Approve or reject</div>
                    <div className="flow-copy text-[10px] text-muted">Approvals shows pending revisions with a before/after diff. Approve applies the changes to the shared product, sets opt_status=published, recomputes the score, updates marketplace listings to Live & In Sync, and logs the publish. Reject returns the product to needs_optimization.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">POST /api/approvals/{'{' + 'id' + '}'}/approve|reject</span>
                  </div>
                </div>
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">05</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Every page reflects the update</div>
                    <div className="flow-copy text-[10px] text-muted">After any write, the product query invalidates so the catalog table, Overview cards, Inventory, Pricing, and Activity Log all refresh without a manual reload.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">invalidateProducts()</span>
                  </div>
                </div>
                <div className="flow-step flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">06</span>
                  <div className="flex-1 min-w-0">
                    <div className="flow-title text-xs font-semibold text-indigo-900">Execution guard</div>
                    <div className="flow-copy text-[10px] text-muted">Nothing is written to Amazon (or the mock "Amazon") without an approved revision. Mock mode only — no real Amazon calls, no credentials, no secrets.</div>
                    <span className="flow-endpoint text-[10px] text-muted mt-1 block">approval-required writes</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="section-grid mb-6">
            <Card>
              <CardHeader>
                <div>
                  <h2 className="panel-title">Product model</h2>
                  <div className="panel-subtitle">One table shared by catalog, inventory, pricing, approvals, and activity log</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rule-line space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Identity</span>
                    </span>
                    <span className="text-muted">id, asin, sku, marketplace_id, source (amazon_sync \| manual)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Listing</span>
                    </span>
                    <span className="text-muted">title, bullets[], description, backend_keywords, images[], price</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Inventory</span>
                    </span>
                    <span className="text-muted">sellable_units, days_of_supply</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Optimization</span>
                    </span>
                    <span className="text-muted">opt_score (0–100), opt_status, opt_issues[], last_optimized_at</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Sync</span>
                    </span>
                    <span className="text-muted">last_synced_at, sync_status</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">Revisions</span>
                    </span>
                    <span className="text-muted">product_id, field changes before/after, status, created_by, created_at</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <h2 className="panel-title">opt_status enum</h2>
                  <div className="panel-subtitle">needs_optimization → draft_ready → pending_approval → approved → published → optimized</div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rule-line space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5">needs_optimization</span>
                    </span>
                    <span className="text-muted">Score &lt; 70 · appears in optimization priority list</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5">draft_ready</span>
                    </span>
                    <span className="text-muted">Saved draft awaiting submission</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-2 py-0.5">pending_approval</span>
                    </span>
                    <span className="text-muted">Awaiting human approver decision</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">approved</span>
                    </span>
                    <span className="text-muted">Revision applied · published to catalog</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">published</span>
                    </span>
                    <span className="text-muted">Score recomputed · listings Live & In Sync</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-md px-2 py-0.5">optimized</span>
                    </span>
                    <span className="text-muted">Score ≥ 70 · no open issues</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="insight-panel">
              <CardHeader>
                <div>
                  <h2 className="panel-title">Mock mode · visual simulation</h2>
                </div>
              </CardHeader>
              <CardContent>
                <blockquote className="insight-quote text-[10px] text-muted italic mb-3">
                  "Live won't run without SP-API credentials, PostgreSQL, Redis, and Google OAuth."
                </blockquote>
                <p className="insight-body text-[10px] text-muted mb-3">
                  The Next.js/FastAPI/Celery scaffold keeps the same product model and endpoints; only the sync source swaps from the mock catalog to real SP-API Listings/Catalog/FBA Inventory calls when credentials are added.
                </p>
                <div className="recommendation p-3 rounded-md border border-line bg-amber-50">
                  <div className="text-[10px] font-bold text-amber-800 mb-1">Safety boundary</div>
                  <div className="text-[10px] text-muted">All data here is mock. Approval actions are not authenticated yet; keep hosted access private.</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted mt-6">
        AmzSphere Operations · Mock engine live · API credentials remain server-side
      </p>
    </main>
  );
}
