"use client";

import { useCallback, useEffect, useId, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { AddProductModal } from "@/components/product/AddProductModal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Product } from "@/lib/provider/types";
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
    </section>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">Loading catalog…</div>}>
      <ProductsWithParams />
    </Suspense>
  );
}

function ProductsWithParams() {
  const searchParams = useSearchParams();
  const sellerId = searchParams.get("seller_id") || "";
  return <ProductsWorkspace sellerId={sellerId} />;
}

function ProductsWorkspace({ sellerId }: { sellerId?: string }) {
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [suppressionFilter, setSuppressionFilter] = useState<"all" | "suppressed" | "active">("all");

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

  const visibleProducts = products.filter((product) => {
    if (suppressionFilter === "suppressed") return product.suppressed;
    if (suppressionFilter === "active") return !product.suppressed;
    return true;
  });

  async function addProductLocally(_title: string) {
    setMessage("Added to the local mock catalog. No Amazon listing was created.");
  }

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
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Products / Listings</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Review and manage your sample catalog listings. Add Product creates entries in local mock state only.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
              <span>Sample catalog data</span>
            </div>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setAddProductOpen(true)} icon-left={<Plus size={13} className="mr-2" />}>
              Add Product
            </Button>
          </div>
        </header>

        {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {message && <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}

        <div className="metrics metrics-five mb-6">
          <Metric label="Total Listings" value={products.length.toLocaleString()} detail="Sample catalog records" accent="blue" tag="MOCK DATA" />
          <Metric label="Active" value={products.filter((p) => !p.suppressed).length.toLocaleString()} detail="Not suppressed" accent="teal" tag="LIVE" />
          <Metric label="Suppressed" value={products.filter((p) => p.suppressed).length.toLocaleString()} detail="Hidden from buyers" accent="rose" tag="REVIEW" />
          <Metric label="Needs Optimization" value={products.filter((p) => p.opt_status === "needs_optimization").length.toLocaleString()} detail="Missing assets or issues" accent="amber" tag="OPTIMIZE" />
          <Metric label="Optimized" value={products.filter((p) => p.opt_status === "optimized").length.toLocaleString()} detail="Complete listing" accent="teal" tag="DONE" />
        </div>

        <Card className="mb-6">
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <h2 className="panel-title">Listing table</h2>
              <div className="panel-subtitle">One product record read by catalog, inventory, pricing, and approvals.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Suppression Status</span>
              <div className="flex items-center gap-1 border border-line rounded-md bg-canvas p-1 text-xs">
                <button
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${suppressionFilter === "all" ? "bg-amber-50 text-amber-800 border-amber-200" : "text-muted border-transparent hover:bg-canvas"}`}
                  aria-pressed={suppressionFilter === "all"}
                  onClick={() => setSuppressionFilter("all")}
                >
                  All
                </button>
                <button
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${suppressionFilter === "active" ? "bg-teal-50 text-teal-800 border-teal-200" : "text-muted border-transparent hover:bg-canvas"}`}
                  aria-pressed={suppressionFilter === "active"}
                  onClick={() => setSuppressionFilter("active")}
                >
                  Active
                </button>
                <button
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${suppressionFilter === "suppressed" ? "bg-rose-50 text-rose-800 border-rose-200" : "text-muted border-transparent hover:bg-canvas"}`}
                  aria-pressed={suppressionFilter === "suppressed"}
                  onClick={() => setSuppressionFilter("suppressed")}
                >
                  Suppressed
                </button>
              </div>
              <div className="text-right text-[10px] text-muted">
                Showing {visibleProducts.length.toLocaleString()} tracked product{visibleProducts.length === 1 ? "" : "s"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table aria-busy={loading} className="w-full text-left text-xs">
                <caption className="sr-only">Catalog products with optimization score, inventory, and edit actions</caption>
                <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" style={{minWidth:120}} className="px-4 py-3">ASIN</th>
                    <th scope="col" className="px-4 py-3">SKU</th>
                    <th scope="col" style={{minWidth:220}} className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Score</th>
                    <th scope="col" style={{width:300}} className="px-4 py-3">Issues</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Stock</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Days of supply</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Price</th>
                    <th scope="col" style={{width:170}} className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="text-center text-xs text-muted py-4">Loading products…</td></tr>
                  ) : visibleProducts.length ? visibleProducts.map((product) => {
                    const statusClass = product.opt_status === "optimized" ? "status good" : "status warn";
                    return (
                      <tr key={product.asin} className="border-t border-line">
                        <th scope="row" className="px-4 py-3 text-left">{product.asin}</th>
                        <td className="px-4 py-3">{product.sku}</td>
                        <td className="px-4 py-3">{product.title}</td>
                        <td className="px-4 py-3">{product.category}</td>
                        <td className="px-4 py-3"><span className={statusClass}>{product.opt_status}</span>{product.suppressed ? <span className="text-[10px] text-rose-600 ml-1">· suppressed</span> : null}</td>
                        <td className="px-4 py-3 tabular-nums">{product.seoScore}</td>
                        <td className="px-4 py-3 issue-cell">{product.opt_issues.length ? product.opt_issues.map((issue: string) => <span className="issue-tag" key={issue}>{issue}</span>) : <span className="issue-tag muted">—</span>}</td>
                        <td className="px-4 py-3 tabular-nums">{product.stockLevel}</td>
                        <td className="px-4 py-3 tabular-nums">{Number.isFinite(product.daysSupply) ? product.daysSupply.toFixed(1) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums">${product.price.toFixed(2)}</td>
                        <td className="px-4 py-3"><button className="button button-outline button-sm" type="button" disabled={loading}>
                          Optimize
                        </button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={11} className="text-center text-xs text-muted py-4">No products in catalog.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-3 text-[10px] text-muted">
              <span role="status" aria-live="polite" aria-atomic="true">
                Showing {visibleProducts.length} of {products.length} sample SKUs
              </span>
            </div>
          </CardContent>
        </Card>

        <p className="text-right text-[10px] text-muted">
          Catalog listings are simulated from local sample data. No Amazon listing is created or changed.
        </p>

        <AddProductModal
          open={addProductOpen}
          onClose={() => setAddProductOpen(false)}
          onProductAdded={addProductLocally}
        />
      </main>
    </Suspense>
    );
  }