import { z } from "zod";

export const asinSchema = z.string().regex(/^[A-Z0-9]{10}$/, "ASIN must be a 10-character alphanumeric code.");

export const sellerIdSchema = z.string().min(1, "seller_id is required.");

export const productCreateSchema = z.object({
  asin: asinSchema,
  sku: z.string().min(1, "SKU is required.").max(80),
  marketplace_id: z.string().min(1).default("ATVPDKIKX0DER"),
  source: z.enum(["amazon_sync", "manual"]).default("manual"),
  name: z.string().min(1, "Product name is required.").max(200),
  title: z.string().min(1, "Listing title is required.").max(500),
  category: z.string().min(1).max(100).default("General"),
  price: z.coerce.number().nonnegative("Price must be non-negative.").default(0),
  stock: z.coerce.number().nonnegative("Stock must be non-negative.").default(0),
  daily_velocity: z.coerce.number().nonnegative("Velocity must be non-negative.").default(0),
  competitor_price: z.coerce.number().nonnegative().default(0),
  market_price: z.coerce.number().nonnegative().default(0),
  min_floor: z.coerce.number().nonnegative().default(0),
  max_price: z.coerce.number().nonnegative().default(0),
  unit_cost: z.coerce.number().nonnegative().default(0),
  lead_time_days: z.coerce.number().int().nonnegative().default(21),
  supplier: z.string().max(200).default(""),
  parent_asin: z.string().max(20).nullable().optional(),
  variation_theme: z.enum(["size", "color", "style", "flavor", "pack"]).nullable().optional(),
  backend_keywords: z.array(z.string()).default([]),
  bullets: z.array(z.string()).default([]),
  description: z.string().default(""),
  images: z.array(z.string().url()).default([]),
});

export const productPatchSchema = z.object({
  asin: asinSchema.optional(),
  sku: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(500).optional(),
  category: z.string().min(1).max(100).optional(),
  price: z.coerce.number().nonnegative().optional(),
  stock: z.coerce.number().nonnegative().optional(),
  daily_velocity: z.coerce.number().nonnegative().optional(),
  competitor_price: z.coerce.number().nonnegative().optional(),
  market_price: z.coerce.number().nonnegative().optional(),
  min_floor: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  unit_cost: z.coerce.number().nonnegative().optional(),
  lead_time_days: z.coerce.number().int().nonnegative().optional(),
  supplier: z.string().max(200).optional(),
  parent_asin: z.string().max(20).nullable().optional(),
  variation_theme: z.enum(["size", "color", "style", "flavor", "pack"]).nullable().optional(),
  backend_keywords: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  description: z.string().optional(),
  images: z.array(z.string().url()).optional(),
  suppressed: z.boolean().optional(),
  sync_status: z.string().optional(),
});

export const purchaseOrderDecisionSchema = z.object({
  action: z.enum(["approve", "deny"]),
});

export const catalogOptimizeSchema = z.object({
  asin: asinSchema,
  sku: z.string().max(80).optional(),
  seller_id: sellerIdSchema,
  optimization_mode: z.enum(["free", "paid"]).default("free"),
  helium10_api_key: z.string().max(500).optional(),
});

export const sellerSyncSchema = z.object({
  seller_id: sellerIdSchema,
});

export const inventoryScanSchema = z.object({
  seller_id: sellerIdSchema,
});

export const revisionActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const financialRecordsSchema = z.object({
  period_start: z.string().min(1, "period_start is required."),
  period_end: z.string().min(1, "period_end is required."),
  revenue: z.coerce.number().nonnegative("revenue must be non-negative.").default(0),
  cogs: z.coerce.number().nonnegative("cogs must be non-negative.").default(0),
  fees: z.coerce.number().nonnegative("fees must be non-negative.").default(0),
  net_profit: z.coerce.number().default(0),
  units_sold: z.coerce.number().int().nonnegative("units_sold must be non-negative.").default(0),
  orders_count: z.coerce.number().int().nonnegative("orders_count must be non-negative.").default(0),
});

