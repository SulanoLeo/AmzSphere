"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bot, LoaderCircle, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asin, sku: sku || undefined, seller_id: sellerId }),
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

  return <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
    <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink"><ArrowLeft size={15} />Operations overview</Link>
    <header className="mb-7 max-w-3xl"><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Catalog operations</p><h1 className="mt-1 text-2xl font-semibold text-indigo-950">SEO & Catalog Agent</h1><p className="mt-2 text-sm text-muted">Queue real seller listing data for keyword analysis and a structured copy proposal.</p></header>
    <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
      <Card><CardHeader><div><h2 className="text-sm font-semibold">Start optimization</h2><p className="mt-1 text-xs text-muted">Amazon reads and external SERP queries run in a worker.</p></div><Badge><Bot size={12} className="mr-1" />Async</Badge></CardHeader><CardContent>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={queueOptimization}><label className="grid gap-1.5 text-xs font-semibold text-ink">Target ASIN<input className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700" value={asin} onChange={(event) => setAsin(event.target.value.toUpperCase())} minLength={10} maxLength={10} pattern="[A-Z0-9]{10}" required placeholder="B0XXXXXXXX" /></label><label className="grid gap-1.5 text-xs font-semibold text-ink">Seller SKU <span className="font-normal text-muted">required only if ASIN has multiple SKUs</span><input className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700" value={sku} onChange={(event) => setSku(event.target.value)} maxLength={80} placeholder="Optional SKU" /></label><Button disabled={busy || !sellerId} className="self-end">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />}Queue analysis</Button></form>
        {message && <p role="status" className="mt-4 rounded-md border border-line bg-canvas p-3 text-xs leading-5">{message}{operation && <span className="mt-1 block break-all font-mono text-[10px] text-muted">Operation {operation} · {operationStatus || "queued"}</span>}</p>}
      </CardContent></Card>
      <Card><CardHeader><h2 className="text-sm font-semibold">Approval boundary</h2><Badge><BadgeCheck size={12} className="mr-1" />Human review</Badge></CardHeader><CardContent className="space-y-3 text-xs leading-5 text-muted"><p>Workers read the current listing by seller SKU, gather keyword observations, and return a typed suggestion.</p><p>Publishing requires a separate approved operation and a `JSON_LISTINGS_FEED` submission. Feed completion is reconciled from the configured Amazon notification queue.</p><p>SP-API credentials, LWA tokens, and platform keys are not sent to browser JavaScript.</p></CardContent></Card>
      {operationResult && <Card className="lg:col-span-2"><CardHeader><div><h2 className="text-sm font-semibold">Optimization proposal</h2><p className="mt-1 text-xs text-muted">Review all claims and attribute requirements before approval.</p></div><Badge>{operationStatus}</Badge></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Current title</p><p className="mt-2 text-sm">{String((operationResult.current_copy as Record<string, unknown> | undefined)?.title || "")}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Suggested title</p><p className="mt-2 text-sm font-semibold text-indigo-950">{String((operationResult.suggestion as Record<string, unknown> | undefined)?.title || "")}</p></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Keyword observations</p><pre className="mt-2 overflow-auto rounded-md bg-canvas p-3 text-[10px]">{JSON.stringify(operationResult.keyword_observations || [], null, 2)}</pre></div>
        <div><p className="text-[10px] font-bold uppercase tracking-wide text-muted">Suggested bullets &amp; terms</p><pre className="mt-2 overflow-auto rounded-md bg-canvas p-3 text-[10px]">{JSON.stringify({ bullets: (operationResult.suggestion as Record<string, unknown> | undefined)?.bullet_points, backend_search_terms: (operationResult.suggestion as Record<string, unknown> | undefined)?.backend_search_terms }, null, 2)}</pre></div>
        {operationStatus === "review_required" && <div className="md:col-span-2">{isApprover ? <Button onClick={() => void approveSuggestion()} disabled={busy}>Approve &amp; queue Amazon listing feed</Button> : <Badge className="bg-amber-50 text-amber-800">Approver permission required to publish</Badge>}</div>}
      </CardContent></Card>}
    </div>
  </main>;
}

export default function CatalogPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">Loading catalog workspace…</main>}><CatalogWorkspace /></Suspense>;
}