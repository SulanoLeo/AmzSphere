"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Search, List, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  computeMonthlyCost,
  filterAndSortTools,
  findTool,
  getAllCategories,
  getAllMarketplaces,
  getPricingModels,
  loadSelectionFromStorage,
  saveSelectionToStorage,
  SEED_TOOLS,
  type Marketplace,
  type PricingModel,
  type SeoTool,
  type SeoToolFilters,
  type SeoToolPage,
} from "@/lib/seo-tools";
import { CompareTable } from "@/components/seo-tools/CompareTable";
import { FilterSidebar } from "@/components/seo-tools/FilterSidebar";
import { StackPanel } from "@/components/seo-tools/StackPanel";
import { ToolCard } from "@/components/seo-tools/ToolCard";

interface ToolSelectorProps {}

export function ToolSelector(_props: ToolSelectorProps) {
  const [tools, setTools] = useState<SeoTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<SeoToolFilters>({
    page: 1,
    page_size: 12,
    sort: "relevance",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSelectionFromStorage());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const filtered = useMemo(() => filterAndSortTools([...tools], filters), [tools, filters]);
  const selectedTools = useMemo(
    () => tools.filter((t) => selectedIds.includes(t.id)),
    [tools, selectedIds],
  );
  const compareTools = useMemo(
    () => tools.filter((t) => compareIds.includes(t.id)),
    [tools, compareIds],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(filters.page ?? 1));
        params.set("page_size", "100");
        const response = await fetch(`/api/seo-tools?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load SEO tools");
        const data: SeoToolPage = await response.json();
        if (!active) return;
        setTools(data.tools);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Unable to load SEO tools");
        // Fall back to seed data so the UI still works offline/mock.
        setTools(SEED_TOOLS);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [filters.page, filters.page_size]);

  const handleSelect = useCallback((toolId: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
      saveSelectionToStorage(next);
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
    saveSelectionToStorage([]);
  }, []);

  const handleToggleCompare = useCallback((toolId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(toolId)) return prev.filter((id) => id !== toolId);
      const next = [...prev, toolId];
      return next.slice(0, 4);
    });
  }, []);

  const handleStartCompare = useCallback(() => {
    if (selectedTools.length < 2) return;
    setCompareIds(selectedTools.map((t) => t.id));
    setCompareOpen(true);
  }, [selectedTools]);

  const handleChangeFilters = useCallback((next: Partial<SeoToolFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ page: 1, page_size: 12, sort: "relevance" });
  }, []);

  const monthlyCost = computeMonthlyCost(selectedTools);

  return (
    <section className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">SEO Tool Selector</p>
            <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Amazon SEO Tool Selector</h1>
            <p className="mt-1 text-sm text-muted">
              Browse, filter, compare, and save your Amazon SEO stack. Seed data is sample data for demo purposes.
            </p>
          </div>
          <Button
            onClick={handleClearSelection}
            disabled={selectedTools.length === 0}
            className="text-[10px] text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
          >
            <AlertTriangle size={14} className="mr-2" aria-hidden="true" />
            Clear stack
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-100 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
          <FilterSidebar
            filters={filters}
            onChange={handleChangeFilters}
            categories={getAllCategories()}
            pricingModels={getPricingModels()}
            marketplaces={getAllMarketplaces()}
            totalTools={tools.length}
            filteredTools={filtered.total}
            onClear={handleClearFilters}
          />

          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <List size={14} className="text-teal-700" aria-hidden="true" />
                <span className="text-xs font-bold text-muted uppercase tracking-tighter">
                  Tools ({filtered.total} of {tools.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-indigo-950">
                  Stack: {selectedTools.length} · ${monthlyCost.toLocaleString()}/mo
                </span>
                <Button
                  variant="outline"
                  onClick={handleStartCompare}
                  disabled={selectedTools.length < 2}
                  className="h-8 text-[10px] text-indigo-600 border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Compare {selectedTools.length} selected
                </Button>
              </div>
            </div>

            <Card className="border-line">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search size={14} className="text-muted" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-indigo-950">Catalog</h3>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading && tools.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2" />
                    <p className="text-xs text-muted">Loading tools…</p>
                  </div>
                ) : filtered.tools.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted">No tools match your filters.</p>
                    <Button variant="outline" onClick={handleClearFilters} className="mt-2">
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.tools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        isSelected={selectedIds.includes(tool.id)}
                        onToggle={handleSelect}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <StackPanel
              selectedTools={selectedTools}
              onRemove={(toolId) => {
                setSelectedIds((prev) => {
                  const next = prev.filter((id) => id !== toolId);
                  saveSelectionToStorage(next);
                  return next;
                });
              }}
              onClear={handleClearSelection}
              onCompare={handleStartCompare}
            />
          </div>
        </div>
      </div>

      {compareOpen && compareTools.length > 0 && (
        <CompareTable tools={compareTools} onClose={() => setCompareOpen(false)} />
      )}
    </section>
  );
}

export default function SeoToolsPage() {
  return <ToolSelector />;
}
