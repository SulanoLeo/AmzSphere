"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Trash2, Edit3, ShieldCheck, Filter, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEO_CATEGORIES,
  SEED_TOOLS,
  getAllCategories,
  getAllMarketplaces,
  getCategoryRegistry,
  getPricingModels,
  marketplaceLabel,
  type Marketplace,
  type PricingModel,
  type SeoTool,
  type SeoToolCategory,
} from "@/lib/seo-tools";

type Tab = "tools" | "categories";

interface AdminToolFormData {
  name: string;
  short_description: string;
  category: SeoToolCategory;
  pricing_model: PricingModel;
  starting_price_usd: string;
  features: string;
  marketplaces: Marketplace[];
  rating: string;
  website_url: string;
  is_active: boolean;
}

export default function SeoToolsAdminPage() {
  const [tab, setTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<SeoTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminToolFormData>({
    name: "",
    short_description: "",
    category: "Keyword Research",
    pricing_model: "freemium",
    starting_price_usd: "",
    features: "",
    marketplaces: [],
    rating: "",
    website_url: "",
    is_active: true,
  });
  const [categories, setCategories] = useState(getCategoryRegistry());
  const [editingCategoryId, setEditingCategoryId] = useState<SeoToolCategory | null>(null);
  const [newCategoryId, setNewCategoryId] = useState<SeoToolCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ label: "", description: "", is_active: true });

  const availableToAdd = useMemo(
    () => SEO_CATEGORIES.filter((c) => !categories.some((existing) => existing.id === c.id)),
    [categories],
  );

  useEffect(() => {
    if (!editingCategoryId && availableToAdd.length > 0 && !newCategoryId) {
      setNewCategoryId(availableToAdd[0].id);
    }
  }, [editingCategoryId, availableToAdd, newCategoryId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [toolsRes, catsRes] = await Promise.all([
          fetch("/api/seo-tools?page_size=100", { cache: "no-store" }),
          fetch("/api/seo-tools/categories", { cache: "no-store" }),
        ]);
        if (!active) return;
        if (!toolsRes.ok) throw new Error("Failed to load tools");
        if (!catsRes.ok) throw new Error("Failed to load categories");
        const toolsData = await toolsRes.json();
        const catsData = await catsRes.json();
        setTools(Array.isArray(toolsData.tools) ? toolsData.tools : []);
        setCategories(Array.isArray(catsData) ? catsData : getCategoryRegistry());
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Failed to load admin data");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const inactiveCount = tools.filter((t) => !t.is_active).length;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({
      name: "",
      short_description: "",
      category: "Keyword Research",
      pricing_model: "freemium",
      starting_price_usd: "",
      features: "",
      marketplaces: [],
      rating: "",
      website_url: "",
      is_active: true,
    });
  }, []);

  const handleInputChange = useCallback(
    (key: keyof AdminToolFormData, value: unknown) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleAddEditTool = useCallback(async () => {
    const payload = {
      name: form.name,
      short_description: form.short_description,
      category: form.category,
      pricing_model: form.pricing_model,
      starting_price_usd: form.starting_price_usd === "" ? null : Number(form.starting_price_usd),
      features: form.features
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label, i) => ({ id: `feature-${i}`, label })),
      marketplaces: form.marketplaces,
      rating: form.rating === "" ? null : Number(form.rating),
      website_url: form.website_url,
      is_active: form.is_active,
    };
    const url = editingId ? `/api/seo-tools/${editingId}` : "/api/seo-tools";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.detail || data.errors || "Failed to save tool");
      return;
    }
    setError("");
    resetForm();
    setTools((prev) => {
      if (editingId) {
        return prev.map((t) => (t.id === editingId ? { ...t, ...data } : t));
      }
      return [...prev, data];
    });
  }, [editingId, form, resetForm]);

  const handleEditTool = useCallback((tool: SeoTool) => {
    setEditingId(tool.id);
    setForm({
      name: tool.name,
      short_description: tool.short_description,
      category: tool.category,
      pricing_model: tool.pricing_model,
      starting_price_usd: tool.starting_price_usd == null ? "" : String(tool.starting_price_usd),
      features: tool.features.map((f) => f.label).join(", "),
      marketplaces: tool.marketplaces,
      rating: tool.rating == null ? "" : String(tool.rating),
      website_url: tool.website_url,
      is_active: tool.is_active,
    });
  }, []);

  const handleDeleteTool = useCallback(async (id: string) => {
    if (!window.confirm("Delete this tool?")) return;
    const response = await fetch(`/api/seo-tools/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Failed to delete tool");
      return;
    }
    setError("");
    setTools((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  }, [editingId, resetForm]);

  const handleToggleActive = useCallback(async (tool: SeoTool) => {
    const response = await fetch(`/api/seo-tools/${tool.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !tool.is_active }),
    });
    if (!response.ok) {
      setError("Failed to update tool status");
      return;
    }
    const data = await response.json();
    setTools((prev) => prev.map((t) => (t.id === tool.id ? data : t)));
    setError("");
  }, []);

  // Categories
  const resetCategoryForm = useCallback(() => {
    setEditingCategoryId(null);
    setNewCategoryId(null);
    setCategoryForm({ label: "", description: "", is_active: true });
  }, []);

  const handleAddEditCategory = useCallback(async () => {
    const targetId = editingCategoryId ?? newCategoryId;
    if (!targetId) {
      setError("Choose a category id.");
      return;
    }
    const payload = { label: categoryForm.label, description: categoryForm.description, is_active: categoryForm.is_active };
    const url = editingCategoryId ? `/api/seo-tools/categories/${editingCategoryId}` : "/api/seo-tools/categories";
    const method = editingCategoryId ? "PATCH" : "POST";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.detail || data.errors || "Failed to save category");
      return;
    }
    setError("");
    resetCategoryForm();
    setCategories((prev) => {
      if (editingCategoryId) {
        return prev.map((c) => (c.id === editingCategoryId ? { ...c, ...data, id: targetId } : c));
      }
      return [...prev, { id: targetId, ...data }];
    });
  }, [editingCategoryId, newCategoryId, categoryForm, resetCategoryForm]);

  const handleEditCategory = useCallback((cat: (typeof categories)[number]) => {
    setEditingCategoryId(cat.id);
    setNewCategoryId(null);
    setCategoryForm({ label: cat.label, description: cat.description, is_active: cat.is_active });
  }, [categories]);

  const handleDeleteCategory = useCallback(async (id: SeoToolCategory) => {
    if (!window.confirm("Delete this category? Tools using it will block deletion.")) return;
    const response = await fetch(`/api/seo-tools/categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || "Failed to delete category");
      return;
    }
    setError("");
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (editingCategoryId === id) resetCategoryForm();
  }, [editingCategoryId, resetCategoryForm]);

  const handleCategoryInputChange = useCallback((key: string, value: unknown) => {
    setCategoryForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">SEO Tool Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Manage SEO tools &amp; categories</h1>
          <p className="mt-1 text-sm text-muted">
            Add, edit, enable/disable SEO tools and categories. Changes apply to the catalog immediately (in-memory mock).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setTab("tools")}
            className={cn("text-[10px]", tab === "tools" ? "bg-indigo-900 text-white" : "border bg-white text-muted")}
          >
            <Package size={14} className="mr-1" aria-hidden="true" />
            Tools ({tools.length})
          </Button>
          <Button
            onClick={() => setTab("categories")}
            className={cn("text-[10px]", tab === "categories" ? "bg-indigo-900 text-white" : "border bg-white text-muted")}
          >
            <Filter size={14} className="mr-1" aria-hidden="true" />
            Categories ({categories.length})
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {tab === "tools" ? (
        <>
          <Card className="border-line mb-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-indigo-950">{editingId ? "Edit tool" : "Add new tool"}</h2>
                {!editingId && (
                  <Button variant="outline" onClick={resetForm} className="h-8 text-[10px]">
                    Cancel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                    placeholder="e.g. Helium 10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleInputChange("category", e.target.value as SeoToolCategory)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {getAllCategories().map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Pricing model</label>
                  <select
                    value={form.pricing_model}
                    onChange={(e) => handleInputChange("pricing_model", e.target.value as PricingModel)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                  >
                    {getPricingModels().map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Starting price ($/mo)</label>
                  <input
                    type="number"
                    value={form.starting_price_usd}
                    onChange={(e) => handleInputChange("starting_price_usd", e.target.value)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Rating (0-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.rating}
                    onChange={(e) => handleInputChange("rating", e.target.value)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Website URL</label>
                  <input
                    value={form.website_url}
                    onChange={(e) => handleInputChange("website_url", e.target.value)}
                    className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Description</label>
                <textarea
                  value={form.short_description}
                  onChange={(e) => handleInputChange("short_description", e.target.value)}
                  rows={2}
                  className="w-full h-16 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Features (comma-separated)</label>
                <input
                  value={form.features}
                  onChange={(e) => handleInputChange("features", e.target.value)}
                  placeholder="Keyword research, Listing builder"
                  className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Marketplaces</label>
                <div className="flex flex-wrap gap-1">
                  {getAllMarketplaces().map((mp) => {
                    const active = form.marketplaces.includes(mp);
                    return (
                      <button
                        key={mp}
                        onClick={() => {
                          const next = active
                            ? form.marketplaces.filter((m) => m !== mp)
                            : [...form.marketplaces, mp];
                          handleInputChange("marketplaces", next);
                        }}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                          active
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-line bg-white text-muted hover:bg-canvas",
                        )}
                      >
                        {mp}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is-active"
                  checked={form.is_active}
                  onChange={() => handleInputChange("is_active", !form.is_active)}
                  className="rounded border-indigo-600 bg-canvas text-indigo-600 focus:ring-indigo-600"
                  type="checkbox"
                />
                <label htmlFor="is-active" className="text-[10px] font-semibold text-indigo-950">
                  Active
                </label>
              </div>
              <div className="pt-2">
                <Button onClick={handleAddEditTool} className="w-full text-[10px]">
                  {editingId ? "Save changes" : "Create tool"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-line">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-indigo-950">Tools ({tools.length})</h2>
                <span className="ml-auto text-[10px] text-muted">{inactiveCount} disabled</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-muted">Loading tools…</div>
              ) : tools.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">No tools found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-line">
                    <thead>
                      <tr className="border-b border-line bg-canvas">
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Name</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Category</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Model</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted text-right">Price</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Rating</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Marketplaces</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Status</th>
                        <th className="p-2 text-[10px] uppercase tracking-wide text-muted">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tools].sort((a, b) => a.name.localeCompare(b.name)).map((tool) => (
                        <tr key={tool.id} className="border-b border-line hover:bg-canvas/50 transition-colors group">
                          <td className="p-2 text-[10px]">
                            <div className="flex items-center gap-2">
                              <img src={tool.logo} alt="" className="h-5 w-5 rounded-md border border-line" loading="lazy" />
                              <span className="font-medium text-indigo-950 truncate">{tool.name}</span>
                            </div>
                          </td>
                          <td className="p-2 text-[10px] text-muted">{tool.category}</td>
                          <td className="p-2 text-[10px] text-muted capitalize">{tool.pricing_model}</td>
                          <td className="p-2 text-[10px] tabular-nums text-right">
                            {tool.starting_price_usd == null ? "Contact" : `$${tool.starting_price_usd}`}
                          </td>
                          <td className="p-2 text-[10px] tabular-nums">{tool.rating == null ? "—" : tool.rating.toFixed(1)}</td>
                          <td className="p-2 text-[10px] text-muted truncate" style={{ maxWidth: "160px" }}>
                            {tool.marketplaces.slice(0, 3).join(", ")}
                            {tool.marketplaces.length > 3 && ` +${tool.marketplaces.length - 3}`}
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => handleToggleActive(tool)}
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
                                tool.is_active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700",
                              )}
                            >
                              {tool.is_active ? "Active" : "Disabled"}
                            </button>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEditTool(tool)}
                                className="p-1 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
                                aria-label={`Edit ${tool.name}`}
                                title="Edit"
                              >
                                <Edit3 size={12} aria-hidden="true" />
                              </button>
                              <button
                                onClick={() => handleDeleteTool(tool.id)}
                                className="p-1 rounded-md text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                                aria-label={`Delete ${tool.name}`}
                                title="Delete"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card className="border-line mb-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-indigo-950">{editingCategoryId ? "Edit category" : "Add category"}</h2>
                {!editingCategoryId && (
                  <Button variant="outline" onClick={resetCategoryForm} className="h-8 text-[10px]">
                    Cancel
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {editingCategoryId ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Category id</label>
                  <span className="text-[10px] text-muted truncate block">{editingCategoryId}</span>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Category id (to re-add)</label>
                    {availableToAdd.length === 0 ? (
                      <p className="text-[10px] text-muted">All categories already exist.</p>
                    ) : (
                      <select
                        value={newCategoryId ?? ""}
                        onChange={(e) => setNewCategoryId(e.target.value as SeoToolCategory)}
                        className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                      >
                        {availableToAdd.map((c) => (
                          <option key={c.id} value={c.id}>{c.id}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Label</label>
                <input
                  value={categoryForm.label}
                  onChange={(e) => handleCategoryInputChange("label", e.target.value)}
                  className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Description</label>
                <input
                  value={categoryForm.description}
                  onChange={(e) => handleCategoryInputChange("description", e.target.value)}
                  className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="category-is-active"
                  checked={categoryForm.is_active}
                  onChange={() => handleCategoryInputChange("is_active", !categoryForm.is_active)}
                  className="rounded border-indigo-600 bg-canvas text-indigo-600 focus:ring-indigo-600"
                  type="checkbox"
                />
                <label htmlFor="category-is-active" className="text-[10px] font-semibold text-indigo-950">
                  Active
                </label>
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleAddEditCategory}
                  disabled={!editingCategoryId && availableToAdd.length === 0}
                  className="w-full text-[10px]"
                >
                  {editingCategoryId ? "Save category" : "Add category"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-line">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package size={14} className="text-indigo-600" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-indigo-950">Categories ({categories.length})</h2>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {categories.map((cat) => {
                  const toolCount = SEED_TOOLS.filter((t) => t.category === cat.id).length;
                  return (
                    <div key={cat.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-line bg-white hover:bg-canvas transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-indigo-950 truncate">{cat.label}</p>
                        <p className="text-[10px] text-muted truncate">{cat.description}</p>
                        <p className="text-[10px] text-muted">
                          {toolCount} tool{toolCount !== 1 ? "s" : ""} · {cat.is_active ? "Active" : "Disabled"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditCategory(cat)}
                          className="p-1 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
                          aria-label={`Edit ${cat.label}`}
                          title="Edit"
                        >
                          <Edit3 size={12} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 rounded-md text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${cat.label}`}
                          title="Delete"
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
