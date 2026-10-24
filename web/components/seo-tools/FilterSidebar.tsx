"use client";

import { useCallback, useMemo, useState } from "react";

import { Filter, X, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  Marketplace,
  PricingModel,
  SeoToolCategory,
  SeoToolFilters,
} from "@/lib/seo-tools";

interface FilterSidebarProps {
  filters: SeoToolFilters;
  onChange: (filters: Partial<SeoToolFilters>) => void;
  categories: SeoToolCategory[];
  pricingModels: PricingModel[];
  marketplaces: Marketplace[];
  totalTools: number;
  filteredTools: number;
  onClear: () => void;
}

const CATEGORY_LABELS: Record<SeoToolCategory, string> = {
  "Keyword Research": "Keyword Research",
  "Listing Optimization": "Listing Optimization",
  "Rank Tracking": "Rank Tracking",
  "PPC/Advertising": "PPC / Advertising",
  "Product Research": "Product Research",
  "Review & Feedback": "Review & Feedback",
  Analytics: "Analytics",
  "Competitor Analysis": "Competitor Analysis",
};

const PRICING_LABELS: Record<PricingModel, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
};

export function FilterSidebar({
  filters,
  onChange,
  categories,
  pricingModels,
  marketplaces,
  totalTools,
  filteredTools,
  onClear,
}: FilterSidebarProps) {
  const [expanded, setExpanded] = useState(true);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.category) count += 1;
    if (filters.pricing_model) count += 1;
    if (filters.marketplace) count += 1;
    if (filters.min_rating != null) count += 1;
    if (filters.min_price != null) count += 1;
    if (filters.max_price != null) count += 1;
    return count;
  }, [filters]);

  const toggleCategory = useCallback((category: SeoToolCategory) => {
    onChange({ category: filters.category === category ? null : category });
  }, [filters.category, onChange]);

  const togglePricing = useCallback((model: PricingModel) => {
    onChange({ pricing_model: filters.pricing_model === model ? null : model });
  }, [filters.pricing_model, onChange]);

  const toggleMarketplace = useCallback((mp: Marketplace) => {
    onChange({ marketplace: filters.marketplace === mp ? null : mp });
  }, [filters.marketplace, onChange]);

  const setMinRating = useCallback((value: string) => {
    onChange({ min_rating: value === "" ? null : Number(value) });
  }, [onChange]);

  const setMinPrice = useCallback((value: string) => {
    onChange({ min_price: value === "" ? null : Number(value) });
  }, [onChange]);

  const setMaxPrice = useCallback((value: string) => {
    onChange({ max_price: value === "" ? null : Number(value) });
  }, [onChange]);

  const setSort = useCallback((value: string) => {
    onChange({ sort: value as SeoToolFilters["sort"] });
  }, [onChange]);

  const setSearch = useCallback((value: string) => {
    onChange({ search: value === "" ? undefined : value, page: 1 });
  }, [onChange]);

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-teal-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-indigo-950">Filters</h2>
        </div>
        {activeFilterCount > 0 && (
          <Button variant="outline" onClick={onClear} className="h-7 px-2 text-[10px]">
            <X size={12} className="mr-1" aria-hidden="true" />
            Clear all
          </Button>
        )}
      </div>

      <Card className="border-line">
        <CardHeader className="pb-2">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center justify-between w-full text-left"
            aria-expanded={expanded}
            aria-label="Toggle filters"
          >
            <span className="text-xs font-semibold text-muted uppercase tracking-tighter">
              Refine results
            </span>
            {expanded ? <ChevronUp size={14} className="text-muted" aria-hidden="true" /> : <ChevronDown size={14} className="text-muted" aria-hidden="true" />}
          </button>
        </CardHeader>
        {expanded && (
          <CardContent className="pt-0 space-y-4">
            <section>
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="text"
                  placeholder="Search by name or feature…"
                  value={filters.search ?? ""}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700 disabled:opacity-50"
                  aria-label="Search tools"
                />
              </label>
            </section>

            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Category</p>
              <div className="grid grid-cols-1 gap-1">
                {categories.map((category) => {
                  const active = filters.category === category;
                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        "flex items-center justify-between rounded-md border px-2 py-1 text-[10px] text-left transition-colors",
                        active
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-line bg-white text-muted hover:bg-amber-50",
                      )}
                    >
                      <span>{CATEGORY_LABELS[category]}</span>
                      {active && <span className="text-indigo-600">✓</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Pricing model</p>
              <div className="flex gap-1">
                {pricingModels.map((model) => {
                  const active = filters.pricing_model === model;
                  return (
                    <button
                      key={model}
                      onClick={() => togglePricing(model)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                        active
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-line bg-white text-muted hover:bg-canvas",
                      )}
                    >
                      {PRICING_LABELS[model]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Marketplace</p>
              <div className="flex flex-wrap gap-1">
                {marketplaces.slice(0, 6).map((mp) => {
                  const active = filters.marketplace === mp;
                  return (
                    <button
                      key={mp}
                      onClick={() => toggleMarketplace(mp)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors",
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
            </section>

            <section className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">
                    Min rating
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    placeholder="0"
                    value={filters.min_rating == null ? "" : String(filters.min_rating)}
                    onChange={(e) => setMinRating(e.target.value)}
                    className="w-full h-8 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                    aria-label="Minimum rating"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">
                    Max price ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={filters.max_price == null ? "" : String(filters.max_price)}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full h-8 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                    aria-label="Maximum price"
                  />
                </div>
              </div>
            </section>

            <section>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-muted mb-1">
                Sort by
              </label>
              <select
                value={filters.sort ?? "relevance"}
                onChange={(e) => setSort(e.target.value)}
                className="w-full h-9 rounded-md border border-line bg-white px-3 text-[10px] focus:outline-none focus:ring-1 focus:ring-teal-700"
                aria-label="Sort order"
              >
                <option value="relevance">Relevance</option>
                <option value="rating">Rating (high → low)</option>
                <option value="price_asc">Price (low → high)</option>
                <option value="price_desc">Price (high → low)</option>
                <option value="name">Name (A → Z)</option>
              </select>
            </section>
          </CardContent>
        )}
      </Card>

      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">
          Results
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-sm font-semibold text-indigo-950">{filteredTools}</span>
          <span className="text-xs text-muted">of {totalTools} tools</span>
        </div>
      </div>
    </aside>
  );
}