export const keywordCreateSchema = z.object({
  keyword: z.string().min(1, "keyword is required.").max(200),
  marketplace_id: z.string().min(1).default("ATVPDKIKX0DER"),
  search_volume: z.coerce.number().int().nonnegative("search_volume must be non-negative.").default(0),
  difficulty: z.coerce.number().int().min(0).max(100).default(50),
  cpc: z.coerce.number().nonnegative("cpc must be non-negative.").default(0),
  category: z.string().max(100).nullable().optional(),
});

export const keywordRankSchema = z.object({
  keyword_id: z.string().min(1, "keyword_id is required."),
  asin: z.string().min(1, "asin is required.").max(20),
  rank: z.coerce.number().int().min(1, "rank must be >= 1.").max(500, "rank must be <= 500."),
});

export const supplierCreateSchema = z.object({
  name: z.string().min(1, "Supplier name is required.").max(200),
  contact_name: z.string().max(200).nullable().optional(),
  email: z.string().email("Invalid email.").max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  lead_time_days: z.coerce.number().int().nonnegative().default(21),
  min_order_qty: z.coerce.number().int().nonnegative().default(1),
  currency: z.string().length(3).default("USD"),
  is_active: z.boolean().default(true),
});

export const supplierPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contact_name: z.string().max(200).nullable().optional(),
  email: z.string().email("Invalid email.").max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  lead_time_days: z.coerce.number().int().nonnegative().optional(),
  min_order_qty: z.coerce.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  is_active: z.boolean().optional(),
});

export const landedCostSchema = z.object({
  unit_cost: z.coerce.number().nonnegative("unit_cost must be non-negative.").default(0),
  shipping_per_unit: z.coerce.number().nonnegative().default(0),
  duty_per_unit: z.coerce.number().nonnegative().default(0),
  freight_per_unit: z.coerce.number().nonnegative().default(0),
  other_per_unit: z.coerce.number().nonnegative().default(0),
  currency: z.string().length(3).default("USD"),
});

export const competitorProductSchema = z.object({
  asin: z.string().min(1, "asin is required.").max(20),
  title: z.string().min(1, "title is required.").max(200),
  brand: z.string().max(100).nullable().optional(),
  price: z.coerce.number().nonnegative("price must be non-negative.").default(0),
  marketplace_id: z.string().min(1).default("ATVPDKIKX0DER"),
  category: z.string().max(100).nullable().optional(),
  buy_box_winner: z.boolean().default(false),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  review_count: z.coerce.number().int().nonnegative().default(0),
  in_stock: z.boolean().default(true),
});

export const competitorObservationSchema = z.object({
  product_asin: z.string().min(1, "product_asin is required.").max(20),
  competitor_asin: z.string().min(1, "competitor_asin is required.").max(20),
  competitor_price: z.coerce.number().nonnegative("competitor_price must be non-negative."),
});

export const featuredOfferSchema = z.object({
  is_buy_box_winner: z.boolean().default(false),
  offer_price: z.coerce.number().nonnegative("offer_price must be non-negative."),
  lowest_price: z.coerce.number().nonnegative("lowest_price must be non-negative."),
});

export const returnRequestUpdateSchema = z.object({
  status: z.enum(["requested", "approved", "denied", "received", "refunded", "rejected"]),
  refund_amount: z.coerce.number().nonnegative("refund_amount must be non-negative.").optional(),
  units: z.coerce.number().int().nonnegative("units must be non-negative.").optional(),
});

export const promotionCreateSchema = z.object({
  name: z.string().min(1, "Promotion name is required.").max(200),
  type: z.enum(["percentage_off", "fixed_amount_off", "buy_one_get_one", "coupon"]),
  discount_value: z.coerce.number().nonnegative("discount_value must be non-negative.").default(0),
  min_purchase: z.coerce.number().nonnegative("min_purchase must be non-negative.").default(0),
  max_discount: z.coerce.number().nonnegative("max_discount must be non-negative.").nullable().optional(),
  start_date: z.string().min(1, "start_date is required."),
  end_date: z.string().min(1, "end_date is required."),
  status: z.enum(["draft", "active", "paused", "expired"]).default("draft"),
  redemption_count: z.coerce.number().int().nonnegative().default(0),
  asin_list: z.array(z.string()).default([]),
});

