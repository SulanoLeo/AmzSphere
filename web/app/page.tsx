"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PackageSearch, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BuyBoxStatus } from "@/components/product/BuyBoxStatus";
import { useProduct } from "@/context/ProductContext";

type Product = {
  asin: string;
  sku: string;
  vendor: string | null;
  stock: number | null;
  velocity_7d: number;
  velocity_30d: number;
  velocity_90d: number;
  days_supply: number | null;
  reorder_flag: boolean;
  opt_score: number | null;
  opt_status: string | null;
  needs_optimization: boolean;
};

type Dashboard = {
  seller_id: string;
  marketplace_id: string;
  products: Product[];
  pending_purchase_orders: Array<{ id: string; vendor: string; status: string; currency: string; total_amount_minor: number; lines: Array<{ sku: string; asin: string; quantity: number }> }>;
  sync_status: string | null;
  last_synced_at: string | null;
  needs_optimization_count: number;
  top_10_by_impact: Array<{
    asin: string;
    sku: string;
    name: string;
    opt_score: number;
    opt_status: string;
    impact: number;
    days_of_supply: number | null;
    sellable_units: number;
    opt_issues: string[];
  }>;
};

type SellerOption = { id: string; merchant_id: string; marketplace_id: string; region: string };

const USE_MOCK_DATA = true;

const mockDashboard: Dashboard = {
  seller_id: "mock-seller",
  marketplace_id: "ATVPDKIKX0DER",
  products: [
    { asin: "B0C8Q4M2K7", sku: "AF-LS-02", vendor: null, stock: 840, velocity_7d: 12, velocity_30d: 45, velocity_90d: 112, days_supply: 18.7, reorder_flag: false, opt_score: 100, opt_status: "optimized", needs_optimization: false },
    { asin: "B0B7P9R3W1", sku: "QC-M-11", vendor: null, stock: 230, velocity_7d: 8, velocity_30d: 31, velocity_90d: 76, days_supply: 7.4, reorder_flag: true, opt_score: 65, opt_status: "needs_optimization", needs_optimization: true },
    { asin: "B0D2L6T8N4", sku: "TG-BS-04", vendor: null, stock: 560, velocity_7d: 5, velocity_30d: 19, velocity_90d: 47, days_supply: 29.5, reorder_flag: false, opt_score: 20, opt_status: "needs_optimization", needs_optimization: true },
    { asin: "B0A9H5X3J6", sku: "LM-DL-08", vendor: null, stock: 410, velocity_7d: 6, velocity_30d: 24, velocity_90d: 58, days_supply: 17.1, reorder_flag: false, opt_score: 85, opt_status: "optimized", needs_optimization: false },
    { asin: "B0C3F7Y1V9", sku: "SD-CO-09", vendor: null, stock: 190, velocity_7d: 3, velocity_30d: 11, velocity_90d: 28, days_supply: 17.3, reorder_flag: false, opt_score: 44, opt_status: "needs_optimization", needs_optimization: true },
  ],
  pending_purchase_orders: [],
  sync_status: "completed",
  last_synced_at: new Date().toISOString(),
  needs_optimization_count: 3,
  top_10_by_impact: [
    { asin: "B0D2L6T8N4", sku: "TG-BS-04", name: "TerraGrip Silicone Bottle Sleeve", opt_score: 20, opt_status: "needs_optimization", impact: 86, days_of_supply: 29.5, sellable_units: 560, opt_issues: ["Title does not contain any of the backend keywords.", "Only 4 bullet points; at least 5 are recommended."] },
    { asin: "B0B7P9R3W1", sku: "QC-M-11", name: "QuietClick Wireless Mouse", opt_score: 65, opt_status: "needs_optimization", impact: 35, days_of_supply: 7.4, sellable_units: 230, opt_issues: ["Title is shorter than 80 characters.", "Only 4 bullet points; at least 5 are recommended."] },
    { asin: "B0C3F7Y1V9", sku: "SD-CO-09", name: "SnapDock Cable Organizer Set", opt_score: 44, opt_status: "needs_optimization", impact: 28, days_of_supply: 17.3, sellable_units: 190, opt_issues: ["Only 4 bullet points; at least 5 are recommended."] },
  ],
};

function Metric({ label, value, detail, accent, tag }: { label: string; value: string; detail: string; accent: string; tag?: string }) {
  return (
    <section className={`metric ${accent === "green" || accent === "teal" || accent === "blue" || accent === "warn" ? "" : ""}`}>
      <div className="metric-label"><span>{label}</span>{tag && <span className="mini-tag">{tag}</span>}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
      <div className={`metric-accent ${accent}`}></div>
    </section>
  );
}

