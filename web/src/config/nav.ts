import {
  Activity,
  Bell,
  Boxes,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  HelpCircle,
  PackageSearch,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavStatus = "live" | "soon" | "hidden";

export type NavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
  status: NavStatus;
  roles?: readonly string[];
  demoOnly?: boolean;
  children?: readonly NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  Icon: LucideIcon;
  items: readonly NavItem[];
  pinned?: boolean;
};

// Canonical route destinations are kept here; legacy URLs redirect in next.config.mjs.
export const navGroups: readonly NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    Icon: Activity,
    items: [{ label: "Overview", href: "/", Icon: Activity, status: "live" }],
  },
  {
    id: "sales-orders",
    label: "Sales & Orders",
    Icon: ClipboardCheck,
    items: [
      { label: "Orders", href: "/sales/orders", Icon: ClipboardCheck, status: "soon" },
      { label: "Returns & Refunds", href: "/sales/returns", Icon: RotateCcw, status: "soon" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    Icon: PackageSearch,
    items: [
      { label: "Products / Listings", href: "/catalog/products", Icon: PackageSearch, status: "live" },
      {
        label: "Listing Optimization / SEO",
        href: "/catalog/seo",
        Icon: Search,
        status: "live",
        children: [
          { label: "Tools", href: "/catalog/seo/tools", Icon: SlidersHorizontal, status: "live" },
          { label: "Buyer Preview", href: "/catalog/seo/preview", Icon: Store, status: "live" },
        ],
      },
      { label: "Pricing", href: "/catalog/pricing", Icon: CircleDollarSign, status: "live" },
    ],
  },
  {
    id: "supply-chain",
    label: "Supply Chain",
    Icon: Boxes,
    items: [
      { label: "Inventory", href: "/supply/inventory", Icon: Boxes, status: "live" },
      { label: "Replenishment", href: "/supply/replenishment", Icon: PackageSearch, status: "live" },
      { label: "Purchasing & Suppliers", href: "/supply/purchasing", Icon: ClipboardCheck, status: "live" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    Icon: ChartNoAxesCombined,
    items: [{ label: "Advertising / PPC", href: "/marketing/ppc", Icon: ChartNoAxesCombined, status: "live" }],
  },
  {
    id: "finance",
    label: "Finance",
    Icon: CircleDollarSign,
    items: [{ label: "Profit & Fees", href: "/finance/profit", Icon: CircleDollarSign, status: "soon" }],
  },
  {
    id: "compliance",
    label: "Compliance",
    Icon: ShieldCheck,
    items: [{ label: "Account Health", href: "/compliance/health", Icon: ShieldCheck, status: "soon" }],
  },
  {
    id: "operations",
    label: "Operations",
    Icon: Bell,
    items: [
      { label: "Tasks", href: "/ops/tasks", Icon: ClipboardCheck, status: "soon" },
      { label: "Alerts", href: "/ops/alerts", Icon: Bell, status: "soon" },
    ],
  },
  {
    id: "admin-settings",
    label: "Admin & Settings",
    Icon: Settings,
    pinned: true,
    items: [
      { label: "Audit Log", href: "/admin/audit", Icon: FileText, status: "live" },
      { label: "Integrations & Sync Status", href: "/admin/sync", Icon: Settings, status: "soon" },
      { label: "General Settings", href: "/admin/settings", Icon: Settings, status: "soon" },
      { label: "Help / Onboarding", href: "/admin/help", Icon: HelpCircle, status: "live" },
    ],
  },
];
