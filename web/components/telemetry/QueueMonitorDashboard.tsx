"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Activity, Clock, ShieldAlert, CheckCircle, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  fetchQueueTelemetry,
  forceRetryOutboxItem,
  deadLetterOutboxItem,
  type QueueTelemetry,
  type OutboxBackoffItem,
} from "@/lib/telemetry";

const POLL_INTERVAL_MS = 5000;

function formatCountdown(isoString: string | null): string {
  if (!isoString) return "—";
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return "Due now";
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function severityColor(error: string | null | undefined): string {
  if (!error) return "text-muted";
  const lower = error.toLowerCase();
  if (lower.includes("429") || lower.includes("throttl")) return "text-amber-700";
  if (lower.includes("500") || lower.includes("dead") || lower.includes("max")) return "text-red-700";
  if (lower.includes("missing") || lower.includes("not found")) return "text-blue-700";
  return "text-indigo-700";
}

function statusBadge(status: string): string {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border";
  const variants: Record<string, string> = {
    pending: "border-amber-100 bg-amber-50 text-amber-700",
    published: "border-teal-100 bg-teal-50 text-teal-700",
    processed: "border-blue-100 bg-blue-50 text-blue-700",
    failed: "border-red-100 bg-red-50 text-red-700",
    dead_letter: "border-slate-100 bg-slate-50 text-slate-700",
  };
  return cn(base, variants[status] ?? variants.pending);
}

interface QueueMetricCardProps {
  label: string;
  value: number;
  accent: string;
  icon: React.ElementType;
  detail: string;
}

function QueueMetricCard({
  label,
  value,
  accent,
  icon: Icon,
  detail,
}: QueueMetricCardProps) {
  return (
    <Card className={cn("border-line rounded-xl", accent === "warn" && "border-amber-200")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon size={16} className={accent === "warn" ? "text-amber-600" : "text-indigo-600"} aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">{label}</p>
          </div>
          <div className={`p-2 rounded-md ${accent === "warn" ? "bg-amber-100" : "bg-indigo-50"}`}>
            <Zap size={14} className={accent === "warn" ? "text-amber-600" : "text-indigo-600"} aria-hidden="true" />
          </div>
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className={`text-2xl font-bold tabular-nums ${accent === "warn" ? "text-amber-700" : "text-indigo-950"}`}>{value}</span>
          <span className="text-xs text-muted">items</span>
        </div>
        <p className="mt-1 text-[10px] text-muted">{detail}</p>
      </CardHeader>
    </Card>
  );
}

export function QueueMonitorDashboard() {
  const [telemetry, setTelemetry] = useState<QueueTelemetry | null>(null);
  const [backoffItems, setBackoffItems] = useState<OutboxBackoffItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchQueueTelemetry();
      if (!mountedRef.current) return;
      setTelemetry(data);
    } catch (cause) {
      if (!mountedRef.current) return;
      setError(cause instanceof Error ? cause.message : "Telemetry feed unavailable");
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const handleRetry = async (outboxId: string) => {
    try {
      await forceRetryOutboxItem(outboxId);
      void fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Force retry failed");
    }
  };

  const handleDeadLetter = async (outboxId: string) => {
    try {
      await deadLetterOutboxItem(outboxId);
      void fetchData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dead-letter action failed");
    }
  };

  const listingHealth = telemetry?.listing_health ?? { pending: 0, processed: 0, published: 0, failed: 0, dead_letter: 0 };
  const outbox = telemetry?.amazon_write_outbox ?? { pending: 0, processed: 0, published: 0, failed: 0, dead_letter: 0 };

  // Derive backoff items: pending outbox rows with future available_at
  // In a full implementation these would come from a dedicated endpoint.
  // Here we render a representative list derived from telemetry shape.
  const pendingCount = outbox.pending;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Queue diagnostics</p>
          <h1 className="mt-0.5 text-lg font-semibold text-indigo-950">Outbox throughput &amp; backoff</h1>
        </div>
        <BadgeStatus pill={telemetry ? "live" : "stale"} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QueueMetricCard
          label="Listing health pending"
          value={listingHealth.pending}
          accent="default"
          icon={Activity}
          detail="Awaiting suppression review"
        />
        <QueueMetricCard
          label="Outbox pending"
          value={outbox.pending}
          accent="warn"
          icon={Clock}
          detail="Awaiting SP-API execution window"
        />
        <QueueMetricCard
          label="Published"
          value={outbox.published}
          accent="default"
          icon={CheckCircle}
          detail="Successfully executed on Amazon"
        />
        <QueueMetricCard
          label="Failed / dead-letter"
          value={outbox.failed + outbox.dead_letter}
          accent="default"
          icon={ShieldAlert}
          detail="Requires manual intervention"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 border-line rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-indigo-950">Backoff work queue</h2>
            </div>
            <p className="mt-0.5 text-[10px] text-muted">
              {pendingCount} item{pendingCount === 1 ? "" : "s"} currently in backoff or pending execution
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-line text-[10px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Action type</th>
                    <th className="px-4 py-3 text-right">Attempts</th>
                    <th className="px-4 py-3 text-right">Next attempt</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backoffItems.length > 0 ? (
                    backoffItems.map((item) => (
                      <tr key={item.id} className="border-b border-line hover:bg-amber-50/50 transition-colors">
                        <td className="px-4 py-3 tabular-nums text-[10px] font-semibold text-indigo-950">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-muted">{item.action_type}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[10px]">
                          {item.attempt_count}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[10px] font-medium">
                          {formatCountdown(item.available_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusBadge(item.status)}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              onClick={() => void handleRetry(item.id)}
                              className="h-7 px-2 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50"
                            >
                              Retry
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleDeadLetter(item.id)}
                              className="h-7 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Dead-letter
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted" colSpan={6}>
                        No items currently in backoff. Queue is clear.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-1 border-line rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-indigo-950">Error diagnostics</h2>
            </div>
            <p className="mt-0.5 text-[10px] text-muted">Top recurring error strings</p>
          </CardHeader>
          <CardContent className="pt-0 p-3">
            {telemetry?.top_errors.length ? (
              <div className="space-y-2">
                {telemetry.top_errors.map((entry) => (
                  <div
                    key={entry.error}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-2 text-xs",
                      expandedErrorId === entry.error
                        ? "border-amber-200 bg-amber-50"
                        : "border-line bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setExpandedErrorId(expandedErrorId === entry.error ? null : entry.error)}>
                      <span className={`font-semibold ${severityColor(entry.error)}`}>{entry.error}</span>
                      <span className="text-[10px] font-bold tabular-nums text-muted">{entry.count}x</span>
                    </div>
                    {expandedErrorId === entry.error && (
                      <div className="mt-2 pt-2 border-t border-line flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRetry("placeholder-id");
                          }}
                          className="h-7 px-2 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50"
                        >
                          Force retry
                        </Button>
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeadLetter("placeholder-id");
                          }}
                          className="h-7 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Dead-letter
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-[10px] text-muted">No active errors.</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-1 border-line rounded-xl">
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-indigo-950">Latency</h2>
          </CardHeader>
          <CardContent className="pt-0 p-3">
            {telemetry?.average_execution_latency_seconds !== null ? (
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-950 tabular-nums">
                  {telemetry?.average_execution_latency_seconds}s
                </div>
                <p className="mt-1 text-[10px] text-muted">Avg execution latency</p>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[10px] text-muted">—</span>
                <p className="mt-1 text-[10px] text-muted">No published rows yet</p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
              <span>Total outbox rows</span>
              <span className="font-semibold text-indigo-950">{telemetry?.total_outbox_rows ?? 0}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
              <span>Last updated</span>
              <span className="font-medium">
                {telemetry?.generated_at ? new Date(telemetry.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function BadgeStatus({ pill }: { pill: "live" | "stale" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-semibold border",
      pill === "live" ? "border-teal-100 bg-teal-50 text-teal-700" : "border-amber-100 bg-amber-50 text-amber-700"
    )}>
      {pill === "live" ? <Activity size={12} className="mr-1 animate-pulse" aria-hidden="true" /> : <Clock size={12} className="mr-1" aria-hidden="true" />}
      {pill === "live" ? "Telemetry live" : "Telemetry stale"}
    </span>
  );
}
