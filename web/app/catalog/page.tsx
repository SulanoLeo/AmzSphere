"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bot, LoaderCircle, Search, ToggleRight, ToggleLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StorefrontView } from "@/components/product/StorefrontView";
import { ApiIntegrationStatus } from "@/components/ApiIntegrationStatus";
import { HealthScoreBar } from "@/components/HealthScoreBar";
import { ClientProductProvider } from "@/lib/provider/client";
import type { Dashboard, Product } from "@/lib/provider/types";

function CatalogWorkspace() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller_id") || "";
  const provider = new ClientProductProvider();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
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
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts();
        if (active) setProducts(payload.products);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, [provider]);

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

  async function queueOptimization(event: React.FormEvent<HTMLFormElement>) {
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

  async function handleAddProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("add-name") || "").trim();
    const newSku = String(formData.get("add-sku") || "").trim();
    const newAsin = String(formData.get("add-asin") || "").trim();
    const title = String(formData.get("add-title") || "").trim() || name;
    const category = String(formData.get("add-category") || "").trim() || "General";
    const price = Number(formData.get("add-price")) || 0;
    const stock = Number(formData.get("add-stock")) || 0;
    const velocity = Number(formData.get("add-velocity")) || 0;

    if (!name || !newSku || !newAsin) {
      setMessage("Name, SKU, and ASIN are required.");
      return;
    }

    try {
      setBusy(true);
      await provider.addProduct({
        asin: newAsin,
        sku: newSku,
        marketplace_id: "ATVPDKIKX0DER",
        seller_id: "mock-seller",
        source: "manual",
        name,
        title,
        category,
        price,
        bullets: [],
        description: "",
        backend_keywords: [],
        images: [],
        sellable_units: stock,
        stock,
        days_of_supply: Math.round(stock / Math.max(velocity || 1, 0.1)) || 0,
        daily_velocity: velocity,
        competitor_price: price,
        market_price: price,
        min_floor: Math.round(price * 0.8),
        max_price: Math.round(price * 1.2),
        unit_cost: Math.round(price * 0.5),
        lead_time_days: 21,
        supplier: "Manual entry",
        parent_asin: null,
        variation_theme: null,
        supplier_id: null,
        po_draft_id: null,
        suppressed: false,
        last_synced_at: null,
        sync_status: "synced",
        last_optimized_at: null,
        opt_score: 0,
        opt_issues: [],
        opt_status: "needs_optimization",
      });
      setAddModal(false);
      setMessage("Product added.");
      const payload = await provider.getProducts();
      setProducts(payload.products);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed to add product");
    } finally {
      setBusy(false);
      form.reset();
    }
  }

  async function sendToApproval(productId: string) {
    try {
      await provider.updateProduct(productId, { opt_status: "pending_approval" });
      setDrawerId("");
      const payload = await provider.getProducts();
      setProducts(payload.products);
      setMessage("Sent to approval.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Failed to send to approval");
    }
  }

  const suggestion = (operationResult?.suggestion as Record<string, unknown> | undefined) ?? {};
  const healthScore = suggestion.health_score as number | null ?? null;
  const missingKeywords = (suggestion.missing_high_volume_keywords as Array<{ keyword: string; search_volume?: number; organic_rank?: number }> | undefined) ?? [];

  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading catalog…</div>}>
      <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      {/* Header */}
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>SEO & Catalog</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">SEO & Catalog Optimizer</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Search by ASIN, SKU, Title, Seed Keyword · All Optimization Grades</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>All Marketplaces</span>
            <span className="text-teal-700 font-semibold">▼</span>
          </div>
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>US (.com)</span>
            <span className="text-teal-700 font-semibold">▼</span>
          </div>
          <Badge className="bg-teal-50 text-teal-800 border-teal-200">Prime Eligible</Badge>
          <Button variant="outline" onClick={() => {}}>
            Export Report
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs font-medium text-on-surface-variant">
          <Badge className="bg-teal-50 text-teal-800 border-teal-200">Catalog Sync: Live · SP-API (v2024-09)</Badge>
          <Badge className="bg-amber-50 text-amber-800 border-amber-200">Algorithmic Listing Health Sentinel</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon-left={<Bot size={13} className="mr-2" />}>
            Generate AI Rewrites
          </Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" icon-left={<Search size={13} className="mr-2" />}>
            Run Bulk Audit
          </Button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="metrics metrics-five mb-6">
        <Metric
          label="Catalog Health Index"
          value="84.2 / 100"
          detail="+3.8 pts vs last crawl"
          accent="teal"
          tag="LIVE"
        />
        <Metric
          label="Critical SEO Deficits"
          value="34 SKUs"
          detail="▲ Title &lt;50c or back-..."
          accent="warn"
          tag="PRIORITY"
        />
        <Metric
          label="Indexation Rate"
          value="94.6%"
          detail="+1.2% organic coverage"
          accent="blue"
          tag="TARGET KEYWORDS"
        />
        <Metric
          label="Brand Story"
          value="91.8%"
          detail="118 ASINs lack Modul..."
          accent="blue"
          tag="CONVERSION LIFT EST."
        />
        <Metric
          label="Suppressed / At-Risk"
          value="2 ASINs"
          detail="▲ Limp policy, I search GMV"
          accent="rose"
          tag="URGENT"
        />
      </div>

      {/* Listings Optimization & Search Frequency */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
                <div className="absolute bottom-[-22px] left-0 w-[25%] text-[10px] text-muted text-center">Grade A (90–100)</div>
                <div className="absolute bottom-[-22px] left-[35%] w-[30%] text-[10px] text-muted text-center">Grade B (75–89)</div>
                <div className="absolute bottom-[-22px] left-[67%] w-[25%] text-[10px] text-muted text-center">Grade C (60–74)</div>
                <div className="absolute bottom-[-22px] left-[92%] w-[8%] text-[10px] text-muted text-center">Grade D (&lt;60)</div>
              </div>
              <div className="flex items-center justify-between text-[10px] mt-2">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> Grade A (90–100)
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-indigo-500" /> Grade B (75–89)
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> Grade C (60–74)
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-rose-500" /> Grade D (&lt;60)
                </div>
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
                  <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
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

              <div className="mt-6 flex items-center justify-between gap-4 p-4 rounded-md bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-indigo-100">
                    <Bot size={16} className="text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-indigo-900">AI COPILOT RECOMMENDATION</div>
                    <div className="text-xs text-indigo-700">18 high-volume search queries detected with zero organic indexation across your Electronics category.</div>
                  </div>
                </div>
                <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
                  Auto-Inject to Backend Terms ⚡
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <h2 className="panel-title">Simulated Amazon Storefront</h2>
                  <p className="panel-subtitle">Live listing preview updated reactively from sourcing inputs.</p>
                </div>
                <Badge>Preview</Badge>
              </CardHeader>
              <CardContent>
                <StorefrontView />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <h2 className="panel-title">Shared product table</h2>
                  <p className="panel-subtitle">One product record read by catalog, inventory, pricing, and approvals.</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Filters</span>
                  <div className="flex items-center gap-1 border border-line rounded-md bg-canvas p-1 text-xs">
                    <button className="px-2 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border-amber-200">Suppression Status: All</button>
                    <button className="px-2 py-1 rounded-md text-[10px] font-semibold text-muted border-transparent hover:bg-canvas">Brand: All (3)</button>
                  </div>
                  <div className="text-right text-[10px] text-muted">Showing 5 of 1,428 tracked products</div>
                  <button className="button button-outline button-sm" type="button" onClick={() => { setAddTab("import"); setAddModal(true); }}>
                    Bulk AI Rewrite
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                      <tr>
                        <th style={{width:34}}></th>
                        <th className="px-4 py-3">ASIN</th>
                        <th className="px-4 py-3">SKU</th>
                        <th style={{minWidth:220}} className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 tabular-nums">Score</th>
                        <th style={{width:300}} className="px-4 py-3">Issues</th>
                        <th className="px-4 py-3 tabular-nums">Stock</th>
                        <th className="px-4 py-3 tabular-nums">Days of supply</th>
                        <th className="px-4 py-3 tabular-nums">Price</th>
                        <th style={{width:170}} className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={12} className="text-center text-xs text-muted py-4">Loading products…</td></tr>
                      ) : products.length ? products.map((product) => {
                        const statusClass = product.opt_status === "optimized" ? "status good" : "status warn";
                        return (
                          <tr key={product.asin} className="border-t border-line">
                            <td className="px-4 py-3 tabular-nums text-[10px] text-muted">☐</td>
                            <td className="px-4 py-3">{product.asin}</td>
                            <td className="px-4 py-3">{product.sku}</td>
                            <td className="px-4 py-3">{product.title}</td>
                            <td className="px-4 py-3">{product.category}</td>
                            <td className="px-4 py-3"><span className={statusClass}>{product.opt_status}</span></td>
                            <td className="px-4 py-3 tabular-nums">{product.opt_score}</td>
                            <td className="px-4 py-3 issue-cell">{product.opt_issues.length ? product.opt_issues.map((issue) => <span className="issue-tag" key={issue}>{issue}</span>) : <span className="issue-tag muted">—</span>}</td>
                            <td className="px-4 py-3 tabular-nums">{product.stock}</td>
                            <td className="px-4 py-3 tabular-nums">{product.days_of_supply}</td>
                            <td className="px-4 py-3 tabular-nums">${product.price.toFixed(2)}</td>
                            <td className="px-4 py-3"><button className="button button-outline button-sm" type="button" onClick={() => { setDrawerId(product.id); setDrawerMode("optimize"); }}>Optimize</button></td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={12} className="text-center text-xs text-muted py-4">No products in catalog.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span>Rows per page:</span>
                    <select className="rounded-md border border-line bg-white px-2 text-[10px]" defaultValue={5}>
                      <option>5</option>
                      <option>10</option>
                      <option>25</option>
                      <option>50</option>
                    </select>
                    <span>Page 1 of 286</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="button button-outline button-sm disabled">Previous</button>
                    <button className="button button-primary button-sm">1</button>
                    <button className="button button-outline button-sm">2</button>
                    <button className="button button-outline button-sm">3</button>
                    <span className="px-2 text-[10px] text-muted">...</span>
                    <button className="button button-outline button-sm">286</button>
                    <button className="button button-outline button-sm">Next</button>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted">Row actions: Optimize (opens side-by-side current vs suggested copy) · View. Bulk select with "Optimize selected". Add product opens Import from Amazon (ASIN/SKU) or Create manually.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          {/* AI Copy Generation Queue */}
          <Card>
            <CardHeader className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-indigo-600" />
                <div>
                  <h3 className="panel-title">AI Copy Generation &amp; Keyword Injection Queue</h3>
                  <div className="panel-subtitle">Automated search optimization actions ready for SP-API live catalogue push</div>
                </div>
              </div>
              <Badge className="bg-amber-50 text-amber-800 border-amber-200">3 Actionable Proposals</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">+4.2K</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B07X3A8992</span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Ergonomic Dual Lamp</Badge>
                    </div>
                    <div className="text-[10px] text-muted truncate">Suggested Title Expansion: .. with 24W Eye-Caring Gooseneck &amp; Touch Dimming, Architecture Clamp Base”</div>
                    <div className="mt-2 flex items-center justify-between">
                      <Button className="bg-indigo-600 text-white text-[10px] px-3 py-1.5">Approve &amp; Push to Amazon SP-API ▶</Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">CP: 19.2%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B07X81M3L9</span>
                      <Badge className="bg-amber-50 text-amber-800 border-amber-200">GaN65W Charger</Badge>
                    </div>
                    <div className="text-[10px] text-muted truncate">POLICY COMPLIANT BULLET 4 DRAFT: [CERTIFIED SAFE PROTECTION] Multi-protection system complies with UL62368 safety directives for overcurrent prevention.</div>
                    <div className="mt-2 flex items-center justify-between">
                      <Button variant="outline" className="text-[10px] px-3 py-1.5">Review &amp; Resolve Suppression</Button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border border-line bg-white/50">
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-semibold">CR: 16.5%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-indigo-900 truncate">ASIN: B08K2PWQ6X</span>
                      <Badge className="bg-teal-50 text-teal-800 border-teal-200">Spanish Long-Tail Harvest</Badge>
                    </div>
                    <div className="text-[10px] text-muted truncate">Discovered Backend Search Strings: cargador rapido tipo c · pantalla lampa dual · bandejas elasticas gym</div>
                    <div className="mt-2 flex items-center justify-between">
                      <Button variant="outline" className="text-[10px] px-3 py-1.5">Apply to 34 Parent ASINs ▶</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-md border border-line bg-white/50">
              <Bot size={13} className="text-indigo-600" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-indigo-900">SP-API Rate Ceiling</div>
                <div className="text-[10px] text-muted">18.4 / 20.0 rps</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold text-indigo-900">DAILY TOKEN AI QUOTA</div>
                <div className="text-[10px] font-bold text-on-surface">84.5% Remaining</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {drawerId && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setDrawerId("")} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl border border-line shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/90 sticky top-0 z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{drawerMode === "view" ? "View listing" : "Optimize listing"}</span>
                  <span className="text-[10px] text-muted truncate block">{drawerId} · {drawerId}</span>
                </div>
                <button className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors" onClick={() => setDrawerId("")}>
                  <span className="sr-only">Close</span>
                  <span className="block w-5 h-5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="compare-head">Current · score —</div>
                    <div className="space-y-3">
                      <div className="compare-field"><span>Title</span><div className="field-value">—</div></div>
                      <div className="compare-field"><span>Bullets</span><ul className="field-list"><li>—</li></ul></div>
                      <div className="compare-field"><span>Backend keywords</span><div className="field-value">—</div></div>
                      <div className="compare-field"><span>Description</span><div className="field-value">—</div></div>
                      <div className="compare-field"><span>Images</span><div className="field-value">0 main</div></div>
                    </div>
                  </div>
                  <div>
                    <form className="optimize-form" data-product-id={drawerId}>
                      <div className="space-y-3">
                        <div className="compare-field">
                          <span>Title</span>
                          <textarea name="title" required className="w-full min-h-[44px] p-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                        </div>
                        <div className="compare-field">
                          <span>Bullets (one per line)</span>
                          <textarea name="bullets" required className="w-full min-h-[88px] p-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                        </div>
                        <div className="compare-field">
                          <span>Backend keywords (comma-separated)</span>
                          <input name="backend_keywords" defaultValue="" className="w-full min-h-[30px] p-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                        </div>
                        <div className="compare-field">
                          <span>Description</span>
                          <textarea name="description" className="w-full min-h-[66px] p-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                        </div>
                        <div className="compare-actions flex justify-end gap-2 pt-4">
                          {drawerMode === "view" ? (
                            <button className="button button-outline" type="button" onClick={() => setDrawerId("")}>Close</button>
                          ) : (
                            <>
                              <button className="button button-outline" type="button" onClick={() => setDrawerId("")}>Cancel</button>
                              <button className="button button-outline" type="button">Save draft</button>
                              <button className="button button-primary" type="button" onClick={() => void sendToApproval(drawerId)}>Send to approval</button>
                            </>
                          )}
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {addModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md max-h-[92vh] bg-white rounded-xl border border-line shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/90 sticky top-0 z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Add product</span>
                  <span className="text-[10px] text-muted block">Import from Amazon or create manually</span>
                </div>
                <button className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors" onClick={() => setAddModal(false)}>
                  <span className="sr-only">Close</span>
                  <span className="block w-5 h-5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="tabs mb-4">
                  <button className={`tab ${addTab === "import" ? "tab-active" : ""}`} type="button" onClick={() => setAddTab("import")}>Import from Amazon</button>
                  <button className={`tab ${addTab === "manual" ? "tab-active" : ""}`} type="button" onClick={() => setAddTab("manual")}>Create manually</button>
                </div>
                {addTab === "import" && (
                  <div className="tab-panel" id="add-tab-import">
                    <p className="hint text-[10px] text-muted mb-3">Look up a product by ASIN or SKU. Re-importing upserts by ASIN + marketplace.</p>
                    <form id="add-import-form" className="flex gap-2 align-end mb-4" onSubmit={(e) => { e.preventDefault(); }}>
                      <input name="ref" type="text" placeholder="ASIN or SKU" required className="flex-1 min-h-[34px] px-3 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      <button type="submit" className="button button-primary min-h-[36px]">Import</button>
                    </form>
                  </div>
                )}
                {addTab === "manual" && (
                  <div className="tab-panel" id="add-tab-manual">
                    <form id="add-manual-form" className="grid grid-cols-1 sm:grid-cols-2 gap-4" onSubmit={handleAddProduct}>
                      <div className="sm:col-span-2">
                        <label className="form-label text-[10px] font-bold text-muted">Product name</label>
                        <input name="add-name" type="text" placeholder="e.g. Bamboo Desk Organizer" required className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">SKU</label>
                        <input name="add-sku" type="text" placeholder="e.g. BD-OG-01" required className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">ASIN</label>
                        <input name="add-asin" type="text" placeholder="e.g. B0XYZ12345" required className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">Listing title</label>
                        <input name="add-title" type="text" placeholder="Defaults to product name" className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">Category</label>
                        <input name="add-category" type="text" placeholder="e.g. Office" className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">Price ($)</label>
                        <input name="add-price" type="number" step="0.01" placeholder="24.99" className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">Stock units</label>
                        <input name="add-stock" type="number" step="1" placeholder="500" className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div>
                        <label className="form-label text-[10px] font-bold text-muted">Daily velocity</label>
                        <input name="add-velocity" type="number" step="0.1" placeholder="15" className="w-full min-h-[30px] px-2 border border-line rounded-md text-[10px] focus:outline-none focus:border-teal-700" />
                      </div>
                      <div className="sm:col-span-2 flex gap-2 pt-4">
                        <button type="button" className="button button-outline flex-1" onClick={() => setAddModal(false)}>Cancel</button>
                        <button type="submit" form="add-manual-form" className="button button-primary flex-1">Create product</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
      </Suspense>
  );
}

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

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading catalog…</div>}>
      <CatalogWorkspace />
    </Suspense>
  );
}
