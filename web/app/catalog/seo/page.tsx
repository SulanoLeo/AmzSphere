"use client";

import { useCallback, useEffect, useId, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, LoaderCircle, Plus, Search, ToggleRight, ToggleLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { AddProductModal } from "@/components/product/AddProductModal";
import { HealthScoreBar } from "@/components/HealthScoreBar";
import { SyncButtonSimulation } from "@/components/catalog/SyncButtonSimulation";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Dashboard, Product, ProductRevision } from "@/lib/provider/types";
import { useAmzStore } from "@/lib/useAmzStore";

type SeoDraft = {
  title: string;
  bullets: string;
  backendKeywords: string;
  description: string;
};

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
    </section>
  );
}

export default function SeoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading catalog…</div>}>
      <SeoWithParams />
    </Suspense>
  );
}

function SeoWithParams() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller_id") || "";
  return <SeoWorkspace sellerId={sellerId} />;
}

function SeoWorkspace({ sellerId }: { sellerId?: string }) {
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const upsertProducts = useAmzStore((state) => state.upsertProducts);
  const updateProductSEO = useAmzStore((state) => state.updateProductSEO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [operation, setOperation] = useState("");
  const [operationStatus, setOperationStatus] = useState("");
  const [operationResult, setOperationResult] = useState<Record<string, unknown> | null>(null);
  const [isApprover, setIsApprover] = useState(false);
  const [optimizationMode, setOptimizationMode] = useState<"free" | "paid">("free");
  const [helium10Token, setHelium10Token] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [drawerMode, setDrawerMode] = useState<"view" | "optimize">("optimize");
  const [seoDraft, setSeoDraft] = useState<SeoDraft>({
    title: "",
    bullets: "",
    backendKeywords: "",
    description: "",
  });
  const [addProductOpen, setAddProductOpen] = useState(false);
  const editorDialogRef = useRef<HTMLDialogElement>(null);
  const editorId = useId();

  // Revision approval state
  const [revisions, setRevisions] = useState<ProductRevision[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(true);
  const [reviewRevisionOpen, setReviewRevisionOpen] = useState<{ id: string; status: string; action: "approve" | "reject" } | null>(null);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Setup modals
  const [bulkRewriteOpen, setBulkRewriteOpen] = useState(false);
  const [aiRewriteOpen, setAiRewriteOpen] = useState(false);
  const [healthScoreOpen, setHealthScoreOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/access", { cache: "no-store" }).then((response) => response.json()).then((payload) => {
      if (active) setIsApprover(Boolean(payload.isApprover));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts({ page_size: 200 });
        if (active) hydrateProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load catalog products");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [hydrateProducts]);

  useEffect(() => {
    let active = true;
    const loadRevisions = async () => {
      setRevisionsLoading(true);
      try {
        const payload = await provider.getProductRevisions();
        if (active) setRevisions(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load product revisions");
      } finally {
        if (active) setRevisionsLoading(false);
      }
    };
    void loadRevisions();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const dialog = editorDialogRef.current;
    if (drawerId && dialog && !dialog.open) dialog.showModal();
  }, [drawerId]);

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

  async function queueOptimization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/catalog/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: "", sku: undefined, seller_id: sellerId, optimization_mode: optimizationMode, helium10_api_key: helium10Token || undefined }),
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

  async function sendToApproval(productId: string) {
    try {
      await provider.updateProduct(productId, { opt_status: "pending_approval" });
      editorDialogRef.current?.close();
      const payload = await provider.getProducts({ page_size: 200 });
      hydrateProducts(payload.products);
      setMessage("Sent to approval.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed to send to approval");
    }
  }

  function openEditor(product: Product) {
    setSeoDraft({
      title: product.title,
      bullets: product.bullets.join("\n"),
      backendKeywords: product.backend_keywords.join(", "),
      description: product.description,
    });
    setDrawerId(product.id);
    setDrawerMode("optimize");
  }

  async function saveSeoDraft() {
    const product = products.find((item) => item.id === drawerId);
    if (!product) throw new Error("The selected catalog product is no longer available.");

    const updatedFields = {
      title: seoDraft.title.trim(),
      bullets: seoDraft.bullets.split("\n").map((bullet) => bullet.trim()).filter(Boolean),
      backend_keywords: seoDraft.backendKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean),
      description: seoDraft.description.trim(),
    };
    const updatedProduct = await provider.updateProduct(product.id, updatedFields);
    upsertProducts([updatedProduct]);
    updateProductSEO(product.sku, updatedFields);
    setMessage(`Mock listing ${product.sku} saved. No Amazon listing was changed.`);
  }

  async function decideRevision(id: string, action: "approve" | "reject") {
    setIsSaving(true);
    setError("");
    try {
      await provider.decideRevision(id, action);
      const payload = await provider.getProductRevisions();
      setRevisions(payload);
      setSelectedRevisionIds((selected) => selected.filter((selectedId) => selectedId !== id));
      setReviewRevisionOpen(null);
      setMessage(`Mock revision ${id} ${action === "approve" ? "approved" : "rejected"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Revision decision failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function approveSelectedRevisions() {
    const selected = eligibleRevisions.filter((revision) => selectedRevisionIds.includes(revision.id));
    if (!selected.length) return;
    setIsSaving(true);
    setError("");
    try {
      for (const revision of selected) await provider.decideRevision(revision.id, "approve");
      setRevisions(await provider.getProductRevisions());
      setSelectedRevisionIds([]);
      setMessage(`Approved ${selected.length} selected mock revision${selected.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bulk revision approval failed");
      setRevisions(await provider.getProductRevisions());
    } finally {
      setIsSaving(false);
    }
  }

  const eligibleRevisions = revisions.filter((revision) => {
    if (revision.status !== "pending_approval") return false;
    const margin = (revision.field_changes as Record<string, { before: unknown; after: unknown }> | undefined)?.margin?.after;
    return margin === undefined || Number(margin) >= 18.5;
  });
  const allEligibleSelected = eligibleRevisions.length > 0 && eligibleRevisions.every((revision) => selectedRevisionIds.includes(revision.id));

  const selectedProduct = products.find((product) => product.id === drawerId);
  const suggestion = (operationResult?.suggestion as Record<string, unknown> | undefined) ?? {};

  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading catalog…</div>}>
      <main className="workspace-page bg-canvas">
        <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
              <Link href="/" className="flex items-center gap-1">
                <ArrowLeft size={13} />
                <span>Seller Operations</span>
              </Link>
              <span className="text-xs text-muted">/</span>
              <span>Catalog</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Listing Optimization / SEO</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Edit listing content, queue optimization, and review pending product-revision approvals.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
              <span>Catalog: Local Mock Data</span>
            </div>
            <Badge className="bg-amber-50 text-amber-800 border-amber-200">Algorithmic Listing Health Sentinel</Badge>
          </div>
        </header>

        <p role="status" aria-live="polite" className={message ? "mb-4 rounded-md border border-line bg-white px-3 py-2 text-xs text-on-surface-variant" : "sr-only"}>
          {message}
        </p>

        <div className="metrics metrics-five mb-6">
          <Metric label="Catalog Health Index" value="84.2 / 100" detail="+3.8 pts vs last crawl" accent="teal" tag="LIVE" />
          <Metric label="Critical SEO Deficits" value="34 SKUs" detail="▲ Title &lt;50c or back-..." accent="warn" tag="PRIORITY" />
          <Metric label="Indexation Rate" value="94.6%" detail="+1.2% organic coverage" accent="blue" tag="TARGET KEYWORDS" />
          <Metric label="Pending Revisions" value={eligibleRevisions.length.toLocaleString()} detail="Awaiting product-revision decision" accent="amber" tag="APPROVAL" />
          <Metric label="Suppressed / At-Risk" value={products.filter((p) => p.suppressed).length.toLocaleString()} detail="▲ Review suppressions" accent="rose" tag="URGENT" />
        </div>

        <div className="grid w-full grid-cols-1 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <div>
                  <h2 className="panel-title">Listing Optimization &amp; Search Frequency Rank Velocity</h2>
                  <div className="panel-subtitle">Distribution of listing scores across active ASINs and organic rank trajectory</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Badge className="bg-teal-50 text-teal-800 border-teal-200">Quality Tiers</Badge>
                  <Badge className="bg-indigo-50 text-indigo-800 border-indigo-200">Rank Velocity</Badge>
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200">Search Terms</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4 flex items-end justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted">Catalog Score Spectrum (1,428 Tracked Child Listings)</div>
                  <div className="flex items-end gap-1 text-[10px] font-semibold text-on-surface">
                    <span>Average: 84.2 LQS</span>
                  </div>
                </div>
                <div className="h-8 w-full bg-canvas rounded-md border border-line mb-4 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-[35%] bg-emerald-500/60" />
                  <div className="absolute left-[35%] top-0 bottom-0 w-[32%] bg-indigo-500/60" />
                  <div className="absolute left-[67%] top-0 bottom-0 w-[25%] bg-amber-500/60" />
                  <div className="absolute left-[92%] top-0 bottom-0 w-[8%] bg-rose-500/60" />
                </div>
                <div className="mt-6 h-64">
                  <div className="flex items-end justify-between text-[10px] font-semibold text-on-surface mb-2">
                    <span>AVERAGE ORGANIC RANK (PRIMARY SEED TARGETS · 30D TREND)</span>
                    <div className="flex items-center gap-2">
                      <span>Day 1: #18.4</span>
                      <span className="text-teal-700">→</span>
                      <span>Today: #9.2</span>
                    </div>
                  </div>
                  <div className="relative h-full">
                    <svg
                      aria-label="Illustrative average organic rank trend improving from 18.4 on day 1 to 9.2 today over 30 days."
                      className="w-full h-full"
                      role="img"
                      viewBox="0 0 400 200"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stop-color="#6366F1" />
                          <stop offset="100" stop-color="#A78BFA" />
                        </linearGradient>
                      </defs>
                      <path d="M 20 150 L 100 140 L 200 120 L 300 80 L 380 60" fill="none" stroke="url(#rankGrad)" strokeWidth={3} />
                      <circle cx="380" cy="60" r={4} fill="#6366F1" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Bot size={14} className="text-indigo-600" />
                  <div>
                    <h2 className="panel-title">AI Copy Generation &amp; Keyword Injection Queue</h2>
                    <div className="panel-subtitle">Sample listing suggestions can be reviewed locally; no catalog push is available.</div>
                  </div>
                </div>
                <Badge className="bg-amber-50 text-amber-800 border-amber-200">3 Actionable Proposals</Badge>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">+4.2K</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B07X3A8992</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Ergonomic Dual Lamp</Badge>
                      </div>
                      <div className="text-[10px] text-muted truncate">Suggested Title Expansion: .. with 24W Eye-Caring Gooseneck &amp; Touch Dimming, Architecture Clamp Base”</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">CP: 19.2%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B07X81M3L9</span>
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200">GaN65W Charger</Badge>
                      </div>
                      <div className="text-[10px] text-muted truncate">POLICY COMPLIANT BULLET 4 DRAFT: [CERTIFIED SAFE PROTECTION] Multi-protection system complies with UL62368 safety directives for overcurrent prevention.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-semibold">CR: 16.5%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B08K2PWQ6X</span>
                        <Badge className="bg-teal-50 text-teal-800 border-teal-200">Spanish Long-Tail Harvest</Badge>
                      </div>
                      <div className="text-[10px] text-muted truncate">Discovered Backend Search Strings: cargador rapido tipo c · pantalla lampa dual · bandejas elasticas gym</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-md border border-line bg-white/50">
                <Bot size={13} className="text-indigo-600" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-indigo-900">Mock Rate-Limit Example</div>
                  <div className="text-[10px] text-muted">Illustrative only · no API requests</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-indigo-900">DAILY TOKEN AI QUOTA</div>
                  <div className="text-[10px] font-bold text-on-surface">84.5% Remaining</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product-revision approvals */}
        <Card className="mb-6">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <h2 className="panel-title">Product-Revision Approvals</h2>
              <div className="panel-subtitle">Showing {revisions.length} sample revision requests · {selectedRevisionIds.length} selected</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={selectedRevisionIds.length === 0} onClick={() => setReviewRevisionOpen(null)}>
                Draft Counter-Offer
              </Button>
              <Button disabled={isSaving || selectedRevisionIds.length === 0} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void approveSelectedRevisions(); }}>
                {isSaving ? "Approving…" : `Bulk Approve (${selectedRevisionIds.length} Selected)`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="table-wrap">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-3" style={{width:34}}>
                      <input
                        type="checkbox"
                        aria-label="Select all eligible revisions"
                        checked={allEligibleSelected}
                        disabled={eligibleRevisions.length === 0}
                        onChange={(event) => setSelectedRevisionIds(event.target.checked ? eligibleRevisions.map((revision) => revision.id) : [])}
                      />
                    </th>
                    <th className="px-4 py-3">Revision</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {revisionsLoading ? (
                    <tr><td colSpan={5} className="text-center text-xs text-muted py-4">Loading revision requests…</td></tr>
                  ) : revisions.length ? revisions.map((revision) => {
                    const fc = (revision.field_changes as Record<string, { before: unknown; after: unknown }> | undefined)?.margin;
                    const over = fc && parseFloat(String(fc.after)) < 18.5;
                    return (
                      <tr key={revision.id} className="border-t border-line">
                        <td className="px-4 py-3 tabular-nums text-[10px] text-muted">
                          <input
                            type="checkbox"
                            aria-label={`Select revision ${revision.id}`}
                            checked={selectedRevisionIds.includes(revision.id)}
                            disabled={revision.status !== "pending_approval" || !eligibleRevisions.some((eligible) => eligible.id === revision.id)}
                            onChange={(event) => setSelectedRevisionIds((selected) => event.target.checked
                              ? [...selected, revision.id]
                              : selected.filter((id) => id !== revision.id))}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="product-name">{revision.id}</div>
                          <div className="product-meta text-[10px] text-muted">{revision.created_at}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="product-name">{revision.asin || revision.product_id}</div>
                          <div className="product-meta text-[10px] text-muted">Revision by {revision.created_by}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-teal-50 text-teal-800 border-teal-200">{revision.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {revision.status === "pending_approval" ? (
                            <>
                              <Button variant="outline" disabled={Boolean(over) || isSaving} onClick={() => setReviewRevisionOpen({ id: revision.id, status: revision.status, action: "approve" })}>
                                Approve &amp; Release
                              </Button>
                              <Button variant="outline" className="text-[10px]" onClick={() => setReviewRevisionOpen({ id: revision.id, status: revision.status, action: "reject" })}>
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Badge className="bg-teal-50 text-teal-800 border-teal-200">{revision.status}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="text-center text-xs text-muted py-4">No product-revision requests.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-right text-[10px] text-muted">
          Product-revision decisions are simulated in local mock state. No catalog changes are sent to Amazon.
        </p>

        {drawerId && selectedProduct && (
          <dialog
            ref={editorDialogRef}
            aria-labelledby={`${editorId}-title`}
            className="fixed inset-0 z-50 m-0 max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-xl border border-muted bg-white p-0 shadow-2xl backdrop:bg-black/40"
            onClose={() => setDrawerId("")}
            onClick={(event) => {
              if (event.target === event.currentTarget) editorDialogRef.current?.close();
            }}
          >
            <div className="flex max-h-[90dvh] flex-col">
              <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <h2 id={`${editorId}-title`} className="text-sm font-bold text-on-surface">
                    {drawerMode === "view" ? "View listing" : "Optimize listing"}
                  </h2>
                  <p className="truncate text-xs text-on-surface-variant">
                    {selectedProduct.sku} · {selectedProduct.asin}
                  </p>
                </div>
                <button
                  aria-label="Close listing editor"
                  className="button button-outline button-sm shrink-0"
                  type="button"
                  onClick={() => editorDialogRef.current?.close()}
                >
                  Close
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <section aria-labelledby={`${editorId}-current-heading`}>
                    <h3 id={`${editorId}-current-heading`} className="mb-3 text-xs font-bold text-on-surface">
                      Current listing · SEO score {selectedProduct.seoScore}
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="compare-field"><span>Title</span><div className="field-value">{selectedProduct.title}</div></div>
                      <div className="compare-field">
                        <span>Bullets</span>
                        <ul className="field-list">
                          {selectedProduct.bullets.length
                            ? selectedProduct.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)
                            : <li>No bullets</li>}
                        </ul>
                      </div>
                      <div className="compare-field"><span>Backend keywords</span><div className="field-value">{selectedProduct.backend_keywords.join(", ") || "None"}</div></div>
                      <div className="compare-field"><span>Description</span><div className="field-value">{selectedProduct.description || "None"}</div></div>
                      <div className="compare-field"><span>Images</span><div className="field-value">{selectedProduct.images.length} main images</div></div>
                    </div>
                  </section>
                  <section aria-labelledby={`${editorId}-edit-heading`}>
                    <h3 id={`${editorId}-edit-heading`} className="mb-3 text-xs font-bold text-on-surface">Edit listing content</h3>
                    <p className="mb-3 text-xs text-on-surface-variant">Fields marked (required) must be completed before saving.</p>
                    <form
                      className="optimize-form"
                      data-product-id={drawerId}
                      onSubmit={(event) => event.preventDefault()}
                    >
                      <div className="space-y-3">
                        <div className="compare-field">
                          <label htmlFor={`${editorId}-seo-title`} className="mb-1 block text-xs font-medium text-on-surface-variant">Title (required)</label>
                          <textarea
                            autoFocus
                            id={`${editorId}-seo-title`}
                            name="title"
                            required
                            value={seoDraft.title}
                            onChange={(event) => setSeoDraft((draft) => ({ ...draft, title: event.target.value }))}
                            className="w-full min-h-[44px] rounded-md border border-muted bg-white p-2 text-xs text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                          />
                        </div>
                        <div className="compare-field">
                          <label htmlFor={`${editorId}-seo-bullets`} className="mb-1 block text-xs font-medium text-on-surface-variant">Bullets, one per line (required)</label>
                          <textarea
                            id={`${editorId}-seo-bullets`}
                            name="bullets"
                            required
                            value={seoDraft.bullets}
                            onChange={(event) => setSeoDraft((draft) => ({ ...draft, bullets: event.target.value }))}
                            className="w-full min-h-[88px] rounded-md border border-muted bg-white p-2 text-xs text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                          />
                        </div>
                        <div className="compare-field">
                          <label htmlFor={`${editorId}-seo-keywords`} className="mb-1 block text-xs font-medium text-on-surface-variant">Backend keywords, comma-separated</label>
                          <input
                            id={`${editorId}-seo-keywords`}
                            name="backend_keywords"
                            value={seoDraft.backendKeywords}
                            onChange={(event) => setSeoDraft((draft) => ({ ...draft, backendKeywords: event.target.value }))}
                            className="w-full min-h-[36px] rounded-md border border-muted bg-white p-2 text-xs text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                          />
                        </div>
                        <div className="compare-field">
                          <label htmlFor={`${editorId}-seo-description`} className="mb-1 block text-xs font-medium text-on-surface-variant">Description</label>
                          <textarea
                            id={`${editorId}-seo-description`}
                            name="description"
                            value={seoDraft.description}
                            onChange={(event) => setSeoDraft((draft) => ({ ...draft, description: event.target.value }))}
                            className="w-full min-h-[66px] rounded-md border border-muted bg-white p-2 text-xs text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                          />
                        </div>
                        <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row sm:items-center">
                          <button className="button button-outline" type="button" onClick={() => editorDialogRef.current?.close()}>
                            Cancel
                          </button>
                          <button className="button button-outline" type="button" onClick={() => void sendToApproval(drawerId)}>
                            Send to approval
                          </button>
                          <SyncButtonSimulation onSync={saveSeoDraft} />
                        </div>
                      </div>
                    </form>
                  </section>
                </div>
              </div>
            </div>
          </dialog>
        )}
        <AddProductModal
          open={addProductOpen}
          onClose={() => setAddProductOpen(false)}
          onProductAdded={() => setMessage("Added to the local mock catalog.")}
        />

        {/* Modals */}
        <Modal open={bulkRewriteOpen} onClose={() => setBulkRewriteOpen(false)} title="Bulk AI Rewrite — Setup & Capabilities">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Bulk Rewrite Configuration</div>
              <div className="text-[10px] text-muted mb-3">Rewrite listing titles, bullets, and backend keywords across multiple ASINs at scale using deterministic scoring rules.</div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setBulkRewriteOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setBulkRewriteOpen(false)}>Start Bulk Rewrite</Button>
            </div>
          </div>
        </Modal>

        <Modal open={aiRewriteOpen} onClose={() => setAiRewriteOpen(false)} title="AI Copy Generation — Setup & Capabilities">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">AI Copy Settings</div>
              <div className="text-[10px] text-muted mb-3">Generate AI-powered listing copy suggestions for titles, bullets, descriptions, and backend keywords.</div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setAiRewriteOpen(false)}>Cancel</Button>
              <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { setAiRewriteOpen(false); setMessage("AI copy generation queued for review."); }}>Generate AI Copy</Button>
            </div>
          </div>
        </Modal>

        <Modal open={healthScoreOpen} onClose={() => setHealthScoreOpen(false)} title="Listing Health Score — Details">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-bold text-indigo-900 mb-1">Health Score Breakdown</div>
              <div className="text-[10px] text-muted mb-3">Deterministic rules score 0–100 on title length/keywords, bullets, images, description, backend keywords, and suppression.</div>
              <HealthScoreBar score={null} missingKeywords={[]} mode="free" />
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setHealthScoreOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      </main>
    </Suspense>
  );
}
