"use client";

import { useCallback, useMemo } from "react";

import { ShoppingBag, DollarSign, Trash2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeoTool } from "@/lib/seo-tools";

interface StackPanelProps {
  selectedTools: SeoTool[];
  onRemove: (toolId: string) => void;
  onClear: () => void;
  onCompare: (toolIds: string[]) => void;
}

export function StackPanel({
  selectedTools,
  onRemove,
  onClear,
  onCompare,
}: StackPanelProps) {
  if (selectedTools.length === 0) {
    return (
      <Card className="border-line">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-muted" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-indigo-950">My Amazon SEO Stack</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-3 py-4">
          <p className="text-xs text-muted text-center">No tools selected yet. Add tools from the catalog to build your stack.</p>
        </CardContent>
      </Card>
    );
  }

  const totalCost = selectedTools.reduce((sum, t) => sum + (t.starting_price_usd ?? 0), 0);
  const paidCount = selectedTools.filter((t) => t.pricing_model === "paid").length;
  const freemiumCount = selectedTools.filter((t) => t.pricing_model === "freemium").length;
  const freeCount = selectedTools.filter((t) => t.pricing_model === "free").length;

  const handleCompare = useCallback(() => {
    if (selectedTools.length < 2) return;
    const ids = selectedTools.map((t) => t.id);
    onCompare(ids);
  }, [selectedTools, onCompare]);

  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  return (
    <Card className="border-line">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-teal-700" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-indigo-950">My Amazon SEO Stack</h2>
          </div>
          <span className="text-[10px] font-bold text-indigo-950 tabular-nums">{selectedTools.length}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="space-y-2">
          {selectedTools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border border-line bg-white hover:bg-canvas transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-indigo-950 truncate">{tool.name}</p>
                <p className="text-[10px] text-muted truncate">
                  {tool.category} · {tool.pricing_model}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-indigo-950 tabular-nums">
                  {tool.starting_price_usd == null ? "—" : `$${tool.starting_price_usd}`}
                </span>
                <button
                  onClick={() => onRemove(tool.id)}
                  className="p-1 rounded-md text-[10px] text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                  aria-label={`Remove ${tool.name} from stack`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-line">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center justify-between">
              <span className="text-muted">Estimated monthly cost</span>
              <span className="font-semibold text-indigo-950 tabular-nums">
                ${totalCost.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Paid / Freemium / Free</span>
              <span className="font-medium text-muted tabular-nums">
                {paidCount} / {freemiumCount} / {freeCount}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCompare}
            disabled={selectedTools.length < 2}
            className="flex-1 h-8 text-[10px] text-indigo-600 border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedTools.length < 2 ? "Select 2+ to compare" : "Compare selected"}
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
            className="h-8 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
          >
            <RefreshCw size={12} className="mr-1" aria-hidden="true" />
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
