"use client";

import { useCallback, useMemo, useState } from "react";

import { ArrowRight, ChevronDown, ChevronUp, Lightbulb, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  computeMonthlyCost,
  findTool,
  getAllMarketplaces,
  marketplaceLabel,
  recommendStarterStack,
  type Marketplace,
  type RecommendationAnswers,
  type RecommendationResult,
  type SeoTool,
} from "@/lib/seo-tools";

interface RecommendationWizardProps {
  selectedIds: string[];
  onSelect: (toolId: string) => void;
}

export function RecommendationWizard({ selectedIds, onSelect }: RecommendationWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "result">("form");
  const [answers, setAnswers] = useState<RecommendationAnswers>({
    seller_size: "small",
    budget: "low",
    goals: ["ranking", "listings"],
    marketplaces: ["US"],
  });
  const [result, setResult] = useState<RecommendationResult | null>(null);

  const handleSubmit = useCallback(() => {
    setResult(recommendStarterStack(answers));
    setStep("result");
  }, [answers]);

  const handleRestart = useCallback(() => {
    setStep("form");
    setResult(null);
  }, []);

  const recommendedTools = useMemo(() => {
    if (!result) return [];
    return result.tool_ids.map((id) => findTool(id)).filter(Boolean) as SeoTool[];
  }, [result]);

  const handleAddAll = useCallback(() => {
    for (const tool of recommendedTools) {
      if (!selectedIds.includes(tool.id)) onSelect(tool.id);
    }
    setStep("form");
    setResult(null);
  }, [recommendedTools, selectedIds, onSelect]);

  const toggleGoal = useCallback((goal: string) => {
    setAnswers((prev) => {
      const next = prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal];
      return { ...prev, goals: next };
    });
  }, []);

  const toggleMarketplace = useCallback((mp: Marketplace) => {
    setAnswers((prev) => {
      const next = prev.marketplaces.includes(mp)
        ? prev.marketplaces.filter((m) => m !== mp)
        : [...prev.marketplaces, mp];
      return { ...prev, marketplaces: next };
    });
  }, []);

  const totalCost = computeMonthlyCost(recommendedTools);

  return (
    <Card className="border-line">
      {step === "form" ? (
        <>
          <CardHeader className="pb-3 flex items-center justify-between">
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-2 text-left"
              aria-expanded={open}
              aria-label="Toggle recommendation helper"
            >
              <Lightbulb size={16} className="text-amber-500" aria-hidden="true" />
              <span className="text-sm font-semibold text-indigo-950">
                Starter stack recommendation
              </span>
              {open ? <ChevronUp size={14} className="text-muted" aria-hidden="true" /> : <ChevronDown size={14} className="text-muted" aria-hidden="true" />}
            </button>
          </CardHeader>
          {open && (
            <CardContent className="pt-0 space-y-3">
              <p className="text-[10px] text-muted">
                Answer a few questions to get a suggested starter stack for your Amazon SEO needs.
              </p>

              <section className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Seller size</p>
                <div className="flex gap-2">
                  {(["small", "medium", "large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setAnswers((prev) => ({ ...prev, seller_size: size }))}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors",
                        answers.seller_size === size
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-line bg-white text-muted hover:bg-canvas",
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Monthly budget</p>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((budget) => (
                    <button
                      key={budget}
                      onClick={() => setAnswers((prev) => ({ ...prev, budget }))}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors",
                        answers.budget === budget
                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                          : "border-line bg-white text-muted hover:bg-canvas",
                      )}
                    >
                      {budget === "low" ? "Under $50" : budget === "medium" ? "$50–$150" : "$150+"}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Goals</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "ranking", label: "Rank tracking" },
                    { id: "ppc", label: "PPC / Ads" },
                    { id: "reviews", label: "Reviews" },
                    { id: "listings", label: "Listings" },
                    { id: "products", label: "Product research" },
                    { id: "competitors", label: "Competitors" },
                  ].map((goal) => {
                    const active = answers.goals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors",
                          active
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-line bg-white text-muted hover:bg-canvas",
                        )}
                      >
                        {goal.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Marketplaces</p>
                <div className="flex flex-wrap gap-2">
                  {getAllMarketplaces().slice(0, 6).map((mp) => {
                    const active = answers.marketplaces.includes(mp);
                    return (
                      <button
                        key={mp}
                        onClick={() => toggleMarketplace(mp)}
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
              </section>

              <div className="pt-2">
                <Button onClick={handleSubmit} className="w-full h-9 text-[10px]">
                  <ArrowRight size={14} className="mr-2" aria-hidden="true" />
                  Suggest starter stack
                </Button>
              </div>
            </CardContent>
          )}
        </>
      ) : (
        <>
          <CardHeader className="pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-teal-700" aria-hidden="true" />
              <span className="text-sm font-semibold text-indigo-950">Recommended starter stack</span>
            </div>
            <button
              onClick={handleRestart}
              className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
              aria-label="Start over"
            >
              <ChevronLeftIcon size={14} aria-hidden="true" />
            </button>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-[10px] text-muted">{result?.reason}</p>
            <div className="space-y-2">
              {recommendedTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-line bg-white hover:bg-canvas transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-indigo-950 truncate">{tool.name}</p>
                    <p className="text-[10px] text-muted truncate">
                      {tool.category} · {marketplaceLabel(tool.marketplaces[0] ?? "US")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-indigo-950 tabular-nums">
                      {tool.starting_price_usd == null ? "—" : `$${tool.starting_price_usd}`}/mo
                    </span>
                    <button
                      onClick={() => onSelect(tool.id)}
                      className={cn(
                        "p-1 rounded-md text-[10px] transition-colors",
                        selectedIds.includes(tool.id)
                          ? "bg-indigo-600 text-white"
                          : "text-indigo-600 border border-indigo-200 hover:bg-indigo-50",
                      )}
                      aria-label={
                        selectedIds.includes(tool.id)
                          ? `${tool.name} already in stack`
                          : `Add ${tool.name} to stack`
                      }
                    >
                      {selectedIds.includes(tool.id) ? "In stack" : "Add"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted">Estimated monthly cost</span>
                <span className="font-semibold text-indigo-950 tabular-nums">${totalCost.toLocaleString()}/mo</span>
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={handleAddAll} disabled={recommendedTools.length === 0} className="w-full h-9 text-[10px]">
                Add all to stack
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

function ChevronLeftIcon({ size, className, ariaHidden }: { size: number; className?: string; ariaHidden?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden={ariaHidden}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