export const promotionPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(["percentage_off", "fixed_amount_off", "buy_one_get_one", "coupon"]).optional(),
  discount_value: z.coerce.number().nonnegative().optional(),
  min_purchase: z.coerce.number().nonnegative().optional(),
  max_discount: z.coerce.number().nonnegative().nullable().optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "paused", "expired"]).optional(),
  redemption_count: z.coerce.number().int().nonnegative().optional(),
  asin_list: z.array(z.string()).optional(),
});

export const couponCreateSchema = z.object({
  code: z.string().min(1, "Coupon code is required.").max(50),
  asin: z.string().min(1, "ASIN is required.").max(20),
  discount_type: z.enum(["percentage", "fixed_amount"]),
  discount_value: z.coerce.number().nonnegative("discount_value must be non-negative.").default(0),
  min_purchase: z.coerce.number().nonnegative("min_purchase must be non-negative.").default(0),
  max_redemptions: z.coerce.number().int().nonnegative().nullable().optional(),
  start_date: z.string().min(1, "start_date is required."),
  end_date: z.string().min(1, "end_date is required."),
  status: z.enum(["draft", "active", "paused", "expired"]).default("draft"),
});

export const couponPatchSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  asin: z.string().min(1).max(20).optional(),
  discount_type: z.enum(["percentage", "fixed_amount"]).optional(),
  discount_value: z.coerce.number().nonnegative().optional(),
  min_purchase: z.coerce.number().nonnegative().optional(),
  max_redemptions: z.coerce.number().int().nonnegative().nullable().optional(),
  start_date: z.string().min(1).optional(),
  end_date: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "paused", "expired"]).optional(),
});

export const reportCreateSchema = z.object({
  name: z.string().min(1, "Report name is required.").max(200),
  type: z.enum(["sales", "profitability", "inventory", "ads", "custom"]),
  period_start: z.string().min(1, "period_start is required."),
  period_end: z.string().min(1, "period_end is required."),
});

export const exportCreateSchema = z.object({
  report_id: z.string().min(1, "report_id is required.").nullable().optional(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
});

export const forecastCreateSchema = z.object({
  name: z.string().min(1, "Forecast name is required.").max(200),
  type: z.enum(["sales", "inventory", "revenue"]),
  horizon_days: z.coerce.number().int().min(1).max(365).default(30),
  period_start: z.string().min(1, "period_start is required."),
  period_end: z.string().min(1, "period_end is required."),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;
export type CatalogOptimizeInput = z.infer<typeof catalogOptimizeSchema>;
export type FinancialRecordInput = z.infer<typeof financialRecordsSchema>;
export type KeywordCreateInput = z.infer<typeof keywordCreateSchema>;
export type KeywordRankInput = z.infer<typeof keywordRankSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierPatchInput = z.infer<typeof supplierPatchSchema>;
export type LandedCostInput = z.infer<typeof landedCostSchema>;
export type CompetitorProductInput = z.infer<typeof competitorProductSchema>;
export type CompetitorObservationInput = z.infer<typeof competitorObservationSchema>;
export type FeaturedOfferInput = z.infer<typeof featuredOfferSchema>;
export type ReturnRequestUpdateInput = z.infer<typeof returnRequestUpdateSchema>;
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;
export type PromotionPatchInput = z.infer<typeof promotionPatchSchema>;
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponPatchInput = z.infer<typeof couponPatchSchema>;
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ExportCreateInput = z.infer<typeof exportCreateSchema>;
export type ForecastCreateInput = z.infer<typeof forecastCreateSchema>;
export type AIRecommendationCreateInput = z.infer<typeof aiRecommendationCreateSchema>;
export type AIMessageCreateInput = z.infer<typeof aiMessageCreateSchema>;

export const aiRecommendationCreateSchema = z.object({
  type: z.enum(["pricing", "inventory", "seo", "ppc", "profitability", "compliance"]),
  title: z.string().min(1, "title is required.").max(200),
  description: z.string().min(1, "description is required.").max(1000),
  rationale: z.string().min(1, "rationale is required.").max(1000),
  confidence: z.coerce.number().min(0, "confidence must be >= 0.").max(1, "confidence must be <= 1.").default(0.5),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
  estimated_monthly_lift_usd: z.coerce.number().nonnegative().nullable().optional(),
  asin: z.string().min(1).max(20).nullable().optional(),
  sku: z.string().min(1).max(80).nullable().optional(),
  status: z.enum(["new", "reviewed", "applied", "dismissed"]).default("new"),
  source: z.enum(["simulated", "openai", "anthropic"]).default("simulated"),
  model: z.string().max(100).nullable().optional(),
});

export const aiRecommendationPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(1000).optional(),
  rationale: z.string().min(1).max(1000).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  impact: z.enum(["low", "medium", "high"]).optional(),
  estimated_monthly_lift_usd: z.coerce.number().nonnegative().nullable().optional(),
  asin: z.string().min(1).max(20).nullable().optional(),
  sku: z.string().min(1).max(80).nullable().optional(),
  status: z.enum(["new", "reviewed", "applied", "dismissed"]).optional(),
  source: z.enum(["simulated", "openai", "anthropic"]).optional(),
  model: z.string().max(100).nullable().optional(),
  reviewed_by: z.string().max(200).nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
});

export const aiMessageCreateSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "content is required.").max(5000),
});

