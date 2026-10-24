"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ListingSuppressionBannerProps {
  suppressedCount: number;
}

export function ListingSuppressionBanner({ suppressedCount }: ListingSuppressionBannerProps) {
  if (suppressedCount <= 0) return null;

  return (
    <section className="mb-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="bg-amber-100 p-1.5 rounded-md"><AlertTriangle size={20} strokeWidth={2.5} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">
          Critical: <span className="tabular-nums font-bold">{suppressedCount}</span> listing{
            suppressedCount === 1 ? " is" : "s are"
          } currently suppressed on Amazon
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          Review and resolve listing suppressions in the health work queue before they impact sales.
        </p>
      </div>
      <Link href="/listings/alerts" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors">
        Go to review queue <ArrowRight size={14} strokeWidth={2} />
      </Link>
    </section>
  );
}
