"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProduct } from "@/context/ProductContext";
import { MetricsPanel } from "@/components/product/MetricsPanel";
import { BuyBoxStatus } from "@/components/product/BuyBoxStatus";

export default function RepricerPage() {
  const { product, metrics, simulateHijackerAttack, triggerSmartRepricer } = useProduct();

  const chartData = [
    { name: "Our price", value: product.retailPrice, fill: "#007185" },
    { name: "Competitor", value: product.competitorPrice ?? product.retailPrice, fill: "#f59e0b" },
  ];

  const repriceTarget = product.competitorPrice !== null ? product.competitorPrice - 0.1 : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={15} />Operations overview
      </Link>
      <header className="mb-7 max-w-3xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Brand Health</p>
        <h1 className="mt-1 text-2xl font-semibold text-indigo-950">Smart Repricer & Buy Box Protection</h1>
        <p className="mt-2 text-sm text-muted">Simulate listing hijacking and reclaim the Buy Box with automated repricing.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-indigo-950">Buy Box health</h2>
                <p className="mt-1 text-xs text-muted">Current Buy Box ownership and competitor tracking</p>
              </div>
              <BuyBoxStatus />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Our retail price</span>
                <strong className="tabular-nums">${product.retailPrice.toFixed(2)}</strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Competitor price</span>
                <strong className="tabular-nums">
                  {product.competitorPrice !== null ? `$${product.competitorPrice.toFixed(2)}` : "No competitor tracked"}
                </strong>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Unit profit</span>
                <strong className="tabular-nums">${metrics.unitProfit.toFixed(2)}</strong>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={simulateHijackerAttack} disabled={!product.hasBuyBox}>
                  <TriangleAlert size={15} />Simulate Hijacker Attack
                </Button>
                <Button onClick={triggerSmartRepricer} disabled={product.hasBuyBox}>
                  <ShieldCheck size={15} />Trigger Smart Repricer
                </Button>
              </div>
              {!product.hasBuyBox && product.competitorPrice !== null && (
                <p className="text-xs text-red-800">
                  Competitor priced at ${product.competitorPrice.toFixed(2)}. Smart Repricer sets our price to
                  ${repriceTarget!.toFixed(2)} to reclaim the Buy Box.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <h2 className="text-sm font-semibold text-indigo-950">Profit impact</h2>
                <p className="mt-1 text-xs text-muted">Reactive repricing effect on unit and daily profit</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                    <CartesianGrid vertical={false} stroke="#e7ebf0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Price ($)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-md bg-canvas p-3">
                  <p className="text-muted">Daily profit</p>
                  <p className="mt-1 text-lg font-semibold text-indigo-950">${metrics.dailyProfit.toFixed(2)}</p>
                </div>
                <div className="rounded-md bg-canvas p-3">
                  <p className="text-muted">Days of stock</p>
                  <p className="mt-1 text-lg font-semibold text-indigo-950">
                    {metrics.daysOfStockRemaining === Infinity ? "N/A" : metrics.daysOfStockRemaining}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-semibold text-indigo-950">Protection status</h2>
              <p className="mt-1 text-xs text-muted">Hijack simulation state</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-start gap-3">
              <span className={`mt-1 size-2 rounded-full ${product.hasBuyBox ? "bg-teal-700" : "bg-red-500"}`} />
              <div>
                <strong>Buy Box</strong>
                <p className="mt-1 text-muted">
                  {product.hasBuyBox ? "We own the Buy Box." : "Competitor has taken the Buy Box."}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 size-2 rounded-full bg-amber-500" />
              <div>
                <strong>Smart Repricer</strong>
                <p className="mt-1 text-muted">Automatically undercuts competitor by $0.10 to reclaim the Buy Box.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 size-2 rounded-full bg-teal-700" />
              <div>
                <strong>Profit safety</strong>
                <p className="mt-1 text-muted">Repricing only triggers when competitor price is tracked.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