export const automationRuleCreateSchema = z.object({
  name: z.string().min(1, "Rule name is required.").max(200),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(["price_repricing", "inventory_restock", "listing_optimization", "ad_bid_adjustment", "review_response", "custom"]),
  enabled: z.boolean().default(true),
  conditions: z.record(z.string(), z.unknown()).default({}),
  actions: z.record(z.string(), z.unknown()).default({}),
  schedule_cron: z.string().max(100).nullable().optional(),
});

export const automationRulePatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  type: z.enum(["price_repricing", "inventory_restock", "listing_optimization", "ad_bid_adjustment", "review_response", "custom"]).optional(),
  enabled: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  actions: z.record(z.string(), z.unknown()).optional(),
  schedule_cron: z.string().max(100).nullable().optional(),
});

export const organizationUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).optional(),
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
});

export const userUpdateSchema = z.object({
  email: z.string().email().max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  role: z.enum(["owner", "admin", "member", "approver", "billing_manager"]).optional(),
  is_active: z.boolean().optional(),
});

export const sellerAccountCreateSchema = z.object({
  organization_id: z.string().min(1),
  merchant_id: z.string().min(1).max(100),
  marketplace_id: z.string().min(1).max(100),
  region: z.string().min(1).max(50).default("us-east-1"),
  sp_api_connected: z.boolean().default(false),
});

export const sellerAccountUpdateSchema = z.object({
  merchant_id: z.string().min(1).max(100).optional(),
  marketplace_id: z.string().min(1).max(100).optional(),
  region: z.string().min(1).max(50).optional(),
  sp_api_connected: z.boolean().optional(),
});

export const subscriptionCreateSchema = z.object({
  organization_id: z.string().min(1),
  plan: z.enum(["starter", "professional", "enterprise"]),
  status: z.enum(["active", "past_due", "canceled", "trialing", "incomplete"]).default("trialing"),
  price_usd_cents: z.coerce.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  interval: z.enum(["month", "year"]).default("month"),
  current_period_start: z.string().min(1),
  current_period_end: z.string().min(1),
  cancel_at_period_end: z.boolean().default(false),
});

export const subscriptionUpdateSchema = z.object({
  plan: z.enum(["starter", "professional", "enterprise"]).optional(),
  status: z.enum(["active", "past_due", "canceled", "trialing", "incomplete"]).optional(),
  price_usd_cents: z.coerce.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  interval: z.enum(["month", "year"]).optional(),
  current_period_start: z.string().min(1).optional(),
  current_period_end: z.string().min(1).optional(),
  cancel_at_period_end: z.boolean().optional(),
});

export const invoiceUpdateSchema = z.object({
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
  paid_at: z.string().nullable().optional(),
});

