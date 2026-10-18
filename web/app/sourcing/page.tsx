"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Store } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useProduct } from "@/context/ProductContext";
import { MetricsPanel } from "@/components/product/MetricsPanel";
import { StorefrontView } from "@/components/product/StorefrontView";

function SourcingWorkspace() {
  const { product, updateSourcing, pushChangesSync } = useProduct();
  const [syncMessage, setSyncMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pushChangesSync();
    setSyncMessage("Changes pushed & synced. Storefront and profitability formulas updated.");
    setTimeout(() => setSyncMessage(""), 4000);
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} />Operations overview
      </Link>
      <header className="mb-7 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Sourcing & Pricing</p>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Sourcing Management</h1>
        <p className="mt-2 text-sm text-muted">Bi-directional sync with the simulated storefront and executive profitability formulas.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-indigo-950">Sourcing inputs</h2>
                <p className="mt-1 text-xs text-muted">Changes propagate reactively to the storefront and metrics.</p>
              </div>
              <Badge>Live</Badge>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-1.5 text-xs font-semibold text-ink">
                  Supplier Name
                  <input
                    className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700"
                    value={product.supplierName}
                    onChange={(e) => updateSourcing({ supplierName: e.target.value })}
                    placeholder="GlobalSource Co."
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold text-ink">
                    Factory Unit Cost ($)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700"
                      value={product.factoryUnitCost}
                      onChange={(e) => updateSourcing({ factoryUnitCost: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-ink">
                    Shipping Cost Per Unit ($)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700"
                      value={product.shippingCostPerUnit}
                      onChange={(e) => updateSourcing({ shippingCostPerUnit: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-semibold text-ink">
                  Retail Store Price ($)
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-10 rounded-md border border-line px-3 font-normal outline-none focus:border-teal-700"
                    value={product.retailPrice}
                    onChange={(e) => updateSourcing({ retailPrice: Number(e.target.value) || 0 })}
                  />
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit">
                    <Save size={15} />Push Changes & Sync
                  </Button>
                  <span className="text-xs text-muted">SKU {product.sku} · ASIN {product.asin}</span>
                </div>
              </form>
            </CardContent>
          </Card>
          <MetricsPanel />
        </div>
        <div>
          <StorefrontView />
        </div>
      </div>

      {syncMessage && (
        <p role="status" className="mt-6 rounded-md border border-line bg-white px-4 py-3 text-xs">
          {syncMessage}
        </p>
      )}
    </main>
  );
}

export default function SourcingPage() {
  return <SourcingWorkspace />;
}
