"use client";

import { useEffect, useState } from "react";

interface HealthScoreBarProps {
  score: number | null;
  missingKeywords: Array<{ keyword: string; search_volume?: number | null; organic_rank?: number | null }>;
  mode: "free" | "paid";
}

export function HealthScoreBar({ score, missingKeywords, mode }: HealthScoreBarProps) {
  const [isHovered, setIsHovered] = useState(false);

  let colorClass: string;
  let label: string;
  if (score === null) {
    colorClass = "bg-line";
    label = "—";
  } else if (score >= 75) {
    colorClass = "bg-emerald-500";
    label = "Strong";
  } else if (score >= 40) {
    colorClass = "bg-amber-400";
    label = "Needs work";
  } else {
    colorClass = "bg-rose-500";
    label = "Weak";
  }

  const width = score === null ? 0 : Math.max(0, Math.min(100, score));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Listing Optimization Health
          </span>
          <span className="text-xs font-semibold text-ink">{mode === "paid" ? "Helium 10 Advanced" : "Amazon Native (Free)"}</span>
        </div>
        <span className={`text-xs font-semibold ${score === null ? "text-muted" : colorClass.replace("bg-", "text-")}`}>
          {score === null ? "—" : score}{"/100"}
        </span>
      </div>
      <div className="w-full h-2 rounded-full border border-line bg-canvas overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[10px] text-muted">{label}</p>
      {missingKeywords.length > 0 && mode === "paid" && (
        <details className="group" open={isHovered}>
          <summary
            className="cursor-pointer text-[10px] font-semibold text-teal-700 hover:underline list-none pl-0"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {missingKeywords.length} high-volume competitor keyword(s) missing from copy
          </summary>
          <ul className="mt-1 space-y-1 text-[10px] text-muted max-h-[120px] overflow-y-auto pr-1">
            {missingKeywords.slice(0, 8).map((kw, index) => (
              <li key={index} className="flex items-center justify-between gap-2 truncate">
                <span className="truncate">{kw.keyword}</span>
                {kw.search_volume != null && (
                  <span className="font-mono text-[9px] text-muted">{kw.search_volume} mo.</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