export default function DashboardPage() {
  const { product } = useProduct();
  const [data, setData] = useState<Dashboard | null>(null);
  const [sellers, setSellers] = useState<SellerOption[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [isApprover, setIsApprover] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [poMessage, setPoMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  const loadDashboard = useCallback(async (sellerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard?seller_id=${encodeURIComponent(sellerId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Dashboard API unavailable");
      setData(payload);
      setError("");
    } catch (cause) {
      if (USE_MOCK_DATA) {
        setData(mockDashboard);
        setError("");
      } else {
        setError(cause instanceof Error ? cause.message : "Dashboard API unavailable");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  async function decidePurchaseOrder(id: string, action: "approve" | "deny") {
    setPoMessage("");
    try {
      const response = await fetch(`/api/purchase-orders/${encodeURIComponent(id)}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Purchase-order decision failed");
      setPoMessage(`PO ${payload.status}.`);
      if (selectedSeller) await loadDashboard(selectedSeller);
    } catch (cause) {
      setPoMessage(cause instanceof Error ? cause.message : "Purchase-order decision failed");
    }
  }

  async function syncSeller() {
    setSyncMessage("");
    try {
      const response = await fetch("/api/seller/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seller_id: selectedSeller }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not queue seller sync");
      setSyncMessage(`Seller sync queued · operation ${payload.operation_id}`);
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : "Could not queue seller sync");
    }
  }

  useEffect(() => {
    let active = true;
    const loadSellers = async () => {
      try {
        const [sellerResponse, accessResponse] = await Promise.all([
          fetch("/api/sellers", { cache: "no-store" }),
          fetch("/api/access", { cache: "no-store" }),
        ]);
        const payload = await sellerResponse.json();
        const access = await accessResponse.json();
        if (!sellerResponse.ok) throw new Error(payload.detail || "Seller accounts unavailable");
        if (accessResponse.ok) setIsApprover(Boolean(access.isApprover));
        if (!active) return;
        setSellers(payload);
        if (!payload.length) {
          setError("No Amazon seller is connected yet.");
          setLoading(false);
        }
        else setSelectedSeller((current) => current && payload.some((seller: SellerOption) => seller.id === current) ? current : payload[0].id);
        } catch (cause) {
        if (USE_MOCK_DATA) {
          const mockSellers: SellerOption[] = [{ id: "mock-seller", merchant_id: "Mock Seller", marketplace_id: "ATVPDKIKX0DER", region: "us-east-1" }];
          setSellers(mockSellers);
          setSelectedSeller("mock-seller");
          setIsApprover(true);
          setError("");
        } else if (active) {
          setError(cause instanceof Error ? cause.message : "Seller accounts unavailable");
        }
        if (active) setLoading(false);
      }
    };
    void loadSellers();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (selectedSeller) void loadDashboard(selectedSeller); }, [selectedSeller, loadDashboard]);

  const reorderRows = (data?.products || []).filter((product) => product.reorder_flag);
  const totalStock = (data?.products || []).reduce((total, product) => total + (product.stock ?? 0), 0);
  const chartData = (data?.products || []).map((product) => ({ sku: product.sku, velocity: product.velocity_30d }));

  return (
    <main className="min-h-screen bg-canvas px-4 py-5 md:px-8 md:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Seller operations</p><h1 className="mt-1 text-2xl font-semibold text-indigo-950">Operations overview</h1><p className="mt-1 text-sm text-muted">Inventory health and human-review work queue.</p></div>
        <div className="flex flex-wrap items-center gap-3">{sellers.length > 1 && <select aria-label="Seller account" className="h-9 max-w-56 rounded-md border border-line bg-white px-2 text-xs" value={selectedSeller} onChange={(event) => setSelectedSeller(event.target.value)}>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.merchant_id} · {seller.marketplace_id}</option>)}</select>}<Badge className={data?.sync_status === "completed" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-800"}>
          {data?.sync_status === "completed" ? `Synced · ${data?.last_synced_at ? new Date(data.last_synced_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}` : "Not connected"}
        </Badge><Button variant="outline" onClick={() => void syncSeller()} disabled={!selectedSeller || loading}><RefreshCw size={15} />Sync seller data</Button><Button variant="outline" onClick={() => selectedSeller && void loadDashboard(selectedSeller)} disabled={!selectedSeller || loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</Button><BuyBoxStatus /></div>
      </header>

      {syncMessage && <p role="status" className="mb-4 rounded-md border border-line bg-white px-4 py-3 text-xs">{syncMessage}</p>}
      {error && <div role="alert" className="mb-5 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><TriangleAlert size={18} /><div><strong>Backend not ready</strong><p className="mt-1">{error}</p><a href="/api/auth/amazon/start" className="mt-2 inline-block font-semibold underline">Connect a seller account</a></div></div>}
      {!product.hasBuyBox && <div role="alert" className="mb-6 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-950"><TriangleAlert size={18} /><div><strong>Urgent: Buy Box lost</strong><p className="mt-1">A competitor has taken the Buy Box at ${(product.competitorPrice ?? product.retailPrice - 0.1).toFixed(2)}. Trigger the Smart Repricer to reclaim it.</p><Link href="/repricer"><Button variant="outline">Open Repricer</Button></Link></div></div>}

      <div className="sync-bar">
        <span className="sync-badge good">Mock engine live</span>
        <button className="button" onClick={() => selectedSeller && void loadDashboard(selectedSeller)} disabled={!selectedSeller || loading}>Sync seller data</button>
        <button className="button button-outline" onClick={() => selectedSeller && void loadDashboard(selectedSeller)} disabled={!selectedSeller || loading}>Refresh</button>
      </div>
      <div className="metrics metrics-five">
        <Metric label="Catalog items" value={String(data?.products.length ?? "—")} detail="Seller-linked ASINs · one shared product record each" accent="blue" tag="CATALOG" />
        <Metric label="Sellable units" value={data ? data.products.reduce((total, item) => total + (item.stock ?? 0), 0).toLocaleString() : "—"} detail="Latest inventory snapshots across all marketplaces" accent="teal" tag="INVENTORY" />
        <Metric label="Needs optimization" value={data ? String(data.needs_optimization_count) : "—"} detail="Products below a 70 optimization score" accent="orange" tag="OPTIMIZATION" />
        <Metric label="Reorder flags" value={data ? String(reorderRows.length) : "—"} detail="Below 15 days of supply" accent="warn" tag="DAYS OF SUPPLY" />
        <Metric label="Pending approvals" value={String(data?.pending_purchase_orders.length ?? "—")} detail="Revisions awaiting your decision" accent="teal" tag="APPROVALS" />
      </div>

      {data?.top_10_by_impact?.length && (
        <Card className="mb-5"><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Optimization priority list</h2><p className="mt-1 text-xs text-muted">Ranked by (100 − score) × recent sales volume. Open the catalog to optimize.</p></div></CardHeader><CardContent>
          <div className="table-wrap"><table className="mock-table"><thead><tr><th>SKU</th><th>ASIN</th><th>Product</th><th className="tabular-nums">Score</th><th>Status</th><th className="tabular-nums">Impact</th><th>Issues</th><th>Action</th></tr></thead>
            <tbody>{data.top_10_by_impact.map((item) => {
              const issues = item.opt_issues || [];
              return (
                <tr key={item.asin} className="border-t border-line"><td className="sku-cell">{item.sku}</td><td className="sku-cell tabular-nums text-[10px] text-muted">{item.asin}</td><td>{item.name}</td><td className="tabular-nums font-semibold">{item.opt_score}</td><td><span className={item.opt_status === "needs_optimization" ? "status warn" : item.opt_status === "draft_ready" || item.opt_status === "pending_approval" ? "status pending" : item.opt_status === "optimized" ? "status good" : "status"}>{item.opt_status || "—"}</span></td><td className="tabular-nums">{Math.round(item.impact)}</td><td className="issue-cell">{issues.length ? issues.map((issue) => <span className="issue-tag" key={issue}>{issue}</span>) : <span className="issue-tag muted">—</span>}</td><td><button className="button button-outline button-sm" onClick={() => {}}>Optimize</button></td></tr>
              );
            })}</tbody>
          </table></div>
          <p className="mt-2 text-xs text-muted">Open <Link href="/catalog" className="font-semibold underline">SEO & Catalog</Link> to run the full optimize → approval → publish flow on any product above.</p>
        </CardContent></Card>
      )}

      <section className="section-grid mb-5">
        <div className="panel">
          <div className="panel-header"><div><h2 className="panel-title">30-day unit velocity</h2><div className="panel-subtitle">Calculated from ingested daily sales records</div></div><span className="category-pill">Rate-limited</span></div>
          <div className="panel-content"><div className="h-64 w-full">
            {chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}><CartesianGrid vertical={false} stroke="#e7ebf0" /><XAxis dataKey="sku" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="velocity" name="Units/day" fill="#007185" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-muted">No inventory history ingested yet.</div>}
          </div></div>
        </div>
        <div className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Execution guard</h2><div className="panel-subtitle">Control plane status</div></div></div>
          <div className="panel-content space-y-4 text-xs">
            <div className="flex items-start gap-3"><span className="mt-1 size-2 rounded-full bg-teal-700" /><div><strong>Redis/Celery queue</strong><p className="mt-1 text-muted">Tasks are dispatched from the PostgreSQL outbox.</p></div></div>
            <div className="flex items-start gap-3"><span className="mt-1 size-2 rounded-full bg-amber-500" /><div><strong>Amazon write mode</strong><p className="mt-1 text-muted">Requires server-side enablement and human approval.</p></div></div>
            <Link href={selectedSeller ? `/catalog?seller_id=${encodeURIComponent(selectedSeller)}` : "/catalog"} className="inline-flex items-center gap-2 pt-2 font-semibold text-teal-700 hover:underline"><PackageSearch size={15} />Open SEO workspace</Link>
          </div></div>
      </section>

      <Card className="mb-5"><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Autonomous procurement queue</h2><p className="mt-1 text-xs text-muted">Trailing 7/30/90-day velocity · replenishment proposals require review</p></div><Button variant="outline" disabled={!selectedSeller || loading} onClick={async () => { await fetch(`/api/inventory/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seller_id: selectedSeller }) }); if (selectedSeller) await loadDashboard(selectedSeller); }}>Run inventory scan</Button></CardHeader>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-canvas text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Velocity 7 / 30 / 90d</th><th className="px-4 py-3">Days supply</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>{(data?.products || []).map((product) => <tr key={`${product.asin}-${product.sku}`} className="border-t border-line"><td className="px-4 py-3"><strong>{product.sku}</strong><span className="mt-1 block text-[10px] text-muted">{product.asin}</span></td><td className="px-4 py-3 tabular-nums">{product.stock?.toLocaleString() ?? "Unknown"}</td><td className="px-4 py-3 tabular-nums">{product.velocity_7d} / {product.velocity_30d} / {product.velocity_90d}</td><td className="px-4 py-3">{product.days_supply ?? "Unknown"}</td><td className="px-4 py-3">{product.vendor || "Vendor not mapped"}</td><td className="px-4 py-3">{product.reorder_flag ? <Badge className="bg-amber-50 text-amber-800">Review reorder</Badge> : <Badge>{product.stock === null ? "Inventory pending" : "Healthy"}</Badge>}</td></tr>)}
          {!data?.products.length && <tr><td className="px-4 py-8 text-center text-muted" colSpan={6}>{loading ? "Loading catalog…" : "Connect a seller and ingest catalog/inventory data to populate this table."}</td></tr>}</tbody>
        </table></div>
      </Card>
      <Card className="mb-5"><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Purchase orders awaiting review</h2><p className="mt-1 text-xs text-muted">Vendor-formatted PDF drafts · approval does not transmit an order</p></div><Badge>{data?.pending_purchase_orders.length ?? 0} pending</Badge></CardHeader>
        {poMessage && <p role="status" className="border-b border-line bg-canvas px-4 py-2 text-xs">{poMessage}</p>}
        <div className="divide-y divide-line">{(data?.pending_purchase_orders || []).map((purchaseOrder) => <div key={purchaseOrder.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-[220px] flex-1"><p className="text-xs font-semibold text-indigo-950">{purchaseOrder.vendor}</p><p className="mt-1 text-[10px] text-muted">{purchaseOrder.lines.map((line) => `${line.sku} · ${line.quantity} units`).join("; ")}</p></div>
          <strong className="text-xs tabular-nums">${purchaseOrder.currency} {(purchaseOrder.total_amount_minor / 100).toFixed(2)}</strong>
          <div className="flex items-center gap-2"><a className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-xs font-semibold hover:bg-canvas" href={`/api/purchase-orders/${encodeURIComponent(purchaseOrder.id)}/pdf`}>PO PDF</a>{isApprover ? <><Button variant="outline" onClick={() => void decidePurchaseOrder(purchaseOrder.id, "deny")}>Deny</Button><Button onClick={() => void decidePurchaseOrder(purchaseOrder.id, "approve")}>Approve</Button></> : <Badge className="bg-amber-50 text-amber-800">Approver required</Badge>}</div>
        </div>)}{!data?.pending_purchase_orders.length && <p className="px-4 py-6 text-center text-xs text-muted">No purchase orders are awaiting review.</p>}</div>
      </Card>
      <p className="text-right text-[10px] text-muted">{totalStock ? `${totalStock.toLocaleString()} units represented` : "No seller data loaded"} · API credentials remain server-side</p>
    </main>
  );
}