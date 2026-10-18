"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Boxes, ChartNoAxesCombined, CircleDollarSign, ClipboardCheck, FileText, PackageSearch, RefreshCw, ShieldCheck, Store, TriangleAlert } from "lucide-react";
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
};

type Dashboard = {
  seller_id: string;
  marketplace_id: string;
  products: Product[];
  pending_purchase_orders: Array<{ id: string; vendor: string; status: string; currency: string; total_amount_minor: number; lines: Array<{ sku: string; asin: string; quantity: number }> }>;
};

type SellerOption = { id: string; merchant_id: string; marketplace_id: string; region: string };

const navigation = [
  ["Overview", "/", Activity], ["SEO & Catalog", "/catalog", PackageSearch], ["Sourcing", "/sourcing", Store],
  ["PPC Advertising", "/ppc", ChartNoAxesCombined], ["Inventory", "/inventory", Boxes],
  ["Pricing", "/repricer", CircleDollarSign], ["Activity Log", "/activity", FileText],
  ["Approvals", "/approvals", ClipboardCheck],
] as const;

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <Card><CardContent className="flex min-h-32 items-start justify-between gap-3">
    <div><p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p><p className="mt-3 text-2xl font-semibold text-indigo-950">{value}</p><p className="mt-1 text-xs text-muted">{detail}</p></div>
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-canvas text-indigo-900"><Icon size={17} /></span>
  </CardContent></Card>;
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
      setError(cause instanceof Error ? cause.message : "Dashboard API unavailable");
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
        if (active) setError(cause instanceof Error ? cause.message : "Seller accounts unavailable");
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

  return <div className="min-h-screen md:grid md:grid-cols-[238px_minmax(0,1fr)]">
    <aside className="flex flex-col bg-indigo-950 px-4 py-5 text-slate-200 md:sticky md:top-0 md:h-screen">
      <Link href="/" className="flex items-center gap-3 px-2 pb-7">
        <span className="grid size-9 place-items-center rounded-md bg-amber-400 font-bold text-indigo-950">A</span>
        <span><strong className="block text-sm text-white">AmzSphere</strong><small className="text-[10px] uppercase tracking-widest text-slate-400">Operations</small></span>
      </Link>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
      <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Main navigation">
        {navigation.map(([label, href, Icon], index) => <Link key={label} href={href} className={`flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-xs font-medium transition-colors ${index === 0 ? "bg-indigo-800 text-white" : "text-slate-300 hover:bg-indigo-900 hover:text-white"}`}>
          <Icon size={16} aria-hidden="true" />{label}
        </Link>)}
      </nav>
      <div className="mt-auto hidden border-t border-slate-700 pt-4 text-xs text-slate-400 md:block">
        <div className="flex items-center gap-2 text-white"><span className="size-2 rounded-full bg-amber-400" />Production integration gated</div>
        <p className="mt-2 leading-5">Writes stay disabled until SP-API is enabled and dry-run is off.</p>
      </div>
    </aside>

    <main className="min-w-0 px-4 py-5 md:px-8 md:py-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Seller operations</p><h1 className="mt-1 text-2xl font-semibold text-indigo-950">Operations overview</h1><p className="mt-1 text-sm text-muted">Inventory health and human-review work queue.</p></div>
        <div className="flex flex-wrap items-center gap-3">{sellers.length > 1 && <select aria-label="Seller account" className="h-9 max-w-56 rounded-md border border-line bg-white px-2 text-xs" value={selectedSeller} onChange={(event) => setSelectedSeller(event.target.value)}>{sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.merchant_id} · {seller.marketplace_id}</option>)}</select>}<Badge className="bg-amber-50 text-amber-800">{data ? data.marketplace_id : "Not connected"}</Badge><Button variant="outline" onClick={() => void syncSeller()} disabled={!selectedSeller || loading}><RefreshCw size={15} />Sync seller data</Button><Button variant="outline" onClick={() => selectedSeller && void loadDashboard(selectedSeller)} disabled={!selectedSeller || loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />Refresh</Button><BuyBoxStatus /></div>
      </header>

      {syncMessage && <p role="status" className="mb-4 rounded-md border border-line bg-white px-4 py-3 text-xs">{syncMessage}</p>}
      {error && <div role="alert" className="mb-5 flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><TriangleAlert size={18} /><div><strong>Backend not ready</strong><p className="mt-1">{error}</p><a href="/api/auth/amazon/start" className="mt-2 inline-block font-semibold underline">Connect a seller account</a></div></div>}
      {!product.hasBuyBox && <div role="alert" className="mb-6 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-950"><TriangleAlert size={18} /><div><strong>Urgent: Buy Box lost</strong><p className="mt-1">A competitor has taken the Buy Box at ${(product.competitorPrice ?? product.retailPrice - 0.1).toFixed(2)}. Trigger the Smart Repricer to reclaim it.</p><Link href="/repricer"><Button variant="outline">Open Repricer</Button></Link></div></div>}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Catalog items" value={String(data?.products.length ?? "—")} detail="Seller-linked ASINs" icon={PackageSearch} />
        <Metric label="Sellable units" value={data ? data.products.reduce((total, item) => total + (item.stock ?? 0), 0).toLocaleString() : "—"} detail="Latest inventory snapshots" icon={Boxes} />
        <Metric label="Reorder flags" value={data ? String(reorderRows.length) : "—"} detail="Below 30 days of supply" icon={TriangleAlert} />
        <Metric label="Pending POs" value={String(data?.pending_purchase_orders.length ?? "—")} detail="Human review required" icon={ClipboardCheck} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
        <Card><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">30-day unit velocity</h2><p className="mt-1 text-xs text-muted">Calculated from ingested daily sales records</p></div><Badge><ShieldCheck size={12} className="mr-1" />Rate-limited</Badge></CardHeader><CardContent><div className="h-64 w-full">
          {chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}><CartesianGrid vertical={false} stroke="#e7ebf0" /><XAxis dataKey="sku" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="velocity" name="Units/day" fill="#007185" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-sm text-muted">No inventory history ingested yet.</div>}
        </div></CardContent></Card>
        <Card><CardHeader><div><h2 className="text-sm font-semibold text-indigo-950">Execution guard</h2><p className="mt-1 text-xs text-muted">Control plane status</p></div></CardHeader><CardContent className="space-y-4 text-xs">
          <div className="flex items-start gap-3"><span className="mt-1 size-2 rounded-full bg-teal-700" /><div><strong>Redis/Celery queue</strong><p className="mt-1 text-muted">Tasks are dispatched from the PostgreSQL outbox.</p></div></div>
          <div className="flex items-start gap-3"><span className="mt-1 size-2 rounded-full bg-amber-500" /><div><strong>Amazon write mode</strong><p className="mt-1 text-muted">Requires server-side enablement and human approval.</p></div></div>
          <Link href={selectedSeller ? `/catalog?seller_id=${encodeURIComponent(selectedSeller)}` : "/catalog"} className="inline-flex items-center gap-2 pt-2 font-semibold text-teal-700 hover:underline"><PackageSearch size={15} />Open SEO workspace</Link>
        </CardContent></Card>
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
  </div>;
}