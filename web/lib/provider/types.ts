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
  seller_id: string;
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
  supplier_id: string | null;
  po_draft_id: string | null;
  parent_asin: string | null;
  variation_theme: string | null;
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
  seller_id?: string;
}

export interface PurchaseOrder {
  id: string;
  product_asin: string;
  product_name: string;
  supplier: string;
  units: number;
  status: string;
  created_at: string;
  seller_id: string;
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
  seller_id: string;
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

export interface ListingVersion {
  id: string;
  product_id: string;
  asin: string;
  snapshot: Record<string, unknown>;
  changed_by: string;
  change_summary: string[];
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
  price: number;
  unit_cost: number;
  parent_asin: string | null;
  variation_theme: string | null;
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
  profitability: {
    revenue: number;
    fees: number;
    net_profit: number;
    margin_pct: number;
  };
  sales_velocity: {
    units_7d: number;
    units_30d: number;
    units_90d: number;
  };
  variation_groups: number;
}

export interface Review {
  id: string;
  seller_id: string;
  product: string;
  asin: string;
  marketplace_id: string;
  rating: number;
  date: string;
  theme: string;
  text: string;
  customer_name: string | null;
  verified_purchase: boolean;
  response: string | null;
  responded_at: string | null;
}

export interface ReviewTheme {
  label: string;
  summary: string;
  fix: string;
}

export interface ReturnRequest {
  id: string;
  seller_id: string;
  order_id: string;
  asin: string;
  sku: string;
  customer_name: string | null;
  reason: string;
  status: "requested" | "approved" | "denied" | "received" | "refunded" | "rejected";
  requested_at: string;
  resolved_at: string | null;
  refund_amount: number;
  units: number;
}

export interface Promotion {
  id: string;
  seller_id: string;
  name: string;
  type: "percentage_off" | "fixed_amount_off" | "buy_one_get_one" | "coupon";
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "paused" | "expired";
  redemption_count: number;
  asin_list: string[];
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  seller_id: string;
  code: string;
  asin: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  min_purchase: number;
  max_redemptions: number | null;
  redeemed_count: number;
  start_date: string;
  end_date: string;
  status: "draft" | "active" | "paused" | "expired";
  created_at: string;
  updated_at: string;
}

export interface AIRecommendation {
  id: string;
  seller_id: string;
  type: "pricing" | "inventory" | "seo" | "ppc" | "profitability" | "compliance";
  title: string;
  description: string;
  rationale: string;
  confidence: number;
  impact: "low" | "medium" | "high";
  estimated_monthly_lift_usd: number | null;
  asin: string | null;
  sku: string | null;
  status: "new" | "reviewed" | "applied" | "dismissed";
  source: "simulated" | "openai" | "anthropic";
  model: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface AIConversation {
  id: string;
  seller_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface AutomationRule {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  type: "price_repricing" | "inventory_restock" | "listing_optimization" | "ad_bid_adjustment" | "review_response" | "custom";
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  schedule_cron: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecution {
  id: string;
  rule_id: string;
  seller_id: string;
  status: "queued" | "running" | "completed" | "failed" | "needs_review";
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  result_summary: string | null;
  error: string | null;
}

export interface Notification {
  id: string;
  seller_id: string;
  type: "info" | "warning" | "error" | "success" | "approval_required";
  title: string;
  message: string;
  read: boolean;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  seller_id: string;
  type: "low_stock" | "suppressed_listing" | "high_acos" | "price_change" | "review_negative" | "custom";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  seller_id: string;
  name: string;
  type: "sales" | "profitability" | "inventory" | "ads" | "custom";
  period_start: string;
  period_end: string;
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
  record_count: number;
  error: string | null;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  seller_id: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  error: string | null;
}

export interface Export {
  id: string;
  seller_id: string;
  report_id: string | null;
  format: "csv" | "xlsx" | "pdf";
  status: "queued" | "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  download_url: string | null;
  record_count: number;
  error: string | null;
}

export interface Forecast {
  id: string;
  seller_id: string;
  name: string;
  type: "sales" | "inventory" | "revenue";
  horizon_days: number;
  period_start: string;
  period_end: string;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ForecastPoint {
  id: string;
  forecast_id: string;
  date: string;
  value: number;
  lower_bound: number | null;
  upper_bound: number | null;
}

export interface ForecastScenario {
  id: string;
  forecast_id: string;
  name: string;
  growth_rate_pct: number;
  description: string | null;
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

export interface Keyword {
  id: string;
  seller_id: string;
  keyword: string;
  marketplace_id: string;
  search_volume: number;
  difficulty: number;
  cpc: number;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeywordRankHistory {
  id: string;
  seller_id: string;
  keyword_id: string;
  asin: string;
  marketplace_id: string;
  rank: number;
  rank_date: string;
  created_at: string;
}

export interface User {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "member" | "approver";
  is_active: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "professional" | "enterprise";
  created_at: string;
}

export interface SellerAccount {
  id: string;
  organization_id: string;
  merchant_id: string;
  marketplace_id: string;
  region: string;
  sp_api_connected: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  seller_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  lead_time_days: number;
  min_order_qty: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandedCost {
  id: string;
  product_id: string;
  asin: string;
  unit_cost: number;
  shipping_per_unit: number;
  duty_per_unit: number;
  freight_per_unit: number;
  other_per_unit: number;
  total_landed_cost: number;
  currency: string;
  updated_by: string;
  updated_at: string;
}

export interface CompetitorProduct {
  id: string;
  seller_id: string;
  asin: string;
  title: string;
  brand: string | null;
  price: number;
  marketplace_id: string;
  category: string | null;
  buy_box_winner: boolean;
  rating: number | null;
  review_count: number;
  in_stock: boolean;
  observed_at: string;
  created_at: string;
}

export interface CompetitorObservation {
  id: string;
  seller_id: string;
  product_asin: string;
  competitor_asin: string;
  competitor_price: number;
  price_gap: number;
  buy_box_eligible: boolean;
  observed_at: string;
  created_at: string;
}

export interface FeaturedOffer {
  id: string;
  seller_id: string;
  asin: string;
  is_buy_box_winner: boolean;
  offer_price: number;
  lowest_price: number;
  shipping_cost: number;
  prime_eligible: boolean;
  fulfilled_by_amazon: boolean;
  observed_at: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  organization_id: string;
  seller_id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  created_at: string;
  ip?: string;
}

export interface SyncJob {
  id: string;
  organization_id: string;
  seller_id: string;
  type: "catalog" | "inventory" | "orders" | "pricing" | "ads";
  status: "queued" | "running" | "succeeded" | "failed" | "needs_review";
  started_at: string;
  completed_at: string | null;
  records_processed: number;
  error?: string;
}

export interface FinancialRecord {
  id: string;
  seller_id: string;
  period_start: string;
  period_end: string;
  revenue: number;
  cogs: number;
  fees: number;
  net_profit: number;
  units_sold: number;
  orders_count: number;
  created_at: string;
}

export interface ProfitabilitySummary {
  period_start: string;
  period_end: string;
  revenue: number;
  cogs: number;
  fees: number;
  net_profit: number;
  margin_pct: number;
  units_sold: number;
  orders_count: number;
  by_category: Array<{ category: string; revenue: number; net_profit: number; units_sold: number }>;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
  price_usd_cents: number;
  currency: string;
  interval: "month" | "year";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  invoice_number: string;
  status: "draft" | "open" | "paid" | "void" | "uncollectible";
  amount_usd_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  organization_id: string;
  type: "card" | "bank_account";
  last4: string | null;
  brand: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean;
  created_at: string;
}

export interface BillingAddress {
  id: string;
  organization_id: string;
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "billing_manager";
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingPlan {
  id: string;
  plan: "starter" | "professional" | "enterprise";
  name: string;
  description: string | null;
  price_usd_cents: number;
  currency: string;
  interval: "month" | "year";
  max_sellers: number;
  max_marketplaces: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
