"use client";

import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ProductProvider } from "@/context/ProductContext";
import { StorefrontView } from "@/components/product/StorefrontView";

const STOREFRONT_PAGES = [
  { name: "Home Page", path: "/", visitors: 69420, gmv: 194280, cvr: "5.84%", status: "Sample", statusVariant: "bg-teal-50 text-teal-800 border-teal-200" },
  { name: "Audio / Acoustics", path: "/audio", visitors: 32110, gmv: 82410, cvr: "6.12%", status: "Sample", statusVariant: "bg-teal-50 text-teal-800 border-teal-200" },
  { name: "Solar Power Hub", path: "/solar-gear", visitors: 19450, gmv: 54120, cvr: "4.82%", status: "Scheduled", statusVariant: "bg-amber-50 text-amber-800 border-amber-200" },
  { name: "Office & Desk Setup", path: "/workstation", visitors: 12640, gmv: 31850, cvr: "5.40%", status: "Sample", statusVariant: "bg-teal-50 text-teal-800 border-teal-200" },
  { name: "Deals & Bundles", path: "/deals", visitors: 8210, gmv: 28120, cvr: "7.10%", status: "Sample", statusVariant: "bg-teal-50 text-teal-800 border-teal-200" },
  { name: "Fitness Essentials", path: "/fitness", visitors: 0, gmv: 0, cvr: "—", status: "Draft Revision", statusVariant: "bg-amber-50 text-amber-800 border-amber-200" },
];

export default function BuyerPreviewPage() {
  return (
    <main className="workspace-page bg-canvas">
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <Link href="/" className="flex items-center gap-1">
              <ArrowLeft size={13} />
              <span>Seller Operations</span>
            </Link>
            <span className="text-xs text-muted">/</span>
            <span>Catalog</span>
            <span className="text-xs text-muted">/</span>
            <span>Listing Optimization / SEO</span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">Buyer Preview</h1>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md px-3 py-1.5 mt-1">
            <Store size={12} className="mr-1" />
            Read-only preview · No Amazon connection
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2">Preview how sample listings appear to shoppers. This view is read-only and publishes nothing.</p>
        </div>
      </header>

      <div className="metrics metrics-five mb-6">
        <div className="metric" data-accent="blue">
          <div className="metric-label"><span>Storefront Pages</span></div>
          <div className="metric-value">{STOREFRONT_PAGES.length.toLocaleString()}</div>
          <div className="metric-foot">Sample storefront pages</div>
        </div>
        <div className="metric" data-accent="teal">
          <div className="metric-label"><span>30D Visitors</span></div>
          <div className="metric-value">{STOREFRONT_PAGES.reduce((sum, p) => sum + p.visitors, 0).toLocaleString()}</div>
          <div className="metric-foot">Aggregate sample traffic</div>
        </div>
        <div className="metric" data-accent="green">
          <div className="metric-label"><span>30D Sales (GMV)</span></div>
          <div className="metric-value">${STOREFRONT_PAGES.reduce((sum, p) => sum + p.gmv, 0).toLocaleString()}</div>
          <div className="metric-foot">Sample gross merchandise value</div>
        </div>
        <div className="metric" data-accent="amber">
          <div className="metric-label"><span>Global CVR</span></div>
          <div className="metric-value">5.62%</div>
          <div className="metric-foot">Aggregate sample conversion</div>
        </div>
        <div className="metric" data-accent="teal">
          <div className="metric-label"><span>Buy Box</span></div>
          <div className="metric-value">Owned</div>
          <div className="metric-foot">Sample featured offer</div>
        </div>
      </div>

      <section className="mb-6">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <div>
              <h2 className="panel-title">Sample Listing Preview</h2>
              <p className="panel-subtitle">Read-only rendering of a sample product as it would appear to a buyer.</p>
            </div>
            <Badge>Preview</Badge>
          </CardHeader>
          <CardContent className="p-4">
            <ProductProvider>
              <StorefrontView />
            </ProductProvider>
          </CardContent>
        </Card>
      </section>

      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between pb-2">
          <div>
            <h2 className="panel-title">Storefront Pages</h2>
            <p className="panel-subtitle">Read-only sample storefront pages and aggregate metrics.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-wrap">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Page Name</th>
                  <th scope="col" className="px-4 py-3">Path</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">30D Visitors</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">30D Sales (GMV)</th>
                  <th scope="col" className="px-4 py-3 tabular-nums">CVR</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {STOREFRONT_PAGES.map((page) => (
                  <tr key={page.path} className="border-t border-line">
                    <td className="px-4 py-3">{page.name}</td>
                    <td className="px-4 py-3 text-[10px] text-muted">{page.path}</td>
                    <td className="px-4 py-3 tabular-nums">{page.visitors.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">${page.gmv.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">{page.cvr}</td>
                    <td className="px-4 py-3"><Badge className={page.statusVariant}>{page.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        Buyer preview is simulated from local sample data only. Nothing is published or connected to Amazon.
      </p>
    </main>
  );
}
