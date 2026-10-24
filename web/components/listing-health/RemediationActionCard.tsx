"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AlertTriangle, Check, RefreshCw, X, Edit, DollarSign, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type RemediationAlertType =
  | "pricing_error"
  | "catalog_defect"
  | "text_defect"
  | "listing_suppression";

export interface ListingRemediationAlert {
  id: string;
  notification_id: string;
  asin: string;
  sku: string;
  marketplace_id: string;
  listing_status: string;
  is_suppressed: boolean;
  error_codes: string[];
  error_messages: string[];
  alert_type: RemediationAlertType;
  received_at: string;
  processed_at: string | null;
}

export type RemediationResolutionType =
  | "price_correction"
  | "catalog_rewrite"
  | "text_correction"
  | "manual_review";

export interface RemediateRequest {
  event_id: string;
  action: "approve";
  resolution_type: RemediationResolutionType;
  proposed_price?: number;
  proposed_bullets?: string[];
  proposed_title?: string;
  notes?: string;
}

export interface RemediateResponse {
  accepted: boolean;
  remediation_id: string;
  status: string;
}

export type SubmitState = "idle" | "loading" | "success" | "error";

interface RemediationActionCardProps {
  alert: ListingRemediationAlert;
  onRemediateComplete?: (eventId: string, status: string) => void;
  className?: string;
}

const alertBadgeVariant = (type: RemediationAlertType) => {
  const base = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-tighter border";
  const variants: Record<RemediationAlertType, string> = {
    pricing_error: "border-red-100 bg-red-50 text-red-700",
    catalog_defect: "border-amber-100 bg-amber-50 text-amber-700",
    text_defect: "border-blue-100 bg-blue-50 text-blue-700",
    listing_suppression: "border-orange-100 bg-orange-50 text-orange-700",
  };
  return cn(base, variants[type]);
};

const ALERT_LABELS: Record<RemediationAlertType, string> = {
  pricing_error: "Pricing error",
  catalog_defect: "Catalog defect",
  text_defect: "Text defect",
  listing_suppression: "Listing suppressed",
};

const ALERT_ICONS: Record<RemediationAlertType, React.ElementType> = {
  pricing_error: DollarSign,
  catalog_defect: FileText,
  text_defect: Edit,
  listing_suppression: AlertTriangle,
};

