"use client";

import { useMemo } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SeoTool } from "@/lib/seo-tools";

interface CompareTableProps {
  tools: SeoTool[];
  onClose: () => void;
}

export function CompareTable({ tools, onClose }: CompareTableProps) {
  const allFeatures = useMemo(() => {
    const set = new Set<string>();
    for (const tool of tools) {
      for (const feature of tool.features) {
        set.add(feature.label);
      }
    }
    return Array.from(set);
  }, [tools]);

  return (
    <div className="relative z-50">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl border border-line shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white/90 sticky top-0 z-10">
            <h2 className="text-sm font-semibold text-indigo-950">Tool comparison</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted hover:bg-canvas hover:text-indigo-950 transition-colors"
              aria-label="Close comparison"
            >
              <span className="sr-only">Close</span>
              <span className="block w-5 h-5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></span>
            </button>
          </div>
          <div className="overflow-auto flex-1 p-6">
            <div className="min-w-[700px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Feature</TableHead>
                    {tools.map((tool) => (
                      <TableHead key={tool.id} className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={tool.logo}
                            alt={tool.name}
                            className="h-8 w-8 rounded-md bg-canvas border border-line"
                            loading="lazy"
                          />
                          <span className="text-[10px] font-semibold text-indigo-950 truncate w-[140px]">{tool.name}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-canvas">
                    <TableCell className="font-semibold text-indigo-950 text-xs">Pricing model</TableCell>
                    {tools.map((tool) => (
                      <TableCell key={tool.id} className="text-center text-[10px] text-muted">
                        {tool.pricing_model}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold text-indigo-950 text-xs">Starting price</TableCell>
                    {tools.map((tool) => (
                      <TableCell key={tool.id} className="text-center text-[10px] tabular-nums">
                        {tool.starting_price_usd == null ? "Contact" : `$${tool.starting_price_usd}/mo`}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-canvas">
                    <TableCell className="font-semibold text-indigo-950 text-xs">Rating</TableCell>
                    {tools.map((tool) => (
                      <TableCell key={tool.id} className="text-center text-[10px] tabular-nums">
                        {tool.rating == null ? "—" : tool.rating.toFixed(1)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold text-indigo-950 text-xs">Marketplaces</TableCell>
                    {tools.map((tool) => (
                      <TableCell key={tool.id} className="text-center text-[10px] text-muted">
                        {tool.marketplaces.join(", ")}
                      </TableCell>
                    ))}
                  </TableRow>
                  {allFeatures.map((feature) => (
                    <TableRow key={feature} className="bg-white/50">
                      <TableCell className="font-semibold text-indigo-950 text-xs">{feature}</TableCell>
                      {tools.map((tool) => (
                        <TableCell key={`${feature}-${tool.id}`} className="text-center text-[10px]">
                          {tool.features.some((f) => f.label === feature) ? (
                            <span className="text-xs text-indigo-600 font-medium">✓</span>
                          ) : (
                            <span className="text-[10px] text-muted">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="px-6 py-3 border-t border-line bg-white/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-line bg-white text-[10px] font-semibold text-indigo-600 hover:bg-canvas transition-colors"
            >
              Close comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
