"use client";

import { TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ListingHealthMetricCardProps {
  suppressedCount: number;
  criticalCount: number;
}

export function ListingHealthMetricCard({ suppressedCount, criticalCount }: ListingHealthMetricCardProps) {
  const hasSuppression = suppressedCount > 0;
  const hasCritical = criticalCount > 0;
  const accent = hasCritical || hasSuppression ? "bg-amber-500" : "bg-teal-500";
  const border = hasCritical || hasSuppression ? "border-amber-500" : "border-line";
  const badgeVariant = hasCritical
    ? "bg-amber-100 text-amber-900 border-amber-200"
    : hasSuppression
      ? "bg-amber-50 text-amber-800 border-amber-100"
      : "bg-teal-50 text-teal-800 border-teal-100";

  return (
    <Card className={cn("mb-5", border)}>
      <CardHeader className="border-b-0 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Listing health</p>
            <h2 className="mt-0.5 text-lg font-semibold text-indigo-950">Suppressed listings</h2>
            <p className="mt-1 text-xs text-muted">
              {suppressedCount} listing{suppressedCount === 1 ? "" : "s"} currently suppressed on Amazon
            </p>
          </div>
          <Badge className={badgeVariant}>
            {hasCritical ? "Critical" : hasSuppression ? "Warning" : "Healthy"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 p-4 border-t border-line">
        <section className="rounded-lg border border-line bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Suppressed count</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-indigo-950 tabular-nums">{suppressedCount}</span>
            <span className="text-xs text-muted">listings</span>
          </div>
          <p className="mt-2 text-xs text-muted">Active Amazon suppressions staged for review</p>
        </section>
        <section className="rounded-lg border border-line bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Critical count</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-2xl font-bold tabular-nums ${hasCritical ? "text-red-600" : "text-indigo-950"}`}>{criticalCount}</span>
            <span className="text-xs text-muted">issues</span>
          </div>
          <p className="mt-2 text-xs text-muted">Pricing blocks or active suppression events</p>
        </section>
      </CardContent>
      <div className={`bg-canvas px-4 py-2 flex items-center gap-2 border-t border-line ${accent}`}>
        <TriangleAlert size={14} className={cn(accent === "bg-amber-500" ? "text-amber-500" : "text-teal-600")} />
        <span className="text-xs font-semibold text-indigo-950">
          {hasCritical || hasSuppression
            ? "Attention required — open the review work queue to resolve suppressions"
            : "No active suppressions — listings are healthy"}
        </span>
      </div>
    </Card>
  );
}
