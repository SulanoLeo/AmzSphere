"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Activity, PackageSearch, ChartNoAxesCombined, Boxes, Store, CircleDollarSign, FileText, ClipboardCheck, HelpCircle } from "lucide-react";

const navigation = [
  { label: "Overview", href: "/", Icon: Activity },
  { label: "SEO & Catalog", href: "/catalog", Icon: PackageSearch },
  { label: "PPC Ads Engine", href: "/ppc", Icon: ChartNoAxesCombined },
  { label: "Inventory Hub", href: "/inventory", Icon: Boxes },
  { label: "Seller Store", href: "/seller-store", Icon: Store },
  { label: "Repricer Monitor", href: "/repricer", Icon: CircleDollarSign },
  { label: "Automation Activity Logs", href: "/activity", Icon: FileText },
  { label: "B2B Approvals", href: "/approvals", Icon: ClipboardCheck },
  { label: "How It Works", href: "/how", Icon: HelpCircle },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPath, setCurrentPath] = useState(typeof window !== "undefined" ? window.location.pathname : "/");

  return (
    <aside className={`flex flex-col bg-indigo-950 text-slate-200 transition-all duration-300 ${collapsed ? "w-16" : "w-64"} md:sticky md:top-0 md:h-screen`}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Toggle navigation"
        >
          <ChevronLeft size={16} />
        </button>
        <div className={`flex-1 min-w-0 transition-opacity duration-300 ${collapsed ? "opacity-0" : "opacity-100"}`}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-amber-400 font-bold text-indigo-950">A</span>
            <div className="min-w-0">
              <strong className="block text-sm text-white truncate">AmzSphere</strong>
              <small className="text-[10px] uppercase tracking-widest text-slate-400 truncate">Operations</small>
            </div>
          </Link>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label="Main navigation">
        <p className={`mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${collapsed ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}>Workspace</p>
        {navigation.map((item) => {
          const Icon = item.Icon;
          const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setCurrentPath(item.href)}
              className={`flex min-h-10 shrink-0 items-center gap-3 rounded-md px-3 text-xs font-medium transition-colors ${isActive ? "bg-indigo-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"} ${collapsed ? "justify-center px-2" : ""}`}
            >
              <Icon size={16} aria-hidden="true" />
              {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`border-t border-slate-700 pt-4 px-4 text-xs text-slate-400 transition-opacity duration-300 ${collapsed ? "opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-2 text-white mb-2">
          <span className="size-2 rounded-full bg-amber-400" />
          Production integration gated
        </div>
        <p className="leading-5">Writes stay disabled until SP-API is enabled and dry-run is off.</p>
      </div>
    </aside>
  );
}
