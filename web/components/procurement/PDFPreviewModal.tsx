"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Download, FileText, Printer, ShieldCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  generationId: string;
  onDispatchConfirmed?: (generationId: string) => void;
}

const API_BASE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  return configured ? configured.replace(/\/+$/, "") : "";
})();

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((body as { detail?: string }).detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  generationId,
  onDispatchConfirmed,
}: PDFPreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const previewUrl = `${API_BASE_URL}/api/v1/procurement/pdf/preview/${encodeURIComponent(generationId)}`;
  const dispatchUrl = `${API_BASE_URL}/api/v1/procurement/pdf/${encodeURIComponent(generationId)}/dispatch`;

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(previewUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `PO_Draft_${generationId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (cause) {
      setDispatchError(
        cause instanceof Error ? cause.message : "PDF download failed"
      );
    } finally {
      setIsDownloading(false);
    }
  }, [previewUrl, generationId]);

  const handleDispatch = useCallback(async () => {
    setIsDispatching(true);
    setDispatchError(null);
    try {
      await json<void>(dispatchUrl, { method: "POST" });
      onDispatchConfirmed?.(generationId);
      onClose();
    } catch (cause) {
      setDispatchError(
        cause instanceof Error ? cause.message : "Vendor dispatch confirmation failed"
      );
    } finally {
      setIsDispatching(false);
    }
  }, [dispatchUrl, generationId, onDispatchConfirmed, onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Purchase order draft preview"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-line bg-white shadow-2xl">
        <CardHeader className="pb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-indigo-950">Purchase Order Draft</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted">
              Generation {generationId.slice(0, 8)}…
            </span>
            <Button variant="ghost" onClick={onClose}>
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col h-[calc(100vh-140px)] min-h-[400px]">
          {/* Document canvas with native PDF rendering */}
          <div className="flex-1 relative bg-canvas border border-line rounded-lg overflow-hidden">
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="w-full h-full"
              title="Purchase order draft PDF"
              allowFullScreen
              aria-label="PDF preview"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <FileText size={32} className="mb-2 opacity-50" aria-hidden="true" />
              <p className="text-sm">Loading PDF document…</p>
            </div>
          </div>

          {/* Actions control panel */}
          <div className="border-t border-line bg-white p-4 flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <div className="flex items-center gap-2 text-xs text-muted">
              <ShieldCheck size={14} className="text-teal-600" aria-hidden="true" />
              <span>Draft ready for vendor review</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isDownloading}
                className="h-9 px-3 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 disabled:opacity-60"
              >
                {isDownloading ? (
                  <>
                    <Printer size={14} className="mr-2" aria-hidden="true" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Download size={14} className="mr-2" aria-hidden="true" />
                    Download Document
                  </>
                )}
              </Button>

              <Button
                onClick={handleDispatch}
                disabled={isDispatching}
                className="h-9 px-4 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDispatching ? (
                  <>
                    <ShieldCheck size={14} className="mr-2 animate-spin" aria-hidden="true" />
                    Confirming…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} className="mr-2" aria-hidden="true" />
                    Confirm Vendor Dispatch
                  </>
                )}
              </Button>

              {dispatchError && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                  {dispatchError}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}
