import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar, getVisibleNavGroups } from "@/components/Sidebar";
import { navGroups } from "@/src/config/nav";
import { usePathname } from "next/navigation";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    [key: string]: unknown;
  }) => createElement("a", { ...props, href }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

const mockedUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  mockedUsePathname.mockReturnValue("/");
});

describe("Sidebar", () => {
  it("renders all target groups in config order and leaves Admin & Settings at the end", () => {
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    const groupNames = within(navigation)
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(groupNames).toEqual([
      "Dashboard",
      "Sales & Orders",
      "Catalog",
      "Supply Chain",
      "Marketing",
      "Finance",
      "Compliance",
      "Operations",
      "Admin & Settings",
    ]);
  });

  it("uses canonical destinations and never exposes the admin SEO tools route", () => {
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    const expectedLinks = {
      "Products / Listings": "/catalog/products",
      "Listing Optimization / SEO": "/catalog/seo",
      Tools: "/catalog/seo/tools",
      "Buyer Preview": "/catalog/seo/preview",
      Pricing: "/catalog/pricing",
      Inventory: "/supply/inventory",
      Replenishment: "/supply/replenishment",
      "Purchasing & Suppliers": "/supply/purchasing",
      "Advertising / PPC": "/marketing/ppc",
      "Audit Log": "/admin/audit",
      "Help / Onboarding": "/admin/help",
    };

    for (const [label, href] of Object.entries(expectedLinks)) {
      expect(within(navigation).getByRole("link", { name: new RegExp(label) }).getAttribute("href")).toBe(href);
    }

    expect(navigation.querySelector('a[href="/admin/seo-tools"]')).toBeNull();
  });

  it("nests canonical SEO destinations under the Listing Optimization route", () => {
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    const seoLink = within(navigation).getByRole("link", { name: "Listing Optimization / SEO" });
    const seoSection = seoLink.closest("li");

    expect(seoSection).toBeTruthy();
    expect(seoLink.getAttribute("href")).toBe("/catalog/seo");
    expect(within(seoSection as HTMLElement).getByRole("link", { name: "Tools" }).getAttribute("href")).toBe(
      "/catalog/seo/tools",
    );
    expect(
      within(seoSection as HTMLElement).getByRole("link", { name: "Buyer Preview" }).getAttribute("href"),
    ).toBe("/catalog/seo/preview");
  });

  it("marks soon entries and omits hidden entries and empty groups", () => {
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).getByRole("link", { name: /Orders.*Coming soon/ })).toBeTruthy();
    expect(within(navigation).getByRole("link", { name: /Profit & Fees.*Coming soon/ })).toBeTruthy();

    const filtered = getVisibleNavGroups([
      { ...navGroups[0], items: [{ ...navGroups[0].items[0], status: "hidden" }] },
    ]);
    expect(filtered).toEqual([]);
  });

  it("marks only the exact canonical nested SEO destination as current", () => {
    mockedUsePathname.mockReturnValue("/catalog/seo/preview");
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(navigation).getByRole("link", { name: "Buyer Preview" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(within(navigation).getByRole("link", { name: "Tools" }).hasAttribute("aria-current")).toBe(false);
    expect(
      within(navigation).getByRole("link", { name: "Listing Optimization / SEO" }).hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("marks only the exact active destination as the current page", () => {
    mockedUsePathname.mockReturnValue("/catalog/products");
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).getByRole("link", { name: "Products / Listings" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      within(navigation).getByRole("link", { name: "Listing Optimization / SEO" }).hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("marks the SEO parent current only on its canonical route", () => {
    mockedUsePathname.mockReturnValue("/catalog/seo");
    render(<Sidebar />);

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(navigation).getByRole("link", { name: "Listing Optimization / SEO" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(within(navigation).getByRole("link", { name: "Tools" }).hasAttribute("aria-current")).toBe(false);
  });

  it("preserves accessible names and announces the collapse toggle state", () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Products / Listings" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /AmzSphere.*Operations/ })).toBeTruthy();
  });

  it("expands the sidebar when a link receives focus while collapsed", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));

    const toolsLink = screen.getByRole("link", { name: "Tools" });
    fireEvent.focus(toolsLink);

    expect(screen.getByRole("button", { name: "Collapse navigation" })).toBeTruthy();
    expect(toolsLink.querySelector("span")?.className).not.toContain("sr-only");
  });

  it("filters optional role- and demo-only items without a separate auth service", () => {
    const overview = navGroups[0].items[0];
    const group = {
      ...navGroups[0],
      items: [
        overview,
        { ...overview, label: "Role restricted", href: "/role", roles: ["operator"] },
        { ...overview, label: "Demo only", href: "/demo", demoOnly: true },
        { ...overview, label: "Hidden", href: "/hidden", status: "hidden" as const },
      ],
    };

    expect(getVisibleNavGroups([group], { roles: [], demoMode: false })[0].items.map((item) => item.label)).toEqual([
      "Overview",
    ]);
    expect(
      getVisibleNavGroups([group], { roles: ["operator"], demoMode: true })[0].items.map((item) => item.label),
    ).toEqual(["Overview", "Role restricted", "Demo only"]);
  });
});
