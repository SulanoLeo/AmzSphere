export type PricingModel = "free" | "freemium" | "paid";

export type SeoToolCategory =
  | "Keyword Research"
  | "Listing Optimization"
  | "Rank Tracking"
  | "PPC/Advertising"
  | "Product Research"
  | "Review & Feedback"
  | "Analytics"
  | "Competitor Analysis";

export type Marketplace = "US" | "UK" | "DE" | "FR" | "IT" | "ES" | "JP" | "CA" | "MX" | "IN" | "BR" | "AE" | "SA";

export interface SeoToolFeature {
  id: string;
  label: string;
}

export interface SeoTool {
  id: string;
  name: string;
  logo: string;
  short_description: string;
  category: SeoToolCategory;
  pricing_model: PricingModel;
  starting_price_usd: number | null;
  features: SeoToolFeature[];
  marketplaces: Marketplace[];
  rating: number | null;
  website_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeoToolFilters {
  search?: string;
  category?: SeoToolCategory | null;
  pricing_model?: PricingModel | null;
  marketplace?: Marketplace | null;
  min_rating?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  sort?: "relevance" | "rating" | "price_asc" | "price_desc" | "name";
  page?: number;
  page_size?: number;
}

export interface SeoToolPage {
  tools: SeoTool[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserSelection {
  tool_id: string;
  added_at: string;
}

export interface SelectionState {
  selected_tool_ids: string[];
  updated_at: string;
}

const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  US: "United States",
  UK: "United Kingdom",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  JP: "Japan",
  CA: "Canada",
  MX: "Mexico",
  IN: "India",
  BR: "Brazil",
  AE: "UAE",
  SA: "Saudi Arabia",
};

const CATEGORY_ORDER: SeoToolCategory[] = [
  "Keyword Research",
  "Listing Optimization",
  "Rank Tracking",
  "PPC/Advertising",
  "Product Research",
  "Review & Feedback",
  "Analytics",
  "Competitor Analysis",
];

export function marketplaceLabel(code: Marketplace): string {
  return MARKETPLACE_LABELS[code] ?? code;
}

export function categoryOrder(category: SeoToolCategory): number {
  return CATEGORY_ORDER.indexOf(category);
}

export const SEED_TOOLS: SeoTool[] = [
  {
    id: "hl10",
    name: "Helium 10",
    logo: "https://placehold.co/64x64?text=H10",
    short_description: "All-in-one Amazon seller suite for keyword research, listing optimization, and operations.",
    category: "Keyword Research",
    pricing_model: "freemium",
    starting_price_usd: 39,
    features: [
      { id: "kresearch", label: "Keyword research" },
      { id: "listing", label: "Listing builder" },
      { id: "ppc", label: "PPC management" },
      { id: "inventory", label: "Inventory protection" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR", "AE", "SA"],
    rating: 4.6,
    website_url: "https://helium10.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "jungle-scout",
    name: "Jungle Scout",
    logo: "https://placehold.co/64x64?text=JS",
    short_description: "Product research and competitor intelligence for Amazon sellers.",
    category: "Product Research",
    pricing_model: "paid",
    starting_price_usd: 49,
    features: [
      { id: "opportunity", label: "Opportunity finder" },
      { id: "competitor", label: "Competitor tracking" },
      { id: "listing", label: "Listing builder" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR"],
    rating: 4.5,
    website_url: "https://junglescout.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "sellics",
    name: "Sellics",
    logo: "https://placehold.co/64x64?text=SELL",
    short_description: "PPC automation, profit tracking, and SEO toolkit for Amazon vendors.",
    category: "PPC/Advertising",
    pricing_model: "paid",
    starting_price_usd: 57,
    features: [
      { id: "ppc", label: "PPC optimization" },
      { id: "profit", label: "Profit dashboard" },
      { id: "seo", label: "SEO module" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA"],
    rating: 4.4,
    website_url: "https://sellics.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "merchantwords",
    name: "MerchantWords",
    logo: "https://placehold.co/64x64?text=MW",
    short_description: "Amazon search volume and keyword data across global marketplaces.",
    category: "Keyword Research",
    pricing_model: "paid",
    starting_price_usd: 30,
    features: [
      { id: "search-volume", label: "Search volume" },
      { id: "keyword", label: "Keyword research" },
      { id: "trends", label: "Trends" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR", "AE", "SA"],
    rating: 4.3,
    website_url: "https://merchantwords.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "zonguru",
    name: "ZonGuru",
    logo: "https://placehold.co/64x64?text=ZG",
    short_description: "Listing optimization, keyword tracking, and product research dashboard.",
    category: "Listing Optimization",
    pricing_model: "paid",
    starting_price_usd: 49,
    features: [
      { id: "listing", label: "Listing optimizer" },
      { id: "keywords", label: "Keyword tracker" },
      { id: "business", label: "Business reports" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN"],
    rating: 4.4,
    website_url: "https://zonguru.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "sellerapp",
    name: "SellerApp",
    logo: "https://placehold.co/64x64?text=SA",
    short_description: "AI-powered Amazon SEO, PPC, and listing performance analytics.",
    category: "Analytics",
    pricing_model: "freemium",
    starting_price_usd: 29,
    features: [
      { id: "seo", label: "SEO score" },
      { id: "ppc", label: "PPC automation" },
      { id: "analytics", label: "Sales analytics" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR"],
    rating: 4.2,
    website_url: "https://sellerapp.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "keepa",
    name: "Keepa",
    logo: "https://placehold.co/64x64?text=K",
    short_description: "Price history and rank tracking charts for Amazon products.",
    category: "Rank Tracking",
    pricing_model: "freemium",
    starting_price_usd: 19,
    features: [
      { id: "price-history", label: "Price history" },
      { id: "rank-tracking", label: "Rank tracking" },
      { id: "alerts", label: "Drop alerts" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR", "AE", "SA"],
    rating: 4.7,
    website_url: "https://keepa.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "amz-tracker",
    name: "AMZ Tracker",
    logo: "https://placehold.co/64x64?text=AT",
    short_description: "Keyword rank tracking and review management for Amazon listings.",
    category: "Rank Tracking",
    pricing_model: "paid",
    starting_price_usd: 49,
    features: [
      { id: "rank", label: "Keyword rank tracking" },
      { id: "review", label: "Review management" },
      { id: "competitor", label: "Competitor spy" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA"],
    rating: 4.1,
    website_url: "https://amztracker.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "feedbackgenius",
    name: "Feedback Genius",
    logo: "https://placehold.co/64x64?text=FG",
    short_description: "Automated feedback and review request emails for Amazon orders.",
    category: "Review & Feedback",
    pricing_model: "paid",
    starting_price_usd: 20,
    features: [
      { id: "feedback", label: "Feedback requests" },
      { id: "review", label: "Review monitoring" },
      { id: "automation", label: "Email automation" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX", "IN", "BR"],
    rating: 4.3,
    website_url: "https://feedbackgenius.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "amicable",
    name: "Amicality",
    logo: "https://placehold.co/64x64?text=AM",
    short_description: "Competitor price monitoring and buy box analysis dashboard.",
    category: "Competitor Analysis",
    pricing_model: "freemium",
    starting_price_usd: 29,
    features: [
      { id: "monitor", label: "Price monitoring" },
      { id: "buybox", label: "Buy box tracking" },
      { id: "alerts", label: "Competitor alerts" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES"],
    rating: 4.0,
    website_url: "https://placehold.co/sample",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "viralaunch",
    name: "Viral Launch",
    logo: "https://placehold.co/64x64?text=VL",
    short_description: "Product discovery, keyword research, and listing intelligence platform.",
    category: "Product Research",
    pricing_model: "paid",
    starting_price_usd: 59,
    features: [
      { id: "discovery", label: "Product discovery" },
      { id: "keywords", label: "Keyword research" },
      { id: "listing", label: "Listing intelligence" },
    ],
    marketplaces: ["US", "UK", "DE", "FR", "IT", "ES", "JP", "CA", "MX"],
    rating: 4.4,
    website_url: "https://virallaunch.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "scope",
    name: "Scope",
    logo: "https://placehold.co/64x64?text=SC",
    short_description: "Browser extension for Amazon keyword and competitor research on the go.",
    category: "Keyword Research",
    pricing_model: "free",
    starting_price_usd: 0,
    features: [
      { id: "extension", label: "Chrome extension" },
      { id: "keywords", label: "Keyword lookup" },
      { id: "competitor", label: "Competitor ASIN data" },
    ],
    marketplaces: ["US", "UK", "DE"],
    rating: 4.1,
    website_url: "https://sellerlabs.com",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const SELECTION_STORAGE_KEY = "amzsphere_seo_selection";

export function loadSelectionFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SelectionState;
    return Array.isArray(parsed.selected_tool_ids) ? parsed.selected_tool_ids : [];
  } catch {
    return [];
  }
}

export function saveSelectionToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  const state: SelectionState = { selected_tool_ids: ids, updated_at: new Date().toISOString() };
  window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(state));
}

export function clearSelectionFromStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SELECTION_STORAGE_KEY);
}

export function filterAndSortTools(
  tools: SeoTool[],
  filters: SeoToolFilters,
): { tools: SeoTool[]; total: number } {
  let result = tools.filter((t) => t.is_active);

  if (filters.search) {
    const needle = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.short_description.toLowerCase().includes(needle) ||
        t.features.some((f) => f.label.toLowerCase().includes(needle)),
    );
  }
  if (filters.category) {
    result = result.filter((t) => t.category === filters.category);
  }
  if (filters.pricing_model) {
    result = result.filter((t) => t.pricing_model === filters.pricing_model);
  }
  if (filters.marketplace) {
    result = result.filter((t) => t.marketplaces.includes(filters.marketplace!));
  }
  if (filters.min_rating != null) {
    result = result.filter((t) => t.rating != null && t.rating >= filters.min_rating!);
  }
  if (filters.min_price != null) {
    result = result.filter((t) => t.starting_price_usd != null && t.starting_price_usd >= filters.min_price!);
  }
  if (filters.max_price != null) {
    result = result.filter((t) => t.starting_price_usd != null && t.starting_price_usd <= filters.max_price!);
  }

  const total = result.length;

  const sort = filters.sort || "relevance";
  if (sort === "rating") {
    result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else   if (sort === "price_asc") {
    result.sort((a, b) => (a.starting_price_usd ?? 0) - (b.starting_price_usd ?? 0));
  } else if (sort === "price_desc") {
    result.sort((a, b) => (b.starting_price_usd ?? 0) - (a.starting_price_usd ?? 0));
  } else if (sort === "name") {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    result.sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name));
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, filters.page_size ?? 12));
  const start = (page - 1) * pageSize;
  const pageTools = result.slice(start, start + pageSize);

  return { tools: pageTools, total };
}

export function getToolById(id: string): SeoTool | undefined {
  return SEED_TOOLS.find((t) => t.id === id);
}

export function getAllCategories(): SeoToolCategory[] {
  return [...CATEGORY_ORDER];
}

export function getAllMarketplaces(): Marketplace[] {
  return Object.keys(MARKETPLACE_LABELS) as Marketplace[];
}

export function getPricingModels(): PricingModel[] {
  return ["free", "freemium", "paid"];
}

export function computeMonthlyCost(tools: SeoTool[]): number {
  return tools.reduce((sum, t) => sum + (t.starting_price_usd ?? 0), 0);
}

export function findTool(id: string): SeoTool | undefined {
  return SEED_TOOLS.find((t) => t.id === id);
}

export function isToolSelected(id: string, selected: string[]): boolean {
  return selected.includes(id);
}
