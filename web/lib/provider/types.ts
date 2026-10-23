export interface OptimizationStatus {
  opt_score: number;
  opt_issues: string[];
  opt_status: string;
}

export interface Product {
  id: string;
  asin: string;
  sku: string;
  marketplace_id: string;
  source: string;
  name: string;
  title: string;
  category: string;
  price: number;
  bullets: string[];
  description: string;
  backend_keywords: string[];
  images: string[];
  sellable_units: number;
  stock: number;
  days_of_supply: number;
  daily_velocity: number;
  competitor_price: number;
  market_price: number;
  min_floor: number;
  max_price: number;
  unit_cost: number;
  lead_time_days: number;
  supplier: string;
  po_draft_id: string | null;
  suppressed: boolean;
  last_synced_at: string | null;
  sync_status: string;
  last_optimized_at: string | null;
  opt_score: number;
  opt_issues: string[];
  opt_status: string;
}

export interface ProductList {
  products: Product[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProductFilter {
  opt_status?: string;
  low_stock?: boolean;
  suppressed?: boolean;
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface PurchaseOrder {
  id: string;
  product_asin: string;
  product_name: string;
  supplier: string;
  units: number;
  status: string;
  created_at: string;
}

export interface Order {
  id: string;
  product_name: string;
  supplier: string;
  amount: number;
  units: number;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  asin: string;
  sku: string;
  base_acos: number;
  ad_share: number;
  avg_cpc: number;
  bid_floor: number;
  acos_modifier: number;
  bid_changes: Array<{ date: string; from: number; to: number; trailing_acos: number }>;
  ad_history: Array<{ spend: number; sales: number; clicks: number; orders: number }>;
  trailing_acos: number | null;
  last_guardrail_date?: string | null;
}

export interface SearchTerm {
  term: string;
  asin: string;
  campaign_id: string;
  clicks: number;
  spend: number;
  conversions: number;
  acos: number;
  sales?: number;
  impressions?: number;
  order_value?: number;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  detail: string;
}

export interface ProductRevision {
  id: string;
  product_id: string;
  asin?: string;
  field_changes: Record<string, { before: unknown; after: unknown }>;
  status: string;
  created_by: string;
  created_at: string;
}

export interface Seller {
  id: string;
  merchant_id: string;
  marketplace_id: string;
  region: string;
}

export interface SyncState {
  status: string;
  operation_id?: string;
  started_at?: string;
  completed_at?: string;
  products_synced?: number;
}

export interface SellerStoreItem {
  id: string;
  asin: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  visible: boolean;
  added_at: string | null;
}

export interface PpcData {
  campaigns: Campaign[];
  search_terms: SearchTerm[];
  targeted_exact_keywords: PpcKeyword[];
  negative_keywords: PpcKeyword[];
}

export interface PpcKeyword {
  term: string;
  added_at: string;
  source: string;
}

export interface DashboardProduct {
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
}

export interface Top10Item {
  asin: string;
  sku: string;
  name: string;
  opt_score: number;
  opt_status: string;
  impact: number;
  days_of_supply: number | null;
  sellable_units: number;
  opt_issues: string[];
}

export interface Dashboard {
  seller_id: string;
  marketplace_id: string;
  products: DashboardProduct[];
  pending_purchase_orders: Array<{
    id: string;
    vendor: string;
    status: string;
    currency: string;
    total_amount_minor: number;
    lines: Array<{ sku: string; asin: string; quantity: number }>;
  }>;
  sync_status: string | null;
  last_synced_at: string | null;
  needs_optimization_count: number;
  top_10_by_impact: Top10Item[];
}

export interface Review {
  id: string;
  product: string;
  rating: number;
  date: string;
  theme: string;
  text: string;
}

export interface ReviewTheme {
  label: string;
  summary: string;
  fix: string;
}

export interface CatalogProfile {
  asin: string;
  rank: number;
  gaps: string[];
  current_title: string;
  current_bullets: string[];
  optimized_title: string;
  optimized_bullets: string[];
}

export interface ExecutionQueueItem {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface Manager {
  name: string;
  role: string;
  initials: string;
}