export const paymentMethodCreateSchema = z.object({
  organization_id: z.string().min(1),
  type: z.enum(["card", "bank_account"]),
  last4: z.string().max(10).nullable().optional(),
  brand: z.string().max(50).nullable().optional(),
  expiry_month: z.coerce.number().int().min(1).max(12).nullable().optional(),
  expiry_year: z.coerce.number().int().nullable().optional(),
  is_default: z.boolean().default(false),
});

export const paymentMethodUpdateSchema = z.object({
  type: z.enum(["card", "bank_account"]).optional(),
  last4: z.string().max(10).nullable().optional(),
  brand: z.string().max(50).nullable().optional(),
  expiry_month: z.coerce.number().int().min(1).max(12).nullable().optional(),
  expiry_year: z.coerce.number().int().nullable().optional(),
  is_default: z.boolean().optional(),
});

export const billingAddressCreateSchema = z.object({
  organization_id: z.string().min(1),
  name: z.string().max(200).nullable().optional(),
  line1: z.string().max(200).nullable().optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(50).nullable().optional(),
  country: z.string().max(10).nullable().optional(),
});

export const billingAddressUpdateSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  line1: z.string().max(200).nullable().optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(50).nullable().optional(),
  country: z.string().max(10).nullable().optional(),
});

export const teamMembershipCreateSchema = z.object({
  organization_id: z.string().min(1),
  user_id: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "billing_manager"]).default("member"),
  invited_by: z.string().nullable().optional(),
  invited_at: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const teamMembershipUpdateSchema = z.object({
  role: z.enum(["owner", "admin", "member", "billing_manager"]).optional(),
  invited_by: z.string().nullable().optional(),
  invited_at: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type SellerAccountCreateInput = z.infer<typeof sellerAccountCreateSchema>;
export type SellerAccountUpdateInput = z.infer<typeof sellerAccountUpdateSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
export type PaymentMethodCreateInput = z.infer<typeof paymentMethodCreateSchema>;
export type PaymentMethodUpdateInput = z.infer<typeof paymentMethodUpdateSchema>;
export type BillingAddressCreateInput = z.infer<typeof billingAddressCreateSchema>;
export type BillingAddressUpdateInput = z.infer<typeof billingAddressUpdateSchema>;
export type TeamMembershipCreateInput = z.infer<typeof teamMembershipCreateSchema>;
export type TeamMembershipUpdateInput = z.infer<typeof teamMembershipUpdateSchema>;

export const seoToolCreateSchema = z.object({
  name: z.string().min(1, "Tool name is required.").max(200),
  short_description: z.string().max(500).default(""),
  category: z.string().min(1, "Category is required."),
  pricing_model: z.enum(["free", "freemium", "paid"]).default("freemium"),
  starting_price_usd: z.coerce.number().nonnegative("Price must be non-negative.").nullable().optional(),
  features: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).default([]),
  marketplaces: z.array(z.string()).default([]),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  website_url: z.string().url("Invalid website URL.").default(""),
  is_active: z.boolean().default(true),
});

export const seoToolPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  short_description: z.string().max(500).optional(),
  category: z.string().min(1).optional(),
  pricing_model: z.enum(["free", "freemium", "paid"]).optional(),
  starting_price_usd: z.coerce.number().nonnegative().nullable().optional(),
  features: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).optional(),
  marketplaces: z.array(z.string()).optional(),
  rating: z.coerce.number().min(0).max(5).nullable().optional(),
  website_url: z.string().url("Invalid website URL.").optional(),
  is_active: z.boolean().optional(),
});

export const seoCategoryPatchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});

export const selectionSaveSchema = z.object({
  selected_tool_ids: z.array(z.string()).default([]),
});

export type SeoToolCreateInput = z.infer<typeof seoToolCreateSchema>;
export type SeoToolPatchInput = z.infer<typeof seoToolPatchSchema>;
export type SeoCategoryPatchInput = z.infer<typeof seoCategoryPatchSchema>;
export type SelectionSaveInput = z.infer<typeof selectionSaveSchema>;
