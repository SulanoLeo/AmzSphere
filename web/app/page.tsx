"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PackageSearch,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Dashboard, Seller } from "@/lib/provider/types";
import { useAmzStore } from "@/lib/useAmzStore";

const RADIAL_COLORS = ["#006a63", "#3525cd", "#ffb95f", "#777587", "#10B981"];

function Metric({
  label,
  value,
  detail,
  accent,
  tag,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tag?: string;
  href?: string;
}) {
  const content = (
    <section className="metric" data-accent={accent}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
    </section>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function StatCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-line bg-white">
      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">{label}</span>
      <div className="font-mono-metric-lg text-on-surface">{value}</div>
      <span className="text-[10px] text-muted">{detail}</span>
      <div className="h-[3px] w-full rounded-full mt-2" style={{ backgroundColor: `${color}20` }} />
    </div>
  );
}

function SetupStep({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 mb-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-900 text-white text-[10px] font-bold flex items-center justify-center">
        {number}
      </span>
      <div>
        <div className="text-xs font-semibold text-indigo-900">{title}</div>
        <div className="text-[10px] text-muted">{desc}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const products = useAmzStore((state) => state.products);
  const hydrateProducts = useAmzStore((state) => state.hydrateProducts);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [isApprover, setIsApprover] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [poMessage, setPoMessage] = useState("");
  const [productAddedMessage, setProductAddedMessage] = useState("");
  const [reviewPoOpen, setReviewPoOpen] = useState("");
  const [approvePoOpen, setApprovePoOpen] = useState("");
  const [ppcData, setPpcData] = useState<{ campaigns: Array<{ base_acos?: number; trailing_acos?: number; ad_share?: number; avg_cpc?: number }>; search_terms: Array<{ spend?: number; sales?: number; order_value?: number; conversions?: number; acos?: number }> } | null>(null);

  const loadDashboard = useCallback(async (sellerId: string) => {
    setLoading(true);
    try {
      const [payload, catalog, ppc] = await Promise.all([
        provider.getDashboard(),
        provider.getProducts({ page_size: 200 }),
        provider.getPpcData(),
      ]);
      setData(payload);
      hydrateProducts(catalog.products, ppc.campaigns);
      setPpcData(ppc);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard API unavailable");
    } finally {
      setLoading(false);
    }
  }, [hydrateProducts]);

  async function decidePurchaseOrder(id: string, action: "approve" | "deny") {
    setPoMessage("");
    try {
      await provider.decidePurchaseOrder(id, action);
      setPoMessage(`PO ${action}d.`);
      if (selectedSeller) await loadDashboard(selectedSeller);
    } catch (cause) {
      setPoMessage(cause instanceof Error ? cause.message : "Purchase-order decision failed");
    }
  }

  async function runInventoryScan() {
    if (!selectedSeller) return;
    try {
      await provider.runInventoryScan(selectedSeller);
      await loadDashboard(selectedSeller);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventory scan failed");
    }
  }

  useEffect(() => {
    let active = true;
    const loadSellers = async () => {
      try {
        const payload = await provider.getSellers();
        if (!active) return;
        setSellers(payload);
        if (!payload.length) {
          setError("No Amazon seller is connected yet.");
          setLoading(false);
        } else {
          setSelectedSeller(
            (current) =>
              current && payload.some((seller: Seller) => seller.id === current)
                ? current
                : payload[0].id,
          );
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Seller accounts unavailable");
        if (active) setLoading(false);
      }
    };
    void loadSellers();
    return () => { active = false; };
  }, [provider]);

  useEffect(() => {
    if (selectedSeller) void loadDashboard(selectedSeller);
  }, [selectedSeller, loadDashboard]);

  const connected = data?.sync_status === "completed";
  const activeListingCount = products.filter((product) => !product.suppressed).length;
  const totalStock = products.reduce((total, product) => total + product.stockLevel, 0);
  const needsOptCount = products.filter(
    (product) => product.missingAssets.bullets || product.missingAssets.images,
  ).length;
  const urgentCount = products.filter((product) => product.daysSupply < 10).length;
  const pendingCount = data?.pending_purchase_orders.length ?? 0;

  // Procurement mix derived from pending POs grouped by vendor
  const procurementByVendor = data?.pending_purchase_orders.reduce<Record<string, number>>((acc, po) => {
    acc[po.vendor] = (acc[po.vendor] || 0) + (po.total_amount_minor / 100);
    return acc;
  }, {}) || {};
  const procurementTotal = Object.values(procurementByVendor).reduce((sum, v) => sum + v, 0);
  const procurementMix = procurementTotal > 0
    ? Object.entries(procurementByVendor).map(([name, value]) => ({
        name,
        value: Math.round((value / procurementTotal) * 100),
      }))
    : [];

  // Advertising metrics derived from PPC data
  const campaigns = ppcData?.campaigns ?? [];
  const searchTerms = ppcData?.search_terms ?? [];
  const totalSpend = searchTerms.reduce((sum, t) => sum + (Number(t.spend) || 0), 0);
  const totalSalesValue = searchTerms.reduce((sum, t) => sum + (Number(t.sales) || 0) * (Number(t.order_value) || 0), 0);
  const acosPct = totalSalesValue > 0 ? (totalSpend / totalSalesValue * 100).toFixed(1) : "—";
  const roasVal = totalSpend > 0 ? (totalSalesValue / totalSpend).toFixed(1) : "—";

  // Velocity data from dashboard aggregates
  const velocity7d = data?.sales_velocity?.units_7d ?? 0;
  const velocity30d = data?.sales_velocity?.units_30d ?? 0;
  const velocity90d = data?.sales_velocity?.units_90d ?? 0;
  const hasVelocityData = data != null && data.products.length > 0 && (velocity7d || velocity30d || velocity90d);

  const hasPpcData = searchTerms.length > 0 || campaigns.length > 0;
  const hasProcurementData = procurementTotal > 0;

  const rateLimited = data?.sync_status === "rate_limited";

  return (
    <main className="workspace-page bg-canvas">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
        <Link href="/" className="flex items-center gap-1">
          <PackageSearch size={11} />
          <span>SELLER OPERATIONS</span>
        </Link>
        <span>/</span>
        <span>OPERATIONS OVERVIEW</span>
      </div>

      {/* Header */}
      <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mt-0 lg:mt-2 lg:ml-4 lg:border-l lg:border-line lg:pl-4">
            Operations overview
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 lg:mt-0 lg:ml-5">
            Inventory health and human-review work queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="bg-amber-50 text-amber-800">Sample data</Badge>
        </div>
      </header>

      {/* Alert banner */}
      {error && (
        <div role="alert" className="alert-banner amber mb-6">
          <div className="alert-banner-icon">
            <TriangleAlert size={18} />
          </div>
          <div className="alert-banner-content">
            <div className="alert-banner-title">Backend not ready · Authorization required</div>
            <div className="alert-banner-desc">
              This work sample runs on local mock seller data only. It does not connect to Amazon or require production credentials.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-teal-50 text-teal-800 border-teal-200">Mock engine live</Badge>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {`${activeListingCount} active listings, ${totalStock.toLocaleString()} stock units, and ${urgentCount} items under 10 days of supply.`}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {productAddedMessage}
      </p>

      {/* Metrics row */}
      <div className="metrics metrics-five align-items-stretch mb-8">
        <Metric
          label="CATALOG"
          href="/catalog/products"
          value={loading && products.length === 0 ? "—" : String(activeListingCount)}
          detail="Active listings"
          accent="blue"
          tag="CATALOG"
        />
        <Metric
          label="INVENTORY"
          href="/supply/inventory"
          value={loading && products.length === 0 ? "—" : totalStock.toLocaleString()}
          detail="In-stock items across warehouses"
          accent="teal"
          tag="INVENTORY"
        />
        <Metric
          label="NEEDS OPTIMIZATION"
          href="/catalog/seo"
          value={String(needsOptCount)}
          detail="Missing bullets or imagery"
          accent="orange"
          tag="OPTIMIZE"
        />
        <Metric
          label="URGENT"
          href="/supply/replenishment"
          value={String(urgentCount)}
          detail={`${urgentCount} item${urgentCount === 1 ? "" : "s"} under 10 days of supply`}
          accent="red"
          tag="Stockout danger"
        />
        <Metric
          label="APPROVALS"
          href="/supply/purchasing?tab=approvals"
          value={String(pendingCount)}
          detail="Revisions awaiting decision"
          accent="teal"
          tag={`${pendingCount} in queue`}
        />
      </div>

      {/* Chart row: velocity + procurement mix */}
      <section className="section-grid align-items-stretch mb-8">
        <div className="panel flex flex-col h-full">
          <div className="panel-header flex items-center justify-between">
            <div>
              <h2 className="panel-title">30-day unit velocity</h2>
              <div className="panel-subtitle">Calculated from ingested daily sales records</div>
            </div>
            {rateLimited && <span className="category-pill">Rate-Limited</span>}
          </div>
          <div className="panel-content min-h-full flex-1">
            {hasVelocityData ? (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <StatCard label="7-Day Units" value={velocity7d.toLocaleString()} detail="Trailing 7-day units" color="#3525cd" />
                <StatCard label="30-Day Units" value={velocity30d.toLocaleString()} detail="Trailing 30-day units" color="#006a63" />
                <StatCard label="90-Day Units" value={velocity90d.toLocaleString()} detail="Trailing 90-day units" color="#ffb95f" />
              </div>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">No sales velocity data available yet.</div>
            )}
          </div>
        </div>

        <Link href="/supply/purchasing">
          <div className="panel flex flex-col h-full">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h2 className="panel-title">Procurement mix</h2>
                <div className="panel-subtitle">Open · Approved</div>
              </div>
              <div className="text-right">
                <div className="font-mono-metric-lg text-on-surface">{hasProcurementData ? `$${procurementTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</div>
                <span className="text-[10px] text-muted">Target lead-time fulfillment</span>
              </div>
            </div>
            <div className="panel-content min-h-full flex-1">
              {hasProcurementData ? (
                <div className="flex items-center justify-between">
                  <div className="w-32 h-32 flex items-center justify-center">
                    <PieChart width={140} height={140}>
                      <Pie
                        data={procurementMix}
                        dataKey="value"
                        nameKey="name"
                        cx={70}
                        cy={70}
                        innerRadius={42}
                        outerRadius={62}
                      >
                        {procurementMix.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={RADIAL_COLORS[index % RADIAL_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div className="absolute flex flex-col items-center">
                      <span className="font-mono-metric-lg text-on-surface">{procurementMix.length}</span>
                      <span className="text-[10px] text-muted uppercase">CHANNELS</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-left">
                    {procurementMix.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2 text-[10px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RADIAL_COLORS[index % RADIAL_COLORS.length] }} />
                        <span className="text-on-surface">{entry.name}</span>
                        <span className="ml-auto font-mono-code-sm text-muted">{entry.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">No pending purchase orders to compute procurement mix.</div>
              )}
            </div>
          </div>
        </Link>
      </section>

      {/* Chart row: Advertising efficiency */}
      <section className="mb-8">
        <Link href="/marketing/ppc">
          <div className="panel flex flex-col h-full">
            <div className="panel-header flex items-center justify-between">
              <div>
                <h2 className="panel-title">Advertising efficiency</h2>
                <div className="panel-subtitle">Portfolio ACoS · 30-day trend</div>
              </div>
              <span className="category-pill">ACoS</span>
            </div>
            <div className="panel-content min-h-full flex-1">
              {hasPpcData ? (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <StatCard label="ACoS Target" value="22%" detail="Target portfolio efficiency" color="#006a63" />
                    <StatCard label="ACoS" value={`${acosPct}%`} detail="Last 30-day average" color="#3525cd" />
                    <StatCard label="RoAS" value={`${roasVal}x`} detail="Return on ad spend" color="#ffb95f" />
                    <StatCard label="Spend" value={`$${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} detail="30-day ad spend" color="#10B981" />
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={searchTerms.map((t, i) => ({ day: `T${i + 1}`, acos: Number(t.acos) || 0 }))}
                        margin={{ top: 12, right: 12, bottom: 4, left: -16 }}
                      >
                        <CartesianGrid vertical={false} stroke="#e7ebf0" />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                        <Tooltip />
                        <Line dataKey="acos" stroke="#007185" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">No advertising data available yet.</div>
              )}
            </div>
          </div>
        </Link>
      </section>

      {/* Autonomous procurement queue */}
      <Card className="mb-8">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="panel-title">Autonomous procurement queue</h2>
            <p className="panel-subtitle">Trailing 7/30/90-day velocity · replenishment proposals require review</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="text-[10px] px-2" disabled={!selectedSeller || loading} onClick={runInventoryScan}>
              Run inventory scan
            </Button>
            <Link href="/supply/replenishment" className="text-[10px] font-semibold text-indigo-600 hover:underline">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table aria-busy={loading} className="w-full min-w-[780px] text-left text-xs">
              <caption className="sr-only">Catalog products with stock, velocity, supply, and reorder status</caption>
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">SKU / ASIN</th>
                  <th scope="col" className="px-4 py-3">Stock level</th>
                  <th scope="col" className="px-4 py-3">Velocity 7 / 30 / 90d</th>
                  <th scope="col" className="px-4 py-3">Days supply</th>
                  <th scope="col" className="px-4 py-3">Vendor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const dashboardProduct = data?.products.find((item) => item.sku === product.sku);
                  const needsReorder = product.daysSupply < 15;
                  return (
                  <tr key={`${product.asin}-${product.sku}`} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left">
                      <strong>{product.sku}</strong>
                      <span className="mt-1 block text-[10px] text-muted">{product.asin}</span>
                    </th>
                    <td className="px-4 py-3 tabular-nums">{product.stockLevel.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {dashboardProduct
                        ? `${dashboardProduct.velocity_7d} / ${dashboardProduct.velocity_30d} / ${dashboardProduct.velocity_90d}`
                        : `${Math.round(product.daily_velocity * 7)} / ${Math.round(product.velocity30d)} / ${Math.round(product.daily_velocity * 90)}`}
                    </td>
                    <td className="px-4 py-3">{Number.isFinite(product.daysSupply) ? product.daysSupply.toFixed(1) : "Unknown"}</td>
                    <td className="px-4 py-3">{product.supplier || "Vendor not mapped"}</td>
                    <td className="px-4 py-3">
                      {needsReorder ? (
                        <Badge className="bg-amber-50 text-amber-800">Needs PO draft</Badge>
                      ) : (
                        <Badge className="bg-teal-50 text-teal-800">In queue</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        className="text-[10px] px-2"
                        onClick={() => setReviewPoOpen(product.asin)}
                        disabled={!needsReorder}
                      >
                        Review PO
                      </Button>
                    </td>
                  </tr>
                );})}
                {!products.length && (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted" colSpan={7}>
                      {loading ? "Loading catalog…" : "Connect a seller and ingest catalog/inventory data to populate this table."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Purchase orders awaiting review */}
      <Card className="mb-8">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="panel-title">Purchase orders awaiting review</h2>
            <p className="panel-subtitle">Vendor-formatted PDF drafts · approval does not automatically transmit an order to external EDI</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{pendingCount} drafts</Badge>
            <Link href="/supply/purchasing?tab=approvals" className="text-[10px] font-semibold text-indigo-600 hover:underline">
              Review all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {poMessage && (
            <p role="status" className="border-b border-line bg-canvas px-4 py-2 text-xs">{poMessage}</p>
          )}
          <div className="divide-y divide-line">
            {data?.pending_purchase_orders.map((purchaseOrder) => (
              <div key={purchaseOrder.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <p className="text-xs font-semibold text-indigo-950">{purchaseOrder.vendor}</p>
                  <p className="mt-1 text-[10px] text-muted">{purchaseOrder.lines.map((line) => `${line.sku} · ${line.quantity} units`).join("; ")}</p>
                </div>
                <strong className="text-xs tabular-nums">{purchaseOrder.currency} {(purchaseOrder.total_amount_minor / 100).toFixed(2)}</strong>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-semibold hover:bg-canvas"
                    href={`/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/pdf`}
                  >
                    Inspect PDF
                  </a>
                  {isApprover ? (
                    <Button className="text-[10px] px-2" onClick={() => { setApprovePoOpen(purchaseOrder.id); void decidePurchaseOrder(purchaseOrder.id, "approve"); }}>
                      Approve
                    </Button>
                  ) : (
                    <Badge className="bg-amber-50 text-amber-800">Awaiting signature</Badge>
                  )}
                </div>
              </div>
            ))}
            {!data?.pending_purchase_orders.length && (
              <div className="px-4 py-6 text-center text-muted text-sm">No purchase orders awaiting review.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-[10px] text-muted">
        {totalStock ? `${totalStock.toLocaleString()} sample units represented` : "No mock seller data loaded"} · Changes use temporary mock state
      </p>

      {reviewPoOpen && (
        <Modal open={Boolean(reviewPoOpen)} onClose={() => setReviewPoOpen("")} title="Review Purchase Order">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">PO Details</div>
              <div className="text-[10px] text-muted mb-3">Review vendor-formatted draft before approving. Approval does not transmit to external EDI.</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Vendor</label>
                  <span className="text-xs text-on-surface">Vendor not mapped</span>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Status</label>
                  <Badge className="bg-amber-50 text-amber-800 border-amber-200">Pending Review</Badge>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-md border border-line bg-white/50">
              <div className="text-[10px] font-bold text-on-surface mb-1">Line Items</div>
              <div className="text-[10px] text-muted">No line items ingested yet. Connect a seller and run inventory scan to populate PO drafts.</div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setReviewPoOpen("")}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      {approvePoOpen && (
        <Modal open={Boolean(approvePoOpen)} onClose={() => setApprovePoOpen("")} title="Approve Purchase Order">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-indigo-900 mb-1">Confirmation</div>
              <div className="text-[10px] text-muted mb-3">Approving this purchase order will release it for vendor fulfillment. Approval requires approver role.</div>
            </div>
            <div className="p-3 rounded-md border border-line bg-teal-50">
              <div className="text-[10px] font-bold text-teal-800 mb-1">What approval does</div>
              <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
                <li>Records the decision in local mock state</li>
                <li>Does not submit a PO to a vendor</li>
                <li>Refreshes the sample dashboard after a decision</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setApprovePoOpen("")}>Cancel</Button>
              <Button onClick={() => setApprovePoOpen("")}>Confirm Approve</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
