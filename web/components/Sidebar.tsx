"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { navGroups, type NavGroup, type NavItem } from "@/src/config/nav";
import { cn } from "@/lib/utils";

type SidebarProps = {
  roles?: readonly string[];
  demoMode?: boolean;
};

export function getVisibleNavGroups(
  groups: readonly NavGroup[],
  { roles = [], demoMode = true }: SidebarProps = {},
) {
  const filterVisibleItems = (items: readonly NavItem[]): NavItem[] =>
    items.flatMap((item) => {
      const isAllowed =
        (item.roles === undefined || item.roles.some((role) => roles.includes(role))) &&
        (!item.demoOnly || demoMode);
      if (!isAllowed) return [];

      const children = item.children ? filterVisibleItems(item.children) : undefined;
      const isVisible = item.status !== "hidden";
      if (!isVisible && !children?.length) return [];

      return [{ ...item, children }];
    });

  return groups.flatMap((group) => {
    const items = filterVisibleItems(group.items);

    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function NavigationItem({
  item,
  collapsed,
  currentPath,
  nested = false,
}: {
  item: NavItem;
  collapsed: boolean;
  currentPath: string;
  nested?: boolean;
}) {
  const Icon = item.Icon;
  const isActive = currentPath === item.href;

  return (
    <li>
      {item.status === "hidden" ? (
        <h3
          className={cn(
            "mb-1 flex min-h-8 items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500",
            nested && "pl-6 md:pl-7",
            collapsed && "md:sr-only",
          )}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{item.label}</span>
        </h3>
      ) : (
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB95F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19] md:gap-3",
            isActive ? "bg-[#4338CA] text-white" : "text-slate-400 hover:bg-[#111827] hover:text-white",
            nested && "pl-6 md:pl-7",
            collapsed && "md:justify-center md:px-2",
          )}
        >
          <Icon size={16} aria-hidden="true" />
          <span className={cn("min-w-0 truncate", collapsed && "md:sr-only")}>{item.label}</span>
          {item.status === "soon" && (
            <span className={cn("ml-auto shrink-0 text-[10px] text-slate-400", collapsed && "md:sr-only")}>
              Coming soon
            </span>
          )}
        </Link>
      )}
      {item.children && item.children.length > 0 && (
        <ul className="flex flex-col gap-1">
          {item.children.map((child) => (
            <NavigationItem
              key={child.href}
              item={child}
              collapsed={collapsed}
              currentPath={currentPath}
              nested
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function NavigationGroup({
  group,
  collapsed,
  currentPath,
  isExpanded,
  onToggleGroup,
}: {
  group: NavGroup;
  collapsed: boolean;
  currentPath: string;
  isExpanded?: boolean;
  onToggleGroup?: () => void;
}) {
  const GroupIcon = group.Icon;

  return (
    <div className="shrink-0">
      <button
        onClick={onToggleGroup}
        aria-expanded={isExpanded}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-1.5 mb-1 rounded-md text-left transition-colors hover:bg-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB95F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]",
          collapsed && "justify-between px-3",
        )}
      >
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          <GroupIcon size={12} aria-hidden="true" />
          <span className={cn(collapsed && "md:sr-only")}>{group.label}</span>
        </h2>
        {!collapsed && (
          <ChevronDown size={12} className={cn("ml-auto text-slate-500 transition-transform", !isExpanded && "rotate-90")} aria-hidden="true" />
        )}
      </button>
      {isExpanded !== false && (
        <ul className="flex flex-col gap-1">
          {group.items.map((item) => (
            <NavigationItem key={item.href} item={item} collapsed={collapsed} currentPath={currentPath} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function Sidebar({ roles, demoMode = true }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const currentPath = usePathname();
  const groups = getVisibleNavGroups(navGroups, { roles, demoMode });
  const workspaceGroups = groups.filter((group) => !group.pinned);
  const pinnedGroups = groups.filter((group) => group.pinned);

  const isGroupExpanded = (groupId: string) => {
    if (!(groupId in expandedGroups)) return true;
    return expandedGroups[groupId];
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !isGroupExpanded(groupId) }));
  };

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-b border-[#1F2937] bg-[#0B0F19] text-slate-300 transition-all duration-300 md:sticky md:top-0 md:h-screen md:border-b-0",
        collapsed ? "md:w-[68px]" : "md:w-[240px]",
      )}
    >
      <div className="flex items-center gap-3 border-b border-[#1F2937] px-4 py-4">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="hidden rounded-md p-2 text-slate-400 transition-colors hover:bg-[#111827] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB95F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19] md:block"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB95F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F19]">
          <span
            aria-hidden="true"
            className="font-bold text-[#0B0F19]"
          >
            A
          </span>
          <span className={cn("min-w-0", collapsed && "md:sr-only")}>
            <strong className="block truncate text-sm text-white">AmzSphere</strong>
            <small className="truncate text-[10px] uppercase tracking-widest text-slate-400">Operations</small>
          </span>
        </Link>
      </div>

      <nav
        aria-label="Main navigation"
        onFocusCapture={(event) => {
          if (collapsed && event.target instanceof HTMLAnchorElement) setCollapsed(false);
        }}
        className="flex min-w-0 flex-1 gap-3 overflow-x-auto px-3 py-2 md:min-h-0 md:flex-col md:gap-0 md:overflow-hidden md:py-3"
      >
        <div className="flex shrink-0 gap-3 md:min-h-0 md:flex-1 md:flex-col md:gap-3 md:overflow-x-hidden md:overflow-y-auto">
          {workspaceGroups.map((group) => (
            <NavigationGroup
              key={group.id}
              group={group}
              collapsed={collapsed}
              currentPath={currentPath}
              isExpanded={isGroupExpanded(group.id)}
              onToggleGroup={() => toggleGroup(group.id)}
            />
          ))}
        </div>
        {pinnedGroups.length > 0 && (
          <div className="flex shrink-0 gap-3 border-l border-[#1F2937] pl-3 md:flex-col md:gap-3 md:border-l-0 md:border-t md:pl-0 md:pt-3">
            {pinnedGroups.map((group) => (
              <NavigationGroup
                key={group.id}
                group={group}
                collapsed={collapsed}
                currentPath={currentPath}
                isExpanded={isGroupExpanded(group.id)}
                onToggleGroup={() => toggleGroup(group.id)}
              />
            ))}
          </div>
        )}
      </nav>

      <div
        className={cn(
          "hidden border-t border-[#1F2937] px-4 pt-4 text-xs text-slate-500 transition-opacity duration-300 md:block",
          collapsed && "md:sr-only",
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-white">
          <span aria-hidden="true" className="size-2 rounded-full" />
          Mock data only
        </div>
        <p className="leading-5">Actions are simulated and changes are temporary.</p>
      </div>
    </aside>
  );
}
