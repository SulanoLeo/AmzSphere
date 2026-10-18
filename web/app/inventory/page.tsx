"use client";

import Link from "next/link";
import { ArrowLeft, Boxes, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useProduct } from "@/context/ProductContext";
import { MetricsPanel } from "@/components/product/MetricsPanel";

export default function InventoryPage() {
  const { product, metrics } = useProduct();
  const poDraftCost = product.salesVelocity * 30 * product.factoryUnitCost;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} />Operations overview
      </Link>
      <header className="mb-7 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Logistics & Inventory</p>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Supply Chain Forecasting</h1>
        <p className="mt-2 text-sm text-muted">Automated purchase order draft based on days of stock remaining.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <MetricsPanel />
          {metrics.reorderNeeded ? (
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
                      <strong className="text-indigo-950">30 days</strong>
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
