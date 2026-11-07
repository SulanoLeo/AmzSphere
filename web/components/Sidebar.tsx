"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Activity, PackageSearch, ChartNoAxesCombined, Boxes, Store, CircleDollarSign, FileText, ClipboardCheck, HelpCircle, SlidersHorizontal, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: "SEO Tool Selector", href: "/seo-tools", Icon: SlidersHorizontal },
  { label: "SEO Tool Admin", href: "/admin/seo-tools", Icon: Settings },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = usePathname();

  return (
    <aside className={`flex w-full shrink-0 flex-col border-b border-[#1F2937] bg-[#0B0F19] text-slate-300 transition-all duration-300 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r ${collapsed ? "md:w-[68px]" : "md:w-[240px]"}`}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1F2937]">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="hidden rounded-md p-2 text-slate-400 transition-colors hover:bg-[#111827] hover:text-white md:block"
          aria-label="Toggle navigation"
          aria-expanded={!collapsed}
        >
          <ChevronLeft size={16} />
        </button>
        <div className={`flex-1 min-w-0 transition-opacity duration-300 ${collapsed ? "opacity-0" : "opacity-100"}`}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-[#FFB95F] font-bold text-[#0B0F19]">A</span>
            <div className="min-w-0">
              <strong className="block text-sm text-white truncate">AmzSphere</strong>
              <small className="text-[10px] uppercase tracking-widest text-slate-400 truncate">Operations</small>
            </div>
          </Link>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:py-3" aria-label="Main navigation">
        <p className={`hidden mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 md:block ${collapsed ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}>Workspace</p>
        {navigation.map((item) => {
          const Icon = item.Icon;
          const isActive = currentPath === item.href || (item.href !== "/" && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors md:gap-3 ${isActive ? cn("bg-[#4338CA] text-white", collapsed ? "md:justify-center md:px-2" : "") : cn("text-slate-400 hover:bg-[#111827] hover:text-white", collapsed ? "md:justify-center md:px-2" : "")}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className={`min-w-0 truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={`hidden border-t border-[#1F2937] px-4 pt-4 text-xs text-slate-500 transition-opacity duration-300 md:block ${collapsed ? "opacity-0" : "opacity-100"}`}>
        <div className="flex items-center gap-2 text-white mb-2">
          <span className="size-2 rounded-full bg-[#FFB95F]" />
          Mock data only
        </div>
        <p className="leading-5">Actions are simulated and changes are temporary.</p>
      </div>
    </aside>
  );
}