export function RemediationActionCard({
  alert,
  onRemediateComplete,
  className,
}: RemediationActionCardProps) {
  const Icon = ALERT_ICONS[alert.alert_type];
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<{
    standardPrice: string | null;
    title: string;
    bullets: string[];
    notes: string;
  }>({
    standardPrice: null,
    title: "",
    bullets: [""],
    notes: "",
  });

  const isPricingError = useMemo(
    () => alert.alert_type === "pricing_error",
    [alert.alert_type]
  );
  const isTextOrCatalog = useMemo(
    () =>
      alert.alert_type === "catalog_defect" || alert.alert_type === "text_defect",
    [alert.alert_type]
  );

  const setField = useCallback((key: string, value: string | string[] | null) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addBullet = useCallback(() => {
    setFormValues((prev) => ({ ...prev, bullets: [...prev.bullets, ""] }));
  }, []);

  const removeBullet = useCallback((index: number) => {
    setFormValues((prev) => {
      const next = prev.bullets.filter((_, i) => i !== index);
      return { ...prev, bullets: next.length ? next : [""] };
    });
  }, []);

  const updateBullet = useCallback((index: number, value: string) => {
    setFormValues((prev) => {
      const next = [...prev.bullets];
      next[index] = value;
      return { ...prev, bullets: next };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitState("loading");
    setSubmitError(null);

    try {
      const payload: RemediateRequest = {
        event_id: alert.id,
        action: "approve",
        resolution_type: "manual_review",
        notes: formValues.notes.trim() || undefined,
      };

      if (isPricingError) {
        const price = Number(formValues.standardPrice);
        if (!formValues.standardPrice || !Number.isFinite(price) || price <= 0) {
          throw new Error("A valid standard price is required for pricing errors.");
        }
        payload.resolution_type = "price_correction";
        payload.proposed_price = price;
      }

      if (isTextOrCatalog) {
        const cleanedBullets = formValues.bullets
          .map((b) => b.trim())
          .filter(Boolean);
        if (!cleanedBullets.length && !formValues.title.trim()) {
          throw new Error("Provide a title or at least one bullet point correction.");
        }
        payload.resolution_type =
          alert.alert_type === "catalog_defect" ? "catalog_rewrite" : "text_correction";
        payload.proposed_bullets = cleanedBullets;
        payload.proposed_title = formValues.title.trim() || undefined;
      }

      const response = await fetch("/api/v1/listings/remediations/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error((body as { detail?: string }).detail || `Remediation failed with status ${response.status}`);
      }

      const result = (await response.json()) as RemediateResponse;
      setSubmitState("success");
      onRemediateComplete?.(alert.id, result.status);
    } catch (cause) {
      setSubmitState("error");
      setSubmitError(
        cause instanceof Error ? cause.message : "Remediation request failed"
      );
    }
  }, [alert, isPricingError, isTextOrCatalog, formValues, onRemediateComplete]);

  const reset = useCallback(() => {
    setSubmitState("idle");
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (submitState === "success" || submitState === "error") {
      const timer = setTimeout(reset, 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [submitState, reset]);

  const pricingIsValid = useMemo(() => {
    if (!isPricingError) return true;
    const price = Number(formValues.standardPrice);
    return Boolean(formValues.standardPrice && Number.isFinite(price) && price > 0);
  }, [isPricingError, formValues.standardPrice]);

  const textIsValid = useMemo(() => {
    if (!isTextOrCatalog) return true;
    const cleanedBullets = formValues.bullets.map((b) => b.trim()).filter(Boolean);
    return cleanedBullets.length > 0 || formValues.title.trim().length > 0;
  }, [isTextOrCatalog, formValues.bullets, formValues.title]);

  const canSubmit = pricingIsValid && textIsValid && submitState !== "loading";

  return (
    <Card className={cn("border line", submitState === "error" && "border-red-200", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1">
            <Icon size={14} className="text-muted" aria-hidden="true" />
            <span className={cn("text-[10px] font-bold uppercase tracking-tighter text-muted", submitState === "error" ? "text-red-600" : "")}>
              {ALERT_LABELS[alert.alert_type]}
            </span>
          </div>
          <span className={alertBadgeVariant(alert.alert_type)}>
            {alert.error_codes[0] || alert.listing_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="px-3 py-2 rounded-lg border border-line bg-white">
            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">ASIN</p>
            <p className="text-sm font-semibold text-indigo-950 tabular-nums">{alert.asin}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-line bg-white">
            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">SKU</p>
            <p className="text-sm font-semibold text-indigo-950 tabular-nums">{alert.sku}</p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-line bg-white">
            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">Marketplace</p>
            <p className="text-sm font-semibold text-indigo-950 tabular-nums">{alert.marketplace_id}</p>
          </div>
        </div>

        {alert.error_messages.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-tighter text-muted">Detected issue</p>
            <p className="text-sm text-muted leading-relaxed">{alert.error_messages[0]}</p>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {isPricingError && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={14} className="text-amber-600" aria-hidden="true" />
              <label className="text-xs font-semibold text-indigo-950">Correct standard price</label>
            </div>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
              <input
                type="text"
                value={formValues.standardPrice ?? ""}
                onChange={(e) => setField("standardPrice", e.target.value)}
                placeholder="0.00"
                className="pl-6 w-full h-9 rounded-md border border-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitState === "loading"}
              />
              {!pricingIsValid && submitState !== "idle" && (
                <span className="text-[10px] text-red-600 font-medium">Enter a valid price greater than 0</span>
              )}
            </div>
          </section>
        )}

        {isTextOrCatalog && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-blue-600" aria-hidden="true" />
              <label className="text-xs font-semibold text-indigo-950">Correct catalog text</label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-indigo-950">Product title</label>
              </div>
              <input
                type="text"
                value={formValues.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="Enter corrected product title"
                className="w-full h-9 rounded-md border border-line bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitState === "loading"}
              />

              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-indigo-950">Bullet points</label>
                <button
                  type="button"
                  onClick={addBullet}
                  disabled={submitState === "loading"}
                  className="min-h-8 shrink-0 rounded-md border border-line bg-white px-2 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  + Add bullet
                </button>
              </div>
              <div className="space-y-1">
                {formValues.bullets.map((bullet, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => updateBullet(index, e.target.value)}
                      placeholder="Enter bullet correction"
                      className="flex-1 h-8 rounded-md border border-line bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={submitState === "loading"}
                    />
                    {formValues.bullets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBullet(index)}
                        disabled={submitState === "loading"}
                        className="shrink-0 rounded-md border border-line bg-white px-1.5 text-[10px] text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" aria-label="Remove bullet"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!textIsValid && submitState !== "idle" && (
                <span className="text-[10px] text-red-600 font-medium">
                  Provide a product title or at least one bullet point correction.
                </span>
              )}
            </div>
          </section>
        )}

        <div className="mt-4 flex items-end gap-3">
          <textarea
            value={formValues.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Internal review notes (optional)"
            rows={2}
            className="flex-1 min-h-[72px] rounded-md border border-line bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitState === "loading"}
          />
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              submitState === "success" ? "bg-teal-600 text-white" : "",
              submitState === "error" ? "bg-red-600 text-white" : ""
            )}
          >
            {submitState === "loading" && (
              <RefreshCw size={14} className="animate-spin mr-2" aria-hidden="true" />
            )}
            {submitState === "idle" ? "Approve remediation" : submitState === "loading" ? "Applying…" : submitState === "success" ? "Applied" : "Retry"}
          </Button>
        </div>

        {submitState === "success" && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-teal-100 bg-teal-50 px-3 py-2 text-teal-700 text-xs">
            <Check size={14} aria-hidden="true" />
            <span>Remediation approved and queued for execution.</span>
          </div>
        )}
        {submitState === "error" && submitError && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-red-700 text-xs">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
