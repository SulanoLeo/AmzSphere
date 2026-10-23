"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bot, LoaderCircle, Search, ToggleRight, ToggleLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StorefrontView } from "@/components/product/StorefrontView";
import { ApiIntegrationStatus } from "@/components/ApiIntegrationStatus";
import { HealthScoreBar } from "@/components/HealthScoreBar";

function CatalogWorkspace() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller_id") || "";
  const [asin, setAsin] = useState("");
  const [sku, setSku] = useState("");
  const [operation, setOperation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationStatus, setOperationStatus] = useState("");
  const [operationResult, setOperationResult] = useState<Record<string, unknown> | null>(null);
  const [isApprover, setIsApprover] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<"free" | "paid">("free");
  const [helium10Token, setHelium10Token] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [drawerMode, setDrawerMode] = useState<"view" | "optimize">("optimize");
  const [addModal, setAddModal] = useState(false);
  const [addTab, setAddTab] = useState<"import" | "manual">("import");

  useEffect(() => {
    let active = true;
    void fetch("/api/access", { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (active) setIsApprover(Boolean(payload.isApprover));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!operation || ["review_required", "failed", "succeeded", "needs_review"].includes(operationStatus)) return;
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/operations/${encodeURIComponent(operation)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "Operation status unavailable");
        if (active) {
          setOperationStatus(payload.status);
          setOperationResult(payload.result_payload || null);
        }
      } catch (cause) {
        if (active) setMessage(cause instanceof Error ? cause.message : "Operation status unavailable");
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 4000);
    return () => { active = false; window.clearInterval(timer); };
  }, [operation, operationStatus]);

  async function approveSuggestion() {
    if (!operation) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/operations/${encodeURIComponent(operation)}/approve`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Approval failed");
      setOperationStatus(payload.status);
      setMessage("Approved listing feed queued. Amazon processing remains asynchronous and will be reconciled from its notification.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function queueOptimization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/catalog/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin, sku: sku || undefined, seller_id: sellerId, optimization_mode: optimizationMode, helium10_api_key: helium10Token || undefined }),
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Unable to queue catalog analysis");
      setOperation(payload.operation_id);
      setOperationStatus(payload.status);
      setOperationResult(null);
      setMessage("Optimization queued. The worker will return a proposal for human review; it will not publish automatically.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const suggestion = (operationResult?.suggestion as Record<string, unknown> | undefined) ?? {};
  const healthScore = suggestion.health_score as number | null ?? null;
  const missingKeywords = (suggestion.missing_high_volume_keywords as Array<{ keyword: string; search_volume?: number; organic_rank?: number }> | undefined) ?? [];

  return <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
    <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink"><ArrowLeft size={15} />Operations overview</Link>
    <header className="mb-7"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Catalog operations</p><h1 className="mt-1 text-2xl font-semibold text-indigo-950">SEO & Catalog</h1><p className="mt-2 text-sm text-muted">One shared product record for the catalog: status badges, opt_score, filters, row actions, and bulk optimization. Every page reflects the update.</p></header>

    {/* Hybrid data sourcing controls */}
    <Card className="mb-4"><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Bot size={14} className="text-teal-600" /><span className="text-[10px] font-bold uppercase tracking-wide text-muted">Data Sourcing Mode</span></div>
      <div className="flex items-center gap-1 border border-line rounded-md bg-canvas p-1 text-xs">
        <button
          onClick={() => setOptimizationMode("free")}
          className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${optimizationMode === "free" ? "bg-teal-50 text-teal-700 border-teal-200" : "text-muted hover:text-ink"}`}
          title="Amazon Native Data (Free)"
        >
          <ToggleLeft size={12} className="mr-1.5" />Free
        </button>
        <button
          onClick={() => setOptimizationMode("paid")}
          className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all ${optimizationMode === "paid" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "text-muted hover:text-ink"}`}
          title="Helium 10 Advanced Data (Paid)"
        >
          Paid<ToggleRight size={12} className="ml-1.5" />
        </button>
      </div>
    </div></CardHeader><CardContent className="pt-0">
      <div className="grid gap-3 sm:grid-cols-2">
        <ApiIntegrationStatus token={helium10Token} mode={optimizationMode} onTokenChange={setHelium10Token} />
        <HealthScoreBar score={healthScore} missingKeywords={missingKeywords} mode={optimizationMode} />
      </div>
      <p className="mt-2 text-[10px] text-muted">
        {optimizationMode === "free"
          ? "Free mode routes keyword ingestion to Amazon native SQP reports and autocomplete flows. Recommendations focus on structural keyword placement in title, bullets, and back-end search terms."
          : "Paid mode calls Helium 10 Cerebro/Scribbles for competitor keyword indexes, search volumes, and organic ranks. High-volume competitor phrases missing from your catalog copy are flagged automatically."}
      </p>
    </CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
      <Card><CardHeader><div><h2 className="text-sm font-semibold">Start optimization</h2><p className="mt-1 text-xs text-muted">Amazon reads and external SERP queries run in a worker.</p></div><Badge><Bot size={12} className="mr-1" />Async</Badge></CardHeader><CardContent>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={queueOptimization}><label className="grid gap-1.5 text-xs font-semibold text-ink">Target ASIN<input className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700" value={asin} onChange={(event) => setAsin(event.target.value.toUpperCase())} minLength={10} maxLength={10} pattern="[A-Z0-9]{10}" required placeholder="B0XXXXXXXX" /></label><label className="grid gap-1.5 text-xs font-semibold text-ink">Seller SKU <span className="font-normal text-muted">required only if ASIN has multiple SKUs</span><input className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700" value={sku} onChange={(event) => setSku(event.target.value)} maxLength={80} placeholder="Optional SKU" /></label><Button disabled={busy || !sellerId} className="self-end">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}Queue analysis</Button></form>
        {message && <p role="status" className="mt-4 rounded-md border border-line bg-canvas p-3 text-xs leading-5">{message}{operation && <span className="mt-1 block break-all font-mono text-[10px] text-muted">Operation {operation} · {operationStatus || "queued"}</span>}</p>}
      </CardContent></Card>
      <Card><CardHeader><h2 className="text-sm font-semibold">Approval boundary</h2><Badge><BadgeCheck size={12} className="mr-1" />Human review</Badge></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-muted"><p>Workers read the current listing by seller SKU, gather keyword observations, and return a typed suggestion.</p><p>Publishing requires a separate approved operation and a `JSON_LISTINGS_FEED` submission. Feed completion is reconciled from the configured Amazon notification queue.</p><p>SP-API credentials, LWA tokens, and platform keys are not sent to browser JavaScript.</p></CardContent></Card>
      {operationResult && <Card className="lg:col-span-2"><CardHeader><div><h2 className="text-sm font-semibold">Optimization proposal</h2><p className="mt-1 text-xs text-muted">Review all claims and attribute requirements before approval.</p></div><Badge>{operationStatus}</Badge></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Current title</p><p className="mt-2 text-sm">{String((operationResult.current_copy as Record<string, unknown> | undefined)?.title || "")}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Suggested title</p><p className="mt-2 text-sm font-semibold text-indigo-950">{String(suggestion.title || "")}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Health score</p><div className="mt-2 text-sm font-semibold">{healthScore === null ? "—" : `${healthScore}/100`}</div></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Rationale</p><p className="mt-2 text-sm text-muted">{String(suggestion.rationale || "")}</p></div>
        </div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Suggested bullets</p><ul className="mt-2 space-y-1 text-sm text-muted">{(suggestion.bullet_points as string[] | undefined)?.map((bullet: string, index: number) => (
          <li key={index} className="flex gap-2">{String(index + 1)}. {bullet}</li>
        ))}</ul></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Backend search terms</p><p className="mt-2 text-sm font-mono text-[10px] break-all">{String(suggestion.backend_search_terms || "")}</p></div>
        <div className="md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">PPC targeting recommendation</p><p className="mt-2 text-sm text-muted">{String(suggestion.ppc_targeting_recommendation || "")}</p></div>
        <div className="md:col-span-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Missing high-volume keywords</p>{missingKeywords.length > 0 ? (
          <ul className="mt-1 space-y-1 text-sm text-muted">{missingKeywords.map((kw, index) => (
            <li key={index} className="flex gap-2">{kw.keyword}{kw.search_volume != null && <span className="font-mono text-[10px] text-muted"> ({kw.search_volume} mo.)</span>}</li>
          ))}</ul>
        ) : <p className="mt-2 text-sm text-muted">None detected.</p>}</div>
        {operationStatus === "review_required" && <div className="md:col-span-2">{isApprover ? <Button onClick={() => void approveSuggestion()} disabled={busy}>Approve &amp; queue Amazon listing feed</Button> : <Badge className="bg-amber-50 text-amber-800">Approver permission required to publish</Badge>}</div>}
      </CardContent></Card>}
      <Card className="lg:col-span-2"><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Simulated Amazon Storefront</h2><p className="mt-1 text-xs text-muted">Live listing preview updated reactively from sourcing inputs.</p></div><Badge>Preview</Badge></CardHeader><CardContent><StorefrontView /></CardContent></Card>

      {/* Shared product table — mirrors the mock catalog table design. Populates from the same
          product records once connected; opt_status and opt_score are computed by scoring. */}
      <Card className="mt-6 lg:col-span-2"><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Shared product table</h2><p className="mt-1 text-xs text-muted">One product record read by catalog, inventory, pricing, and approvals.</p></div></CardHeader><CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Filters</span>
          <div className="flex items-center gap-1 border border-line rounded-md bg-canvas p-1 text-xs">
            <button className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-200">Needs optimization</button>
            <button className="px-2 py-1 rounded-md text-[10px] font-semibold bg-orange-50 text-orange-800 border-orange-200">{'Low stock (< 15d)'}</button>
            <button className="px-2 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-800 border-red-200">Suppressed</button>
          </div>
          <button className="button button-primary button-sm" type="button" onClick={() => { setAddTab("import"); setAddModal(true); }}>Add product</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted"><tr><th style={{width:34}}></th><th className="px-4 py-3">ASIN</th><th className="px-4 py-3">SKU</th><th style={{minWidth:220}} className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 tabular-nums">Score</th><th style={{width:300}} className="px-4 py-3">Issues</th><th className="px-4 py-3 tabular-nums">Stock</th><th className="px-4 py-3 tabular-nums">Days of supply</th><th className="px-4 py-3 tabular-nums">Price</th><th style={{width:170}} className="px-4 py-3">Actions</th></tr></thead>
          <tbody>
            <tr className="border-t border-line"><td className="px-4 py-3 tabular-nums text-[10px] text-muted">—</td><td className="px-4 py-3">—</td><td className="px-4 py-3">—</td><td className="px-4 py-3">No products connected yet</td><td className="px-4 py-3">—</td><td className="px-4 py-3"><span className="status pending">—</span></td><td className="px-4 py-3 tabular-nums">—</td><td className="px-4 py-3"><span className="issue-tag muted">—</span></td><td className="px-4 py-3 tabular-nums">—</td><td className="px-4 py-3 tabular-nums">—</td><td className="px-4 py-3 tabular-nums">—</td><td className="px-4 py-3"><span className="text-[10px] text-muted">Connect a seller account to load products</span></td></tr>
          </tbody>
        </table></div>
        <p className="mt-2 text-[10px] text-muted">Row actions: Optimize (opens side-by-side current vs suggested copy) · View. Bulk select with "Optimize selected". Add product opens Import from Amazon (ASIN/SKU) or Create manually.</p>
      </CardContent></Card>

      {drawerId && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawerId("")}></div>
          <div className="drawer" data-drawer>
            <div className="drawer-header"><div><span className="drawer-title">{drawerMode === "view" ? "View listing" : "Optimize listing"}</span><span className="drawer-sub">{drawerId} · {drawerId}</span></div><button className="button button-outline button-sm" type="button" onClick={() => setDrawerId("")}>Close</button></div>
            <div className="drawer-body">
              <div className="compare-grid">
                <div className="compare-side"><div className="compare-head">Current · score —</div>
                  <div className="compare-field"><span>Title</span><div className="field-value">—</div></div>
                  <div className="compare-field"><span>Bullets</span><ul className="field-list"><li>—</li></ul></div>
                  <div className="compare-field"><span>Backend keywords</span><div className="field-value">—</div></div>
                  <div className="compare-field"><span>Description</span><div className="field-value">—</div></div>
                  <div className="compare-field"><span>Images</span><div className="field-value">0 main</div></div>
                </div>
                <div className="compare-side"><div className="compare-head">Suggested · editable before approval</div>
                  <form className="optimize-form" data-product-id={drawerId}>
                    <div className="compare-field"><span>Title</span><textarea name="title" required style={{width:"100%",minHeight:44,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}>{""}</textarea></div>
                    <div className="compare-field"><span>Bullets (one per line)</span><textarea name="bullets" required style={{width:"100%",minHeight:88,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}>{""}</textarea></div>
                    <div className="compare-field"><span>Backend keywords (comma-separated)</span><input name="backend_keywords" value="" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div className="compare-field"><span>Description</span><textarea name="description" style={{width:"100%",minHeight:66,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}>{""}</textarea></div>
                    <div className="compare-actions">
                      {drawerMode === "view" ? <button className="button button-outline" type="button" onClick={() => setDrawerId("")}>Close</button> : <>
                        <button className="button button-outline" type="button" onClick={() => setDrawerId("")}>Cancel</button>
                        <button className="button button-outline" type="button">Save draft</button>
                        <button className="button button-primary" type="button">Send to approval</button>
                      </>}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {addModal && (
        <>
          <div className="drawer-backdrop" onClick={() => setAddModal(false)}></div>
          <div className="drawer" style={{width:"min(720px,92vw)",maxHeight:"92vh",display:"flex",flexDirection:"column"}} data-add-modal>
            <div className="drawer-header"><div><span className="drawer-title">Add product</span><span className="drawer-sub">Import from Amazon or create manually</span></div><button className="button button-outline button-sm" type="button" onClick={() => setAddModal(false)}>Close</button></div>
            <div className="drawer-body" style={{flex:1,overflow:"auto",padding:"16px 20px 20px"}}>
              <div className="tabs">
                <button className={`tab ${addTab === "import" ? "tab-active" : ""}`} type="button" onClick={() => setAddTab("import")}>Import from Amazon</button>
                <button className={`tab ${addTab === "manual" ? "tab-active" : ""}`} type="button" onClick={() => setAddTab("manual")}>Create manually</button>
              </div>
              {addTab === "import" && (
                <div className="tab-panel" id="add-tab-import">
                  <p className="hint">Look up a product by ASIN or SKU. Re-importing upserts by ASIN + marketplace.</p>
                  <form id="add-import-form" style={{display:"flex",gap:8,alignItems:"end",marginTop:10}}>
                    <input name="ref" type="text" placeholder="ASIN or SKU" required style={{flex:1,minHeight:34,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/>
                    <button type="submit" className="button button-primary" style={{minHeight:36}}>Import</button>
                  </form>
                </div>
              )}
              {addTab === "manual" && (
                <div className="tab-panel" id="add-tab-manual">
                  <form id="add-manual-form" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginTop:10}}>
                    <div><label className="form-label">Product name</label><input name="add-name" type="text" placeholder="e.g. Bamboo Desk Organizer" required style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">SKU</label><input name="add-sku" type="text" placeholder="e.g. BD-OG-01" required style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">ASIN</label><input name="add-asin" type="text" placeholder="e.g. B0XYZ12345" required style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">Listing title</label><input name="add-title" type="text" placeholder="Defaults to product name" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">Category</label><input name="add-category" type="text" placeholder="e.g. Office" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">Price ($)</label><input name="add-price" type="number" step="0.01" placeholder="24.99" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">Stock units</label><input name="add-stock" type="number" step="1" placeholder="500" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div><label className="form-label">Daily velocity</label><input name="add-velocity" type="number" step="0.1" placeholder="15" style={{width:"100%",minHeight:30,padding:"0 10px",border:"1px solid #e3e9ec",borderRadius:4,background:"#fff",color:"#202d38",font:"inherit",fontSize:11}}/></div>
                    <div style={{gridColumn:"1/-1",display:"flex",gap:8}}><button className="button button-outline" type="button" onClick={() => setAddModal(false)}>Cancel</button><button type="submit" form="add-manual-form" className="button button-primary" style={{minHeight:36}}>Create product</button></div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  </main>;
}

export default function CatalogPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Loading catalog workspace…</main>}><CatalogWorkspace /></Suspense>;
}
