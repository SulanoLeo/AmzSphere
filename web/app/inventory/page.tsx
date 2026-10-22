"use client";

import Link from "next/link";
import { ArrowLeft, Boxes, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useProduct } from "@/context/ProductContext";

type CatalogProduct = {
  asin: string;
  sku: string;
  title: string;
  category: string;
  stock: number;
  daily_velocity: number;
  days_of_supply: number;
  opt_score: number | null;
  opt_status: string;
  price: number;
  suppressed: boolean;
};

const STATUS_TONE: Record<string, "approved" | "pending" | "warn"> = {
  needs_optimization: "warn",
  draft_ready: "pending",
  pending_approval: "pending",
  approved: "approved",
  published: "approved",
  optimized: "approved",
};

function daysOfSupply(stock: number, velocity: number) {
  return velocity > 0 ? stock / velocity : 0;
}

function statusForSupply(days: number) {
  if (days < 15) return ["warn", "Critical"] as const;
  if (days < 30) return ["pending", "Watch"] as const;
  return ["approved", "Healthy"] as const;
}

export default function InventoryPage() {
  const { product, metrics } = useProduct();
  const days = daysOfSupply(product.currentStock, product.salesVelocity);
  const [tone, label] = statusForSupply(days);

  // Shared product record — mirrors the mock catalog table. opt_score / opt_status
  // are computed by the shared scoring service and read by catalog, pricing, and approvals.
  const shared: CatalogProduct = {
    asin: product.asin,
    sku: product.sku,
    title: product.supplierName,
    category: "General",
    stock: product.currentStock,
    daily_velocity: product.salesVelocity,
    days_of_supply: days,
    opt_score: null,
    opt_status: days < 15 ? "needs_optimization" : "optimized",
    price: product.retailPrice,
    suppressed: false,
  };

  const reorderNeeded = metrics.reorderNeeded;
  const poDraftCost = product.salesVelocity * 30 * product.factoryUnitCost;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} />Operations overview
      </Link>
      <header className="mb-7 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Logistics & Inventory</p>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Inventory</h1>
        <p className="mt-2 text-sm text-muted">Stock cover, sales velocity, and optimization score read from the shared product record.</p>
      </header>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex min-h-32 items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Units on hand</p><p className="mt-3 text-2xl font-semibold text-indigo-950">{product.currentStock.toLocaleString()}</p><p className="mt-1 text-xs text-muted">Sellable units from shared product record</p></div>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-canvas text-indigo-900"><Boxes size={17} /></span>
        </CardContent></Card>
        <Card><CardContent className="flex min-h-32 items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Days of supply</p><p className="mt-3 text-2xl font-semibold text-indigo-950">{days.toFixed(1)}</p><p className="mt-1 text-xs text-muted">On-hand stock ÷ daily sales velocity</p></div>
          <span className={`grid size-9 shrink-0 place-items-center rounded-md ${tone === "approved" ? "bg-canvas text-teal-900" : tone === "pending" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-900"}`}>{label === "Critical" ? <TriangleAlert size={17} /> : <Boxes size={17} />}</span>
        </CardContent></Card>
        <Card><CardContent className="flex min-h-32 items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Daily velocity</p><p className="mt-3 text-2xl font-semibold text-indigo-950">{product.salesVelocity}</p><p className="mt-1 text-xs text-muted">Units sold per day</p></div>
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-canvas text-indigo-900"><Boxes size={17} /></span>
        </CardContent></Card>
        <Card><CardContent className="flex min-h-32 items-start justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Optimization</p><p className="mt-3 text-2xl font-semibold text-indigo-950">{shared.opt_status}</p><p className="mt-1 text-xs text-muted">Score computed on every sync and edit</p></div>
          <span className={`grid size-9 shrink-0 place-items-center rounded-md ${STATUS_TONE[shared.opt_status] === "approved" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}`}>{shared.opt_status === "needs_optimization" ? <TriangleAlert size={17} /> : <Boxes size={17} />}</span>
        </CardContent></Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          {reorderNeeded ? (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <div>
                  <h2 className="text-sm font-semibold text-red-950">High-priority reorder warning</h2>
                  <p className="mt-1 text-xs text-red-800">Days of stock remaining has dropped below 30 days.</p>
                </div>
                <Badge className="bg-red-100 text-red-800">
                  <TriangleAlert size={12} className="mr-1" />Urgent
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-red-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Purchase Order Draft</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Supplier</span>
                      <strong className="text-indigo-950">{product.supplierName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Coverage</span>
                      <strong className="text-indigo-950">{Math.floor(days)} days</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Daily velocity</span>
                      <strong className="tabular-nums text-indigo-950">{product.salesVelocity} units/day</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Factory unit cost</span>
                      <strong className="tabular-nums text-indigo-950">${product.factoryUnitCost.toFixed(2)}</strong>
                    </div>
                    <div className="border-t border-red-100 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Raw materials cost</span>
                        <strong className="tabular-nums text-lg text-red-950">${poDraftCost.toFixed(2)}</strong>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">Sales Velocity × 30 days × Factory Unit Cost</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="outline" className="bg-red-900 text-white hover:bg-red-800">
                      Generate PO PDF
                    </Button>
                    <Badge className="bg-amber-50 text-amber-800">Draft only · not transmitted</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div>
                  <h2 className="text-sm font-semibold text-indigo-950">Inventory healthy</h2>
                  <p className="mt-1 text-xs text-muted">No automatic reorder required at this time.</p>
                </div>
                <Badge><Boxes size={12} className="mr-1" />Stable</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted">
                  Days of stock remaining: {metrics.daysOfStockRemaining === Infinity ? "N/A" : metrics.daysOfStockRemaining} days.
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-indigo-950">Shared product record</h2>
                <p className="mt-1 text-xs text-muted">The same record read by catalog, pricing, and approvals.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted">
              <div className="flex items-center justify-between"><span>ASIN</span><strong className="text-indigo-950">{shared.asin}</strong></div>
              <div className="flex items-center justify-between"><span>SKU</span><strong className="text-indigo-950">{shared.sku}</strong></div>
              <div className="flex items-center justify-between"><span>Stock</span><strong className="tabular-nums">{shared.stock.toLocaleString()} units</strong></div>
              <div className="flex items-center justify-between"><span>Days of supply</span><strong className="tabular-nums">{shared.days_of_supply.toFixed(1)}</strong></div>
              <div className="flex items-center justify-between"><span>Opt status</span><span className={`font-semibold ${STATUS_TONE[shared.opt_status] === "approved" ? "text-teal-800" : "text-amber-800"}`}>{shared.opt_status}</span></div>
              <p className="mt-2 text-[10px]">Updates here reflect in Catalog, Pricing, and Approvals without reload.</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-indigo-950">Forecast summary</h2>
              <p className="mt-1 text-xs text-muted">30-day replenishment projection</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Current stock</span>
              <strong className="tabular-nums">{product.currentStock.toLocaleString()} units</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Sales velocity</span>
              <strong className="tabular-nums">{product.salesVelocity} units/day</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Days remaining</span>
              <strong className="tabular-nums text-indigo-950">
                {metrics.daysOfStockRemaining === Infinity ? "N/A" : metrics.daysOfStockRemaining} days
              </strong>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-muted">30-day replenishment</span>
              <strong className="tabular-nums">{Math.ceil(product.salesVelocity * 30).toLocaleString()} units</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
