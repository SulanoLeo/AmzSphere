"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Product } from "@/lib/provider/types";

function Metric({
  label,
  value,
  detail,
  accent,
  tag,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tag?: string;
}) {
  return (
    <section className="metric" data-accent={accent}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
    </section>
  );
}

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await provider.getProducts({ page_size: 200 });
        if (active) setProducts(payload.products);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Failed to load pricing data");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProducts();
    return () => { active = false; };
  }, []);

  const buyBoxOwned = products.filter((p) => !p.suppressed).length;
  const totalMarginPct = products.length
    ? products.reduce((sum, p) => sum + ((p.price - p.unit_cost) / p.price * 100), 0) / products.length
    : 0;

  return (
    <main className="workspace-page bg-canvas">
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <PackageSearch size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>Catalog</span>
            <span className="text-xs text-muted">/</span>
            <span>Pricing</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Pricing</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <ShieldCheck size={12} className="mr-1" />
            Buy Box owned · Read-only sample pricing
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Read-only view of sample pricing, margins, and Buy Box status. No repricing action is taken.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 border border-line rounded-md bg-white px-2 py-0.5 text-xs text-muted">
            <span>Sample catalog data</span>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{message}</p>}

      <div className="metrics metrics-five mb-6">
        <Metric label="Buy Box" value={buyBoxOwned.toLocaleString()} detail="ASINs with Buy Box owned" accent="teal" tag="OWNED" />
        <Metric label="Monitored SKUs" value={products.length.toLocaleString()} detail="Sample catalog records" accent="blue" tag="READ-ONLY" />
        <Metric label="Average Margin" value={totalMarginPct.toFixed(1) + "%"} detail="Sample price vs unit cost" accent="green" tag="MOCK" />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Pricing Matrix</h2>
            <p className="panel-subtitle">Sample offer prices, Buy Box status, margins, and competitor benchmarks.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table aria-busy={loading} className="w-full text-left text-xs">
              <caption className="sr-only">Sample product prices, Buy Box status, and margins</caption>
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">ASIN</th>
                  <th scope="col" className="px-4 py-3">SKU</th>
                  <th scope="col" className="px-4 py-3">Title</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Our Price</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Competitor Price</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">Net Margin</th>
                  <th scope="col" className="px-4 py-3">Buy Box</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">Loading pricing data…</td></tr>
                ) : products.length ? products.map((product) => {
                  const margin = ((product.price - product.unit_cost) / product.price * 100);
                  return (
                    <tr key={product.asin} className="border-t border-line">
                      <td className="px-4 py-3 text-left">{product.asin}</td>
                      <td className="px-4 py-3">{product.sku}</td>
                      <td className="px-4 py-3">{product.title}</td>
                      <td className="px-4 py-3 tabular-nums">${product.price.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums">${product.competitor_price.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{margin.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        {!product.suppressed ? (
                          <Badge className="bg-teal-50 text-teal-800 border-teal-200">
                            <ShieldCheck size={11} className="mr-1" />Owned
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-50 text-rose-800 border-rose-200">Lost</Badge>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={7} className="text-center text-xs text-muted py-4">No pricing data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        Pricing is read-only sample data. No repricing action, floor adjustment, or Amazon marketplace call is made.
      </p>
    </main>
  );
}
