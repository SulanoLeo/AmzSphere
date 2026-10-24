"use client";

import { useCallback, useState } from "react";

import { AlertTriangle, Check, RefreshCw, Truck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RemediationActionCard, ListingRemediationAlert } from "@/components/listing-health/RemediationActionCard";

interface ListingRemediationQueueProps {
  alerts: ListingRemediationAlert[];
  onRemediateComplete?: (eventId: string, status: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ListingRemediationQueue({
  alerts,
  onRemediateComplete,
  emptyTitle = "All clear",
  emptyDescription = "No active listing suppressions require remediation.",
}: ListingRemediationQueueProps) {
  const [pendingApprovals, setPendingApprovals] = useState<Set<string>>(new Set());

  const handleRemediateComplete = useCallback(
    (eventId: string, status: string) => {
      setPendingApprovals((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      onRemediateComplete?.(eventId, status);
    },
    [onRemediateComplete]
  );

  const isPending = (eventId: string) => pendingApprovals.has(eventId);

  if (alerts.length === 0) {
    return (
      <Card className={cn("border-line")}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-teal-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-indigo-950">{emptyTitle}</h2>
          </div>
        </CardHeader>
        <CardContent className="pt-0 py-4">
          <p className="text-sm text-muted">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-tighter text-muted">
          Remediation work queue
        </h2>
        <span className="text-xs font-semibold text-indigo-950 tabular-nums">
          {alerts.length} active suppression{alerts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3">
        {alerts.map((alert) => (
          <RemediationActionCard
            key={alert.id}
            alert={alert}
            onRemediateComplete={handleRemediateComplete}
            className={isPending(alert.id) ? "opacity-70 pointer-events-none" : undefined}
          />
        ))}
      </div>
      {pendingApprovals.size > 0 && (
        <Card className={cn("border-amber-100 bg-amber-50 mt-3")}>
          <CardContent className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-amber-800">
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              <span>
                {pendingApprovals.size} remediation{pendingApprovals.size === 1 ? "" : "s"} being applied…
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export type { ListingRemediationAlert };
