"use client";

import { useCallback, useState } from "react";

import { Plus, Minus, ExternalLink, Star, Tag, ShieldCheck, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SeoTool } from "@/lib/seo-tools";

interface ToolCardProps {
  tool: SeoTool;
  isSelected: boolean;
  onToggle: (toolId: string) => void;
}

export function ToolCard({ tool, isSelected, onToggle }: ToolCardProps) {
  const [hovered, setHovered] = useState(false);

  const handleToggle = useCallback(() => {
    onToggle(tool.id);
  }, [tool.id, onToggle]);

  const price = tool.starting_price_usd == null ? "Contact" : `$${tool.starting_price_usd}/mo`;
  const rating = tool.rating == null ? "—" : tool.rating.toFixed(1);
  const marketplaces = tool.marketplaces.slice(0, 4);
  const moreMarketplaces = Math.max(0, tool.marketplaces.length - 4);

  return (
    <Card
      className={cn(
        "border transition-all hover:shadow-md",
        isSelected ? "border-indigo-600 bg-indigo-50" : "border-line bg-white",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img
              src={tool.logo}
              alt={`${tool.name} logo`}
              className="h-8 w-8 rounded-md bg-canvas border border-line"
              loading="lazy"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-indigo-950 leading-tight">{tool.name}</h3>
              <p className="text-[10px] text-muted line-clamp-2">{tool.short_description}</p>
            </div>
          </div>
          <Badge
            className={cn(
              "text-[10px]",
              tool.pricing_model === "free" ? "bg-green-50 text-green-700 border-green-100" : "",
              tool.pricing_model === "freemium" ? "bg-amber-50 text-amber-700 border-amber-100" : "",
              tool.pricing_model === "paid" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "",
            )}
          >
            {tool.pricing_model}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs">
            <Star size={12} className="text-amber-500" aria-hidden="true" />
            <span>{rating}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-right">
            <Tag size={12} aria-hidden="true" />
            <span className="font-semibold">{price}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mb-2">
          <Globe size={12} className="text-muted" aria-hidden="true" />
          <span className="text-xs text-muted">
            {marketplaces.join(", ")}{moreMarketplaces > 0 && ` +${moreMarketplaces}`}
          </span>
        </div>
        <div className="flex gap-2 mb-3">
          {tool.features.slice(0, 3).map((feature) => (
            <span
              key={feature.id}
              className="inline-flex items-center rounded-md border border-line bg-white px-2 py-0.5 text-[10px] text-muted"
            >
              {feature.label}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleToggle}
            disabled={!tool.is_active}
            className={cn(
              "w-full text-[10px]",
              isSelected ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700" : "",
            )}
          >
            {isSelected ? "In stack" : "Add to stack"}
          </Button>
          <a
            href={tool.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1.5 text-[10px] text-indigo-600 hover:bg-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Visit ${tool.name}`}
          >
            <ExternalLink size={12} aria-hidden="true" />
            <span>Site</span>
          </a>
        </div>
        {!tool.is_active && (
          <p className="mt-2 text-[10px] text-red-600 font-medium">Tool is currently disabled.</p>
        )}
      </CardContent>
    </Card>
  );
}
