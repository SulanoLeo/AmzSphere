"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, RefreshCw, Search, User, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { clientProductProvider as provider } from "@/lib/provider/client";
import type { Dashboard, Seller } from "@/lib/provider/types";

const DEMO_USER = { email: "mock@amzsphere.local", name: "Demo Seller", role: "seller" };

function Header() {
  const pathname = usePathname();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [connectSellerOpen, setConnectSellerOpen] = useState(false);
  const [syncStatusOpen, setSyncStatusOpen] = useState(false);
  const [refreshStatusOpen, setRefreshStatusOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [alertsCount, setAlertsCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [sellerPayload, dashboardPayload] = await Promise.all([
          provider.getSellers(),
          provider.getDashboard(),
        ]);
        if (!active) return;
        setSellers(sellerPayload);
        setDashboard(dashboardPayload);
        setSelectedSeller(sellerPayload.length ? sellerPayload[0].id : "");
        setError("");
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Header data unavailable");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();

    let alertsActive = true;
    provider.getAlerts().then((alerts) => {
      if (alertsActive) setAlertsCount(alerts.length);
    });
    return () => { active = false; alertsActive = false; };
  }, []);

  const connected = dashboard?.sync_status === "completed";

  async function syncSeller() {
    setSyncMessage("");
    try {
      await provider.syncState();
      setSyncMessage("Seller sync queued.");
      setRefreshStatusOpen(false);
      setSyncStatusOpen(true);
      const refreshed = await provider.getDashboard();
      setDashboard(refreshed);
    } catch (cause) {
      setSyncMessage(cause instanceof Error ? cause.message : "Could not queue seller sync");
    }
  }

  async function refreshDashboard() {
    setRefreshMessage("");
    try {
      const refreshed = await provider.getDashboard();
      setDashboard(refreshed);
      setRefreshMessage("Dashboard refreshed from latest mock state.");
      setSyncStatusOpen(false);
      setRefreshStatusOpen(true);
    } catch (cause) {
      setRefreshMessage(cause instanceof Error ? cause.message : "Could not refresh dashboard");
    }
  }

  function isActiveRoute(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(href));
  }

  const soonLinks = [
    { label: "Orders", href: "/sales/orders" },
    { label: "Returns & Refunds", href: "/sales/returns" },
    { label: "Profit & Fees", href: "/finance/profit" },
    { label: "Account Health", href: "/compliance/health" },
    { label: "Tasks", href: "/ops/tasks" },
    { label: "Alerts", href: "/ops/alerts" },
    { label: "Integrations & Sync Status", href: "/admin/sync" },
    { label: "General Settings", href: "/admin/settings" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop:bg-white/80 backdrop:backdrop-blur-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-3">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold tracking-wide transition-colors", isActiveRoute("/") ? "bg-canvas text-indigo-950" : "text-muted hover:bg-canvas hover:text-indigo-950")}
          >
            <span className="text-[10px] font-bold text-indigo-950">AmzSphere</span>
          </Link>
        </div>

        {/* Center: account switcher + data freshness + actions */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full md:w-auto md:order-none">
          <div className="flex items-center gap-3 shrink-0">
            {/* Account switcher */}
            <div className="relative group">
              <Button
                variant="outline"
                className="px-2 py-1.5 text-[10px]"
                aria-haspopup="listbox"
                aria-expanded={false}
              >
                <User size={13} className="mr-1.5" aria-hidden="true" />
                {sellers.length
                  ? sellers.find((s) => s.id === selectedSeller)?.merchant_id || sellers[0]?.merchant_id
                  : "No seller"}
                <span className="ml-1 text-[9px] text-muted">▾</span>
              </Button>
              {sellers.length > 1 && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-line bg-white shadow-lg z-20">
                  {sellers.map((seller) => (
                    <button
                      key={seller.id}
                      role="option"
                      aria-selected={seller.id === selectedSeller}
                      onClick={() => setSelectedSeller(seller.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-left hover:bg-canvas transition-colors"
                    >
                      {seller.merchant_id}
                      <span className="ml-auto text-[9px] text-muted">{seller.marketplace_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Data freshness */}
            <div className="flex items-center gap-1 text-[10px] font-semibold">
              <Badge
                className={cn(
                  "text-xs px-2 py-1",
                  connected ? "bg-teal-50 text-teal-800 border-teal-200" : "bg-amber-50 text-amber-800 border-amber-200",
                )}
              >
                {connected
                  ? `Mock sync · ${dashboard?.last_synced_at ? new Date(dashboard.last_synced_at).toLocaleString() : "complete"}`
                  : "Sample data"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={syncSeller} disabled={loading || !selectedSeller} className="px-2 py-1.5 text-[10px]">
              <RefreshCw size={13} className="mr-1" aria-hidden="true" />
              Sync
            </Button>
            <Button variant="outline" onClick={refreshDashboard} disabled={loading} className="px-2 py-1.5 text-[10px]">
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setConnectSellerOpen(true)} className="px-2 py-1.5 text-[10px]">
              Sample data
            </Button>
          </div>
        </div>

        {/* Right: filters + search + alerts + user */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="SKU / ASIN"
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="w-24 h-8 rounded-md border border-line bg-white px-2 text-[10px] focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              aria-label="SKU or ASIN filter"
            />
          </div>
          <div className="relative">
            <input
              type="search"
              placeholder="Search catalog"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-32 h-8 rounded-md border border-line bg-white pl-9 pr-2 text-[10px] focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
              aria-label="Search catalog"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          </div>
          <Link
            href="/ops/alerts"
            aria-label="Alerts"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <Bell size={14} className="relative" aria-hidden="true" />
            {alertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white text-[9px] font-bold">
                {alertsCount}
              </span>
            )}
          </Link>
          <Button
            variant="outline"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            className="px-2 py-1.5 text-[10px] flex items-center gap-1.5"
          >
            <User size={13} className="mr-1" aria-hidden="true" />
            {DEMO_USER.name}
          </Button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-md border border-line bg-white shadow-lg z-20 py-1">
              <button
                role="menuitem"
                onClick={() => { setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-left hover:bg-canvas transition-colors"
              >
                {DEMO_USER.email}
              </button>
              <hr className="my-1 border-line" />
              <button
                role="menuitem"
                onClick={() => { setUserMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[10px] text-left hover:bg-canvas transition-colors text-rose-600"
              >
                <LogOut size={13} className="mr-1" aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-canvas/50 px-4 py-2 md:px-6 md:py-2">
        <div className="flex items-center justify-between gap-3 text-[9px] text-muted sm:flex-row sm:items-center">
          <span role="status" aria-live="polite" aria-atomic="true">
            {error ? <span className="text-rose-600">{error}</span> : loading ? "Loading header data…" : `Connected to ${dashboard?.marketplace_id || "mock"} marketplace · Sample data only`}
          </span>
          <div className="flex items-center gap-2 text-[9px]">
            <span>Changes use temporary mock state</span>
            <span>·</span>
            <span>No external services contacted</span>
          </div>
        </div>
      </div>

      <Modal open={connectSellerOpen} onClose={() => setConnectSellerOpen(false)} title="Load Mock Seller Data">
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-indigo-900 mb-1">Demo seller profile</div>
            <div className="text-[10px] text-muted mb-3">Use the bundled sample seller and catalog. No API credentials, seller account, or external service is contacted.</div>
          </div>
          <div className="p-3 rounded-md border border-line bg-amber-50">
            <div className="text-[10px] font-bold text-amber-800 mb-1">Mock workflow</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Load sample catalog and inventory records</li>
              <li>Review PPC and replenishment examples</li>
              <li>Try local purchase-order approval flows</li>
              <li>Data mutations remain process-local</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConnectSellerOpen(false)}>Cancel</Button>
            <Button onClick={() => { setConnectSellerOpen(false); void syncSeller(); }}>Load Sample Seller</Button>
          </div>
        </div>
      </Modal>

      <Modal open={syncStatusOpen} onClose={() => setSyncStatusOpen(false)} title="Sync Status">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Last sync</span>
            <span className="text-on-surface">{dashboard?.last_synced_at ? new Date(dashboard.last_synced_at).toISOString() : "No mock sync recorded"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Status</span>
            <span className="text-teal-700 font-semibold">{connected ? "Completed" : "Not synced"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Products synced</span>
            <span className="text-on-surface tabular-nums">{dashboard?.products.length ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Orders synced</span>
            <span className="text-on-surface tabular-nums">{dashboard?.pending_purchase_orders.length ?? 0}</span>
          </div>
          <div className="p-3 rounded-md border border-line bg-teal-50">
            <div className="text-[10px] font-bold text-teal-800 mb-1">What sync does</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Reads the bundled sample catalog and inventory</li>
              <li>Refreshes temporary mock records for this process</li>
              <li>Does not contact Amazon or persist changes across restarts</li>
            </ul>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setSyncStatusOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal open={refreshStatusOpen} onClose={() => setRefreshStatusOpen(false)} title="Refresh Dashboard">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Dashboard state</span>
            <span className="text-on-surface">Current mock state</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Dashboard data</span>
            <span className="text-teal-700 font-semibold">Current</span>
          </div>
          <div className="p-3 rounded-md border border-line bg-indigo-50">
            <div className="text-[10px] font-bold text-indigo-800 mb-1">What refresh does</div>
            <ul className="text-[10px] text-muted space-y-1 list-disc pl-4">
              <li>Recomputes all metric cards from latest data</li>
              <li>Refreshes velocity charts and procurement queue</li>
              <li>Updates ACoS trend and optimization scores</li>
            </ul>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setRefreshStatusOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

export default Header;
