"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ShieldAlert, TriangleAlert, LayoutDashboard } from "lucide-react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ClientProductProvider } from "@/lib/provider/client";
import type { Dashboard, Seller } from "@/lib/provider/types";

const acosHistory = [
  { day: "Sep 24", acos: 23.4 },
  { day: "Sep 26", acos: 21.8 },
  { day: "Sep 28", acos: 24.1 },
  { day: "Sep 30", acos: 22.0 },
  { day: "Oct 2", acos: 22.5 },
  { day: "Oct 4", acos: 21.2 },
  { day: "Oct 6", acos: 22.8 },
  { day: "Oct 8", acos: 23.6 },
  { day: "Oct 10", acos: 22.2 },
  { day: "Oct 12", acos: 24.0 },
  { day: "Oct 14", acos: 22.4 },
  { day: "Oct 16", acos: 21.9 },
  { day: "Oct 18", acos: 22.6 },
  { day: "Oct 20", acos: 20.8 },
  { day: "Oct 22", acos: 22.1 },
];

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
      <div className="metric-label">
        <span>{label}</span>
        {tag && <span className="mini-tag">{tag}</span>}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
      <div className={`metric-accent ${accent}`}></div>
    </section>
  );
}

function SellerPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium"
      style={{ borderColor: color, color, backgroundColor: `${color}1a` }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}: {value}
    </span>
  );
}

