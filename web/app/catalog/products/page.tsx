"use client";

import { useCallback, useEffect, useId, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit3, Plus, Search, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";

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

function StatusBadge({ opt_status, suppressed }: { opt_status: string; suppressed: boolean }) {
  if (suppressed) return <Badge className="bg-rose-50 text-rose-700 border-rose-200">Suppressed</Badge>;
  if (opt_status === "optimized") return <Badge className="bg-teal-50 text-teal-700 border-teal-200">Optimized</Badge>;
  if (opt_status === "needs_optimization") return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Needs Optimization</Badge>;
  if (opt_status === "pending_approval") return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Pending Approval</Badge>;
  return <Badge className="bg-canvas text-muted border-line">{opt_status}</Badge>;
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
  const router = useRouter();
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const upsertProducts = useAmzStore((state) => state.upsertProducts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [suppressionFilter, setSuppressionFilter] = useState<"all" | "suppressed" | "active">("all");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; price: number; category: string; bullets: string; description: string; backend_keywords: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
    setMessage("Added to the local mock catalog.");
  }

  function openEditor(product: Product) {
    setEditDraft({
      title: product.title,
      price: product.price,
      category: product.category,
      bullets: product.bullets.join("\n"),
      description: product.description,
      backend_keywords: product.backend_keywords.join(", "),
    });
    setEditingProductId(product.id);
  }

  async function saveEdits() {
    if (!editingProductId || !editDraft) return;
    setLoading(true);
    try {
      const updatedProduct = await provider.updateProduct(editingProductId, {
        title: editDraft.title,
        category: editDraft.category,
        price: editDraft.price,
        bullets: editDraft.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
        description: editDraft.description,
        backend_keywords: editDraft.backend_keywords.split(",").map((k) => k.trim()).filter(Boolean),
      });
      upsertProducts([updatedProduct]);
      setEditingProductId(null);
      setEditDraft(null);
      setMessage(`Mock listing ${updatedProduct.sku} updated.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save edits");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(asin: string) {
    if (!deleteConfirmId) return;
    setLoading(true);
    try {
      await fetch(`/api/products/${encodeURIComponent(deleteConfirmId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      setDeleteConfirmId(null);
      const payload = await provider.getProducts({ page_size: 200 });
      hydrateProducts(payload.products);
      setMessage(`Mock listing ${asin} deleted.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to delete product");
    } finally {
      setLoading(false);
    }
  }

  function goToOptimize(product: Product) {
    router.push(`/catalog/seo?product=${product.id}`);
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
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Review and manage your catalog listings. Click a row to edit, or use Optimize to open the SEO editor.</p>
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
                      <th scope="col" style={{width:220}} className="px-4 py-3">Title</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Score</th>
                    <th scope="col" style={{width:300}} className="px-4 py-3">Issues</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Stock</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Days Supply</th>
                    <th scope="col" className="px-4 py-3 tabular-nums">Price</th>
                    <th scope="col" style={{width:200}} className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="text-center text-xs text-muted py-4">Loading products…</td></tr>
                  ) : visibleProducts.length ? visibleProducts.map((product) => (
                    <tr key={product.asin} className="border-t border-line hover:bg-canvas/50 cursor-pointer group" onClick={() => openEditor(product)} style={{height:"66px"}}>
                      <th scope="row" className="px-4 py-3 text-left" style={{height:"66px"}}>{product.asin}</th>
                      <td className="px-4 py-3" style={{height:"66px"}}>{product.sku}</td>
                      <td className="px-4 py-3" title={product.title} style={{width:220, maxWidth:220, maxHeight:"66px", height:"66px", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", textOverflow:"ellipsis"}}>{product.title}</td>
                      <td className="px-4 py-3" style={{height:"66px"}}>{product.category}</td>
                      <td className="px-4 py-3" style={{height:"66px"}}><StatusBadge opt_status={product.opt_status} suppressed={product.suppressed} /></td>
                      <td className="px-4 py-3 tabular-nums" style={{height:"66px"}}>{product.seoScore}</td>
                      <td className="px-4 py-3 issue-cell" title={product.opt_issues?.join(" · ") || "—"} style={{width:220, maxWidth:220, maxHeight:"66px", height:"66px", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", textOverflow:"ellipsis"}}>
                        {product.opt_issues?.slice(0,3).map((issue: string) => <span className="issue-tag block" key={issue}>{issue}</span>)}
                        {!product.opt_issues?.length && <span className="issue-tag block muted">—</span>}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{height:"66px"}}>{product.stockLevel}</td>
                      <td className="px-4 py-3 tabular-nums" style={{height:"66px"}}>{Number.isFinite(product.daysSupply) ? product.daysSupply.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 tabular-nums" style={{height:"66px"}}>${product.price.toFixed(2)}</td>
                      <td className="px-4 py-3" style={{height:"66px"}}>
                        <div className="flex gap-1">
                          <Button variant="outline" onClick={(e) => { e.stopPropagation(); goToOptimize(product); }}>
                            <Edit3 size={12} className="mr-1" aria-hidden="true" /> Optimize
                          </Button>
                          {product.suppressed ? (
                            <Button variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(product.id); }}>
                              <AlertCircle size={12} className="mr-1" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Button variant="outline" className="text-teal-600 hover:bg-teal-50" onClick={(e) => { e.stopPropagation(); goToOptimize(product); }}>
                              <CheckCircle2 size={12} className="mr-1" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
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

        {editingProductId && editDraft && (
          <Modal open={true} onClose={() => setEditingProductId(null)} title={`Edit ${products.find((p) => p.id === editingProductId)?.sku || "Product"}`}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-title" className="block text-xs font-semibold text-muted mb-1">Title</label>
                  <input id="edit-title" type="text" value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} className="w-full h-9 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
                <div>
                  <label htmlFor="edit-category" className="block text-xs font-semibold text-muted mb-1">Category</label>
                  <input id="edit-category" type="text" value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} className="w-full h-9 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
                <div>
                  <label htmlFor="edit-price" className="block text-xs font-semibold text-muted mb-1">Price ($)</label>
                  <input id="edit-price" type="number" step="0.01" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: Number(e.target.value) || 0 })} className="w-full h-9 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-bullets" className="block text-xs font-semibold text-muted mb-1">Bullets (one per line)</label>
                  <textarea id="edit-bullets" rows={4} value={editDraft.bullets} onChange={(e) => setEditDraft({ ...editDraft, bullets: e.target.value })} className="w-full h-32 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-description" className="block text-xs font-semibold text-muted mb-1">Description</label>
                  <textarea id="edit-description" rows={3} value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} className="w-full h-24 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="edit-keywords" className="block text-xs font-semibold text-muted mb-1">Backend Keywords (comma-separated)</label>
                  <input id="edit-keywords" type="text" value={editDraft.backend_keywords} onChange={(e) => setEditDraft({ ...editDraft, backend_keywords: e.target.value })} className="w-full h-9 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:border-indigo-600" />
                </div>
              </div>
              <div className="p-3 rounded-md border border-line bg-indigo-50">
                <div className="text-[10px] font-bold text-indigo-800 mb-1">Mock workflow</div>
                <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                  <li>Edit product fields in local mock state</li>
                  <li>Changes update the catalog instantly</li>
                  <li>No Amazon listing is modified</li>
                </ul>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingProductId(null)}>Cancel</Button>
                <Button disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => { void saveEdits(); }}>{loading ? "Saving…" : "Save Changes"}</Button>
              </div>
            </div>
          </Modal>
        )}

        {deleteConfirmId && (
          <Modal open={true} onClose={() => setDeleteConfirmId(null)} title="Delete Product">
            <div className="space-y-4">
              <div className="p-3 rounded-md border border-line bg-rose-50">
                <div className="text-[10px] font-bold text-rose-800 mb-1">Confirm deletion</div>
                <p className="text-[10px] text-muted">This will remove the product from the local mock catalog. The action cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                <Button disabled={loading} className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => { void deleteProduct(deleteConfirmId); }}>{loading ? "Deleting…" : "Delete Product"}</Button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </Suspense>
    );
  }
