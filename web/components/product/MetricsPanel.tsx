"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useProduct } from "@/context/ProductContext";

interface MetricProps {
  label: string;
  value: string;
  detail: string;
}

function Metric({ label, value, detail }: MetricProps) {
  return (
    <div className="rounded-md bg-canvas p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-indigo-950">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

export function MetricsPanel() {
  const { metrics } = useProduct();

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-3 block">
          Executive Profitability
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Landed Cost" value={`$${metrics.landedCost.toFixed(2)}`} detail="Factory + shipping / unit" />
          <Metric label="Amazon Fees" value={`$${metrics.amazonFees.toFixed(2)}`} detail="15% referral fee" />
          <Metric label="Daily Profit" value={`$${metrics.dailyProfit.toFixed(2)}`} detail="(Price - Cost - Fees) × Velocity - Ad Spend" />
          <Metric
            label="Days of Stock"
            value={metrics.daysOfStockRemaining === Infinity ? "N/A" : String(metrics.daysOfStockRemaining)}
            detail={metrics.reorderNeeded ? "Below 30 days" : "Healthy"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