export default function DashboardPage() {
  const provider = new ClientProductProvider();
  const [data, setData] = useState<Dashboard | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [isApprover, setIsApprover] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [poMessage, setPoMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  const loadDashboard = useCallback(async (sellerId: string) => {
    setLoading(true);
    try {
      const payload = await provider.getDashboard();
      setData(payload);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard API unavailable");
    } finally {
      setLoading(false);
    }
  }, [provider]);

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

  async function syncSeller() {
    setSyncMessage("");
    try {
      await provider.syncState();
      setSyncMessage("Seller sync queued.");
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : "Could not queue seller sync");
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

  const reorderRows = (data?.products || []).filter((product) => product.reorder_flag);
  const totalStock = (data?.products || []).reduce(
    (total, product) => total + (product.stock ?? 0),
    0,
  );
  const chartData = (data?.products || []).map((product) => ({
    sku: product.sku,
    velocity: product.velocity_30d,
  }));

  const connected = data?.sync_status === "completed";
  const avgScore =
    data?.products.length
      ? Math.round(
          (data.products.reduce((s, p) => s + (p.opt_score ?? 0), 0) /
            Math.max(data.products.length, 1)) * 10,
        ) / 10
      : 0;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 md:px-10 md:py-10">
      {/* Header */}
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-label-md uppercase tracking-wider">
            <PackageSearch size={15} />
            <span>SEO & Catalog</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Seller</span>
              <SellerPill label="SELLER" value={sellers.find((s) => s.id === selectedSeller)?.merchant_id ?? "—"} color="#6366F1" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Period</span>
              <span className="text-sm font-semibold text-on-surface">10-26-26 / 10-27-26</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight mt-0 lg:mt-2 lg:ml-4 lg:border-l lg:border-line lg:pl-4">
              Operations overview
            </h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mt-2 lg:mt-0 lg:ml-5">
            Inventory health and human-review work queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sellers.length > 1 && (
            <select aria-label="Seller account" className="h-9 max-w-56 rounded-md border border-line bg-white px-2 text-xs" value={selectedSeller} onChange={(event) => setSelectedSeller(event.target.value)}>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>{seller.merchant_id} · {seller.marketplace_id}</option>
              ))}
            </select>
          )}
          <Badge className={connected ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}>
            {connected ? `Synced · ${data?.last_synced_at ? new Date(data.last_synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}` : "Not connected"}
          </Badge>
          <Button variant="outline" onClick={() => void syncSeller()} disabled={!selectedSeller || loading}>
            <RefreshCw size={15} /> Sync seller data
          </Button>
          <Button variant="outline" onClick={() => selectedSeller && void loadDashboard(selectedSeller)} disabled={!selectedSeller || loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Badge className="bg-teal-50 text-teal-800 border-teal-200">Buy Box owned</Badge>
        </div>
      </header>

      {/* Alert banner */}
      {error && (
        <div role="alert" className="alert-banner amber mb-5">
          <div className="alert-banner-icon">
            <TriangleAlert size={18} />
          </div>
          <div className="alert-banner-content">
            <div className="alert-banner-title">Backend not ready</div>
            <div className="alert-banner-desc">
              Connect a seller account to activate real-time Selling Partner API (SP-API) streams. Writes and automated pricing repricing remain safely gated.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-teal-50 text-teal-800 border-teal-200">Mock engine live</Badge>
            <Button onClick={() => void syncSeller()} disabled={loading}>
              Connect seller account
            </Button>
          </div>
        </div>
      )}

      {syncMessage && (
        <p role="status" className="mb-4 rounded-md border border-line bg-white px-4 py-3 text-xs">{syncMessage}</p>
      )}

      {/* Metrics row */}
      <div className="metrics metrics-five mb-6">
        <Metric
          label="Catalog"
          value={String(data?.products.length ?? "—")}
          detail="Seller-linked ASINs · one shared product record each"
          accent="blue"
          tag="CATALOG"
        />
        <Metric
          label="Inventory"
          value={data ? data.products.reduce((total, item) => total + (item.stock ?? 0), 0).toLocaleString() : "—"}
          detail="Latest inventory snapshots across all marketplaces"
          accent="teal"
          tag="INVENTORY"
        />
        <Metric
          label="Needs optimization"
          value={data ? String(Math.round((data.products.reduce((s, p) => s + (p.opt_score ?? 0), 0) / Math.max(data.products.length, 1)))) : "—"}
          detail="Missing bullets or imagery"
          accent="orange"
          tag="REVIEW SEO"
        />
        <Metric
          label="Days of supply"
          value={data ? String(reorderRows.length) : "—"}
          detail="Below 15 days of inventory left"
          accent="warn"
          tag="STOCKOUT DANGER"
        />
        <Metric
          label="Approvals"
          value={String(data?.pending_purchase_orders.length ?? "—")}
          detail="Revisions awaiting decision"
          accent="teal"
          tag="APPROVALS"
        />
      </div>

      {/* Chart row: velocity + guard */}
      <section className="section-grid mb-6">
        <div className="panel">
          <div className="panel-header flex items-center justify-between">
            <div>
              <h2 className="panel-title">30-day unit velocity</h2>
              <div className="panel-subtitle">Calculated from ingested daily sales records</div>
            </div>
            <span className="category-pill">Rate-Limited</span>
          </div>
          <div className="panel-content">
            <div className="h-64 w-full">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                    <CartesianGrid vertical={false} stroke="#e7ebf0" />
                    <XAxis dataKey="sku" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="velocity" name="Units/day" fill="#007185" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">No inventory history ingested yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Chart row: ACoS + procurement mix */}
      <section className="section-grid mb-6">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Advertising efficiency</h2>
              <div className="panel-subtitle">Portfolio ACoS · 30-day trend</div>
            </div>
            <span className="category-pill">ACoS</span>
          </div>
          <div className="panel-content">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={acosHistory} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="#e7ebf0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Line dataKey="acos" stroke="#007185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Autonomous procurement queue */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="panel-title">Autonomous procurement queue</h2>
            <p className="panel-subtitle">Trailing 7/30/90-day velocity · replenishment proposals require review</p>
          </div>
          <Button variant="outline" disabled={!selectedSeller || loading} onClick={runInventoryScan}>
            Run inventory scan
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">SKU / ASIN</th>
                  <th className="px-4 py-3">Stock level</th>
                  <th className="px-4 py-3">Velocity 7 / 30 / 90d</th>
                  <th className="px-4 py-3">Days supply</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {(data?.products || []).map((product) => (
                  <tr key={`${product.asin}-${product.sku}`} className="border-t border-line">
                    <td className="px-4 py-3">
                      <strong>{product.sku}</strong>
                      <span className="mt-1 block text-[10px] text-muted">{product.asin}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{product.stock?.toLocaleString() ?? "Unknown"}</td>
                    <td className="px-4 py-3 tabular-nums">{product.velocity_7d} / {product.velocity_30d} / {product.velocity_90d}</td>
                    <td className="px-4 py-3">{product.days_supply ?? "Unknown"}</td>
                    <td className="px-4 py-3">{product.vendor || "Vendor not mapped"}</td>
                    <td className="px-4 py-3">
                      {product.reorder_flag ? (
                        <Badge className="bg-amber-50 text-amber-800">Needs PO draft</Badge>
                      ) : (
                        <Badge className="bg-teal-50 text-teal-800">In queue</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" onClick={() => {}}>
                        Review PO
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data?.products.length && (
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
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="panel-title">Purchase orders awaiting review</h2>
            <p className="panel-subtitle">Vendor-formatted PDF drafts · approval does not automatically transmit an order to external EDI</p>
          </div>
          <Badge>{data?.pending_purchase_orders.length ?? 0} drafts</Badge>
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
                    <Button onClick={() => void decidePurchaseOrder(purchaseOrder.id, "approve")}>
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
        {totalStock ? `${totalStock.toLocaleString()} units represented` : "No seller data loaded"} · API credentials remain server-side
      </p>
    </main>
  );
}
