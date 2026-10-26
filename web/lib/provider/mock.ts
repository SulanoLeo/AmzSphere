import { readMockState, writeMockState, persistMockState } from "@/lib/mock-state";
import { computeOptScore } from "@/lib/scoring";
import type {
  Product,
  ProductList,
  ProductFilter,
  OptimizationStatus,
  PurchaseOrder,
  Order,
  Campaign,
  SearchTerm,
  ActivityItem,
  ProductRevision,
  ListingVersion,
  Seller,
  SyncState,
  Dashboard,
  SellerStoreItem,
  Review,
  ReviewTheme,
  CatalogProfile,
  ExecutionQueueItem,
  Manager,
  Organization,
  User,
  SellerAccount,
  AuditLogEntry,
  SyncJob,
  FinancialRecord,
  ProfitabilitySummary,
  Keyword,
  KeywordRankHistory,
  Supplier,
  LandedCost,
  CompetitorProduct,
  CompetitorObservation,
  FeaturedOffer,
  ReturnRequest,
  Promotion,
  Coupon,
  Report,
  ReportExecution,
  Export,
  Forecast,
  ForecastPoint,
  ForecastScenario,
  AIRecommendation,
  AIConversation,
  AIMessage,
  AutomationRule,
  AutomationExecution,
  Notification,
  Alert,
  Subscription,
  Invoice,
  PaymentMethod,
  BillingAddress,
  TeamMembership,
  BillingPlan,
} from "./types";
import { ProductProvider } from "./interface";

const US_MARKETPLACE_ID = "ATVPDKIKX0DER";
const DEFAULT_SELLER_ID = "mock-seller";

function productDefaults(product: any): any {
  product.id = product.id ?? crypto.randomUUID();
  product.marketplace_id = product.marketplace_id ?? US_MARKETPLACE_ID;
  product.source = product.source ?? "amazon_sync";
  product.title = product.title ?? product.name ?? "";
  product.bullets = product.bullets ?? [];
  product.description = product.description ?? "";
  product.backend_keywords = product.backend_keywords ?? [];
  product.images = product.images ?? [];
  product.sellable_units = product.sellable_units ?? product.stock ?? 0;
  product.days_of_supply = product.days_of_supply ?? 0;
  return product;
}

function normalizeState(state: any): any {
  (state.products || []).forEach((p: any) => productDefaults(p));
  state.global_products = state.global_products || [];
  if ((state.global_products || []).length !== (state.products || []).length) {
    state.global_products = (state.products || []).map((p: any) => ({ ...p }));
  }
  state.product_revisions = state.product_revisions || [];
  state.listing_versions = state.listing_versions || [];
  state.financial_records = state.financial_records || [];
  state.keywords = state.keywords || [];
  state.keyword_rank_history = state.keyword_rank_history || [];
  state.suppliers = state.suppliers || [];
  state.landed_costs = state.landed_costs || [];
  state.competitor_products = state.competitor_products || [];
  state.competitor_observations = state.competitor_observations || [];
  state.featured_offers = state.featured_offers || [];
  state.reviews = state.reviews || [];
  state.return_requests = state.return_requests || [];
  state.promotions = state.promotions || [];
  state.coupons = state.coupons || [];
  state.reports = state.reports || [];
  state.report_executions = state.report_executions || [];
  state.exports = state.exports || [];
  state.forecasts = state.forecasts || [];
  state.forecast_points = state.forecast_points || [];
  state.forecast_scenarios = state.forecast_scenarios || [];
  state.ai_recommendations = state.ai_recommendations || [];
  state.ai_conversations = state.ai_conversations || [];
  state.ai_messages = state.ai_messages || [];
  state.automation_rules = state.automation_rules || [];
  state.automation_executions = state.automation_executions || [];
  state.notifications = state.notifications || [];
  state.alerts = state.alerts || [];
  state.subscriptions = state.subscriptions || [];
  state.invoices = state.invoices || [];
  state.payment_methods = state.payment_methods || [];
  state.billing_addresses = state.billing_addresses || [];
  state.team_memberships = state.team_memberships || [];
  state.billing_plans = state.billing_plans || [];
  state.amazon_catalog = state.amazon_catalog || [];
  state.sync_state = state.sync_state || { status: "not_synced" };
  return state;
}

function findProduct(state: any, ref: string): any {
  return (state.products || []).find((p: any) => p.id === ref || p.asin === ref) ?? null;
}

function suppressedFor(state: any, product: any): boolean {
  if (product.suppressed) return true;
  return (state.marketplace_listings || []).some(
    (listing: any) =>
      listing.global_product_id === product.asin &&
      String(listing.status || "").toLowerCase() === "suppressed",
  );
}

function toDashboardProduct(p: any, salesHistory: Record<string, number[]>): any {
  const history: number[] = (salesHistory || {})[p.sku] || [];
  const velocity7d = history.slice(-7).reduce((sum, v) => sum + v, 0);
  const velocity30d = history.slice(-30).reduce((sum, v) => sum + v, 0);
  const velocity90d = history.slice(-90).reduce((sum, v) => sum + v, 0);
  const daysOfSupply = Number(p.days_of_supply) || 0;
  const optResult = computeOptScore(p);
  return {
    asin: p.asin,
    sku: p.sku,
    vendor: p.supplier || null,
    stock: Number(p.stock) || null,
    velocity_7d: velocity7d,
    velocity_30d: velocity30d,
    velocity_90d: velocity90d,
    days_supply: daysOfSupply || null,
    reorder_flag: daysOfSupply > 0 && daysOfSupply < 15,
    opt_score: optResult.score,
    opt_status: optResult.status,
    needs_optimization: optResult.status === "needs_optimization",
    price: Number(p.price) || 0,
    unit_cost: Number(p.unit_cost) || 0,
    parent_asin: p.parent_asin || null,
    variation_theme: p.variation_theme || null,
  };
}

function impactRank(product: any): number {
  const score = Number(product.opt_score) || 0;
  const history: number[] = ((product.sales_history as any) || []) as number[];
  const volume = history.length > 0 ? history.slice(-7).reduce((sum, v) => sum + v, 0) : (Number(product.daily_velocity) || 0) * 7;
  return (100 - score) * volume;
}

export class MockProvider implements ProductProvider {
  private activeSellerId: string | null = null;

  setActiveSeller(sellerId: string): void {
    this.activeSellerId = sellerId;
  }

  getActiveSeller(): string | null {
    return this.activeSellerId;
  }

  private requireActiveSeller(): string {
    if (!this.activeSellerId) {
      throw new Error("No active seller selected. Call setActiveSeller() first.");
    }
    return this.activeSellerId;
  }

  private scopeProductsBySeller(state: any): any[] {
    const sellerId = this.requireActiveSeller();
    return ((state.products || []) as any[]).filter(
      (p: any) => String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
    );
  }
  async getProducts(filter: ProductFilter = {}): Promise<ProductList> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const {
      opt_status,
      low_stock,
      suppressed,
      search,
      sort,
      page = 1,
      page_size = 50,
    } = filter;

    let products = this.scopeProductsBySeller(state);

    // Honor an explicit filter.seller_id only if it matches the active seller (no cross-tenant reads).
    if (filter.seller_id && String(filter.seller_id) !== sellerId) {
      return { products: [], total: 0, page, page_size, total_pages: 0 };
    }

    if (opt_status) {
      products = products.filter((p: any) => p.opt_status === opt_status);
    }
    if (low_stock) {
      products = products.filter((p: any) => Number(p.days_of_supply || 0) < 15);
    }
    if (suppressed) {
      products = products.filter((p: any) => suppressedFor(state, p));
    }
    if (search) {
      const needle = search.toLowerCase();
      products = products.filter(
        (p: any) =>
          `${p.name || ""} ${p.title || ""} ${p.asin || ""} ${p.sku || ""} ${p.category || ""}`
            .toLowerCase()
            .includes(needle),
      );
    }

    if (sort) {
      const reverse = sort.startsWith("-");
      const key = sort.replace(/^-/, "");
      products.sort((a: any, b: any) => {
        const av = a[key];
        const bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return reverse ? -1 : 1;
        if (bv == null) return reverse ? 1 : -1;
        const cmp =
          typeof av === "number" ? av - bv : String(av || "").toLowerCase().localeCompare(String(bv || "").toLowerCase());
        return reverse ? -cmp : cmp;
      });
    }

    const total = products.length;
    const totalPages = Math.max(1, Math.ceil(total / page_size));
    const start = (page - 1) * page_size;
    const pageProducts = products.slice(start, start + page_size);

    return { products: pageProducts, total, page, page_size, total_pages: totalPages };
  }

  async getProduct(id: string): Promise<Product | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, id);
    if (!product) {
      return null;
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      return null;
    }
    return product;
  }

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const newProduct = { ...product, id: crypto.randomUUID(), seller_id: sellerId } as any;
    productDefaults(newProduct);
    const salesHistory: Record<string, number[]> = state.sales_history || {};
    const velocity = Math.round(Number(newProduct.daily_velocity) || 10);
    salesHistory[newProduct.sku] = Array(30).fill(velocity);
    state.sales_history = salesHistory;
    (state.products || []).push(newProduct);
    (state.global_products || []).push({ ...newProduct });

    this.writeAuditLog(state, {
      action: "product_create",
      target_type: "product",
      target_id: newProduct.id,
      before: {},
      after: { asin: newProduct.asin, sku: newProduct.sku, name: newProduct.name },
    });

    writeMockState(state);
    return newProduct;
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${id}`);
    }
    const beforeSnapshot = structuredClone(product);
    Object.assign(product, patch);
    product.seller_id = sellerId;
    const optResult = computeOptScore(product);
    product.opt_score = optResult.score;
    product.opt_issues = optResult.issues;
    product.opt_status = optResult.status;
    product.last_optimized_at = new Date().toISOString();

    const changedFields = Object.keys(patch).filter((key) => JSON.stringify(beforeSnapshot[key]) !== JSON.stringify(product[key]));
    const changeSummary = changedFields.length ? [`Updated ${changedFields.join(", ")}`] : ["Product updated"];
    (state.listing_versions as any[]).unshift({
      id: crypto.randomUUID(),
      product_id: product.id,
      asin: product.asin,
      snapshot: beforeSnapshot,
      changed_by: "mock@amzsphere.local",
      change_summary: changeSummary,
      created_at: new Date().toISOString(),
    });
    if ((state.listing_versions as any[]).length > 200) {
      (state.listing_versions as any[]).length = 200;
    }

    this.writeAuditLog(state, {
      action: "product_update",
      target_type: "product",
      target_id: id,
      before: {},
      after: { opt_score: product.opt_score, opt_status: product.opt_status },
    });

    writeMockState(state);
    return product;
  }

  async getProductOptimization(id: string): Promise<OptimizationStatus> {
    const state = normalizeState(readMockState());
    const product = findProduct(state, id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }
    const result = computeOptScore(product);
    return { opt_score: result.score, opt_issues: result.issues, opt_status: result.status };
  }

  async getProductVariations(parentAsin: string): Promise<Product[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.products || [])
      .filter(
        (p: any) =>
          String(p.seller_id || DEFAULT_SELLER_ID) === sellerId &&
          String(p.parent_asin || "") === parentAsin,
      )
      .map((p: any) => ({
        ...p,
        seller_id: p.seller_id || DEFAULT_SELLER_ID,
      }));
  }

  async getListingVersions(productId: string): Promise<ListingVersion[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, productId);
    if (!product) {
      return [];
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      return [];
    }
    return (state.listing_versions || [])
      .filter((v: any) => String(v.product_id) === product.id)
      .map((v: any) => ({
        id: v.id,
        product_id: v.product_id,
        asin: v.asin,
        snapshot: v.snapshot,
        changed_by: v.changed_by,
        change_summary: v.change_summary,
        created_at: v.created_at,
      }));
  }

  async createListingVersion(
    productId: string,
    snapshot: Record<string, unknown>,
    changedBy: string,
    changeSummary: string[],
  ): Promise<ListingVersion> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, productId);
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${productId}`);
    }
    const version: ListingVersion = {
      id: crypto.randomUUID(),
      product_id: product.id,
      asin: product.asin,
      snapshot,
      changed_by: changedBy,
      change_summary: changeSummary,
      created_at: new Date().toISOString(),
    };
    (state.listing_versions as any[]).unshift(version);
    if ((state.listing_versions as any[]).length > 200) {
      (state.listing_versions as any[]).length = 200;
    }
    writeMockState(state);
    return version;
  }

  async getDashboard(): Promise<Dashboard> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const salesHistory: Record<string, number[]> = state.sales_history || {};

    const products = this.scopeProductsBySeller(state).map((p: any) => toDashboardProduct(p, salesHistory));
    const needsOptimizationCount = products.filter((p: any) => p.needs_optimization).length;

    const ranked = [...products].sort((a, b) => {
      const pa = state.products.find((sp: any) => sp.asin === a.asin) || a;
      const pb = state.products.find((sp: any) => sp.asin === b.asin) || b;
      return impactRank(pb) - impactRank(pa);
    });

    const top10 = ranked.slice(0, 10).map((p) => {
      const sp = state.products.find((s: any) => s.asin === p.asin) || p;
      return {
        asin: p.asin,
        sku: p.sku,
        name: sp.name || sp.title || "",
        opt_score: p.opt_score,
        opt_status: p.opt_status,
        impact: Math.round(impactRank(sp)),
        days_of_supply: p.days_supply,
        sellable_units: Number(sp.sellable_units) || Number(sp.stock) || 0,
        opt_issues: sp.opt_issues || [],
      };
    });

    const syncState = state.sync_state || { status: "not_synced" };
    const pendingPurchaseOrders = (state.purchase_orders || [])
      .filter((po: any) => po.status === "draft" || po.status === "pending")
      .map((po: any) => ({
        id: po.id,
        vendor: po.supplier || "Unknown Supplier",
        status: po.status,
        currency: "USD",
        total_amount_minor: Math.round((Number(po.units) || 0) * 100),
        lines: [{ sku: "", asin: po.product_asin || "", quantity: Number(po.units) || 0 }],
      }));

    const revenue = products.reduce((sum, p: any) => sum + (Number(p.velocity_30d || 0) * Number(p.price || 0)), 0);
    const totalUnitCost = products.reduce((sum, p: any) => sum + (Number(p.unit_cost || 0) * Number(p.velocity_30d || 0)), 0);
    const fees = Math.round(revenue * 0.15);
    const netProfit = revenue - totalUnitCost - fees;
    const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    const units7d = products.reduce((sum: number, p: any) => sum + Number(p.velocity_7d || 0), 0);
    const units30d = products.reduce((sum: number, p: any) => sum + Number(p.velocity_30d || 0), 0);
    const units90d = products.reduce((sum: number, p: any) => sum + Number(p.velocity_90d || 0), 0);

    const variationGroups = new Set(
      products.filter((p: any) => p.parent_asin).map((p: any) => p.parent_asin),
    ).size;

    return {
      seller_id: sellerId,
      marketplace_id: US_MARKETPLACE_ID,
      products,
      pending_purchase_orders: pendingPurchaseOrders,
      sync_status: syncState.status,
      last_synced_at: syncState.completed_at || null,
      needs_optimization_count: needsOptimizationCount,
      top_10_by_impact: top10,
      profitability: {
        revenue: Math.round(revenue),
        fees,
        net_profit: Math.round(netProfit),
        margin_pct: marginPct,
      },
      sales_velocity: {
        units_7d: units7d,
        units_30d: units30d,
        units_90d: units90d,
      },
      variation_groups: variationGroups,
    };
  }

  async getSellers(): Promise<Seller[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const accounts = (state.seller_accounts || []).filter(
      (a: any) => String(a.id) === sellerId,
    );
    return accounts.map((a: any) => ({
      id: a.id,
      merchant_id: a.merchant_id,
      marketplace_id: a.marketplace_id,
      region: a.region,
    }));
  }

  async getSellerAccounts(): Promise<SellerAccount[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.seller_accounts || [])
      .filter((a: any) => String(a.organization_id) === String(state.organizations?.[0]?.id) || String(a.id) === sellerId)
      .map((a: any) => ({
        id: a.id,
        organization_id: a.organization_id,
        merchant_id: a.merchant_id,
        marketplace_id: a.marketplace_id,
        region: a.region,
        sp_api_connected: Boolean(a.sp_api_connected),
        created_at: a.created_at,
      }));
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.purchase_orders || [])
      .filter((po: any) => String(po.seller_id || DEFAULT_SELLER_ID) === sellerId)
      .map((po: any) => ({
        id: po.id,
        product_asin: po.product_asin,
        product_name: po.product_name,
        supplier: po.supplier,
        units: Number(po.units),
        status: po.status,
        created_at: po.created_at,
        seller_id: po.seller_id,
      }));
  }

  async getOrders(): Promise<Order[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.orders || [])
      .filter((o: any) => String(o.seller_id || DEFAULT_SELLER_ID) === sellerId)
      .map((o: any) => ({
        id: o.id,
        product_name: o.product_name,
        supplier: o.supplier,
        amount: Number(o.amount),
        units: Number(o.units),
        status: o.status,
        reviewed_by: o.reviewed_by,
        reviewed_at: o.reviewed_at,
        seller_id: o.seller_id,
      }));
  }

  async getCampaigns(): Promise<Campaign[]> {
    const state = normalizeState(readMockState());
    return (state.campaigns || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      sku: c.sku,
      base_acos: Number(c.base_acos),
      ad_share: Number(c.ad_share),
      avg_cpc: Number(c.avg_cpc),
      bid_floor: Number(c.bid_floor),
      acos_modifier: Number(c.acos_modifier || 1),
      bid_changes: c.bid_changes || [],
      ad_history: c.ad_history || [],
      trailing_acos: c.trailing_acos,
      last_guardrail_date: c.last_guardrail_date,
    }));
  }

  async getSearchTerms(): Promise<SearchTerm[]> {
    const state = normalizeState(readMockState());
    return (state.search_terms || []).map((t: any) => ({
      term: t.term,
      clicks: Number(t.clicks),
      spend: Number(t.spend),
      conversions: Number(t.conversions),
      acos: Number(t.acos),
      sales: t.sales,
      impressions: t.impressions,
      order_value: t.order_value,
    }));
  }

  async getActivity(): Promise<ActivityItem[]> {
    const state = normalizeState(readMockState());
    return (state.activity || []).map((a: any) => ({
      id: a.id,
      timestamp: a.timestamp,
      category: a.category,
      title: a.title,
      detail: a.detail,
    }));
  }

  async getProductRevisions(): Promise<ProductRevision[]> {
    const state = normalizeState(readMockState());
    return (state.product_revisions || []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      asin: r.asin,
      field_changes: r.field_changes || {},
      status: r.status,
      created_by: r.created_by,
      created_at: r.created_at,
    }));
  }

  async decidePurchaseOrder(id: string, action: "approve" | "deny"): Promise<{ order: Order }> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const order = (state.orders || []).find((o: any) => o.id === id);
    if (!order) {
      throw new Error(`Order not found: ${id}`);
    }
    if (String(order.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Order not found: ${id}`);
    }
    if (order.status !== "pending") {
      throw new Error("This workflow has already been reviewed");
    }
    order.status = action === "approve" ? "approved" : "denied";
    order.reviewed_by = "mock@amzsphere.local";
    order.reviewed_at = new Date().toISOString();

    this.writeAuditLog(state, {
      action: `purchase_order_${action}`,
      target_type: "order",
      target_id: id,
      before: { status: "pending" },
      after: { status: order.status },
    });

    const activity = state.activity || [];
    activity.unshift({
      id: crypto.randomUUID(),
      timestamp: order.reviewed_at,
      category: "procurement",
      title: `Purchase workflow ${order.status}`,
      detail: `${id} for ${order.product_name} was ${order.status} by ${order.reviewed_by}.`,
    });
    if (activity.length > 120) activity.length = 120;

    writeMockState(state);
    return { order: { ...order } };
  }

  async decideRevision(id: string, action: "approve" | "reject"): Promise<{ revision: ProductRevision; product: Product }> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const revision = (state.product_revisions || []).find((r: any) => r.id === id);
    if (!revision) {
      throw new Error(`Revision not found: ${id}`);
    }
    const product = findProduct(state, revision.product_id);
    if (!product) {
      throw new Error(`Product not found: ${revision.product_id}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${revision.product_id}`);
    }
    if (revision.status !== "pending_approval") {
      throw new Error("This revision has already been reviewed");
    }
    const now = new Date().toISOString();
    const before = { opt_status: product.opt_status, opt_score: product.opt_score };
    if (action === "approve") {
      revision.status = "approved";
      for (const [field, change] of Object.entries(revision.field_changes || {})) {
        product[field] = (change as any).after;
      }
      product.opt_status = "published";
      product.last_optimized_at = now;
      const optResult = computeOptScore(product);
      product.opt_score = optResult.score;
      product.opt_issues = optResult.issues;
      product.opt_status = optResult.status;
    } else {
      revision.status = "rejected";
      product.opt_status = "needs_optimization";
    }

    this.writeAuditLog(state, {
      action: `product_revision_${action}`,
      target_type: "product_revision",
      target_id: id,
      before,
      after: { opt_status: product.opt_status, opt_score: product.opt_score },
    });

    writeMockState(state);
    return { revision: { ...revision }, product: { ...product } };
  }

  async syncState(): Promise<SyncState> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const operationId = crypto.randomUUID();
    const started = new Date().toISOString();
    state.sync_state = { status: "running", operation_id: operationId, started_at: started, seller_id: sellerId } as any;

    const catalog: any[] = (state.amazon_catalog || []).map((entry: any) => ({
      asin: entry.asin,
      marketplace_id: entry.marketplace_id || US_MARKETPLACE_ID,
      seller_id: entry.seller_id || sellerId,
      ...entry,
    }));
    let synced = 0;
    for (const entry of catalog) {
      const asin = entry.asin;
      const marketplaceId = entry.marketplace_id || US_MARKETPLACE_ID;
      const entrySellerId = String(entry.seller_id || sellerId);
      // Cross-tenant: only sync catalog entries that belong to the active seller.
      if (entrySellerId !== sellerId) continue;
      const product = (state.products || []).find(
        (p: any) => p.asin === asin && p.marketplace_id === marketplaceId && String(p.seller_id || DEFAULT_SELLER_ID) === sellerId,
      );
      if (product) {
        product.name = entry.title || entry.name;
        product.title = entry.title || entry.name;
        product.bullets = entry.bullets || [];
        product.description = entry.description || "";
        product.backend_keywords = entry.backend_keywords || [];
        product.images = entry.images || [];
        product.price = Number(entry.price) || 0;
        product.stock = Number(entry.stock) || 0;
        product.sellable_units = product.stock;
        product.days_of_supply = Math.round(product.stock / Math.max(Number(product.daily_velocity) || 10, 0.1));
        product.last_synced_at = started;
        product.sync_status = "synced";
      } else {
        const newProduct: any = {
          id: crypto.randomUUID(),
          asin,
          sku: entry.sku || asin,
          marketplace_id: marketplaceId,
          seller_id: sellerId,
          source: "amazon_sync",
          name: entry.title || entry.name,
          title: entry.title || entry.name,
          category: "General",
          price: Number(entry.price) || 0,
          bullets: entry.bullets || [],
          description: entry.description || "",
          backend_keywords: entry.backend_keywords || [],
          images: entry.images || [],
          sellable_units: Number(entry.stock) || 0,
          stock: Number(entry.stock) || 0,
          days_of_supply: Math.round(Number(entry.stock) / 10),
          daily_velocity: 10.0,
          competitor_price: Number(entry.price) || 0,
          market_price: Number(entry.price) || 0,
          min_floor: Math.round((Number(entry.price) || 0) * 0.8),
          max_price: Math.round((Number(entry.price) || 0) * 1.2),
          unit_cost: Math.round((Number(entry.price) || 0) * 0.5),
          lead_time_days: 21,
          supplier: "Mock Amazon Supplier",
          po_draft_id: null,
          suppressed: Boolean(entry.suppressed),
          last_synced_at: started,
          sync_status: "synced",
          last_optimized_at: null,
          opt_score: 0,
          opt_issues: [],
          opt_status: "needs_optimization",
        };
        productDefaults(newProduct);
        (state.products || []).push(newProduct);
        (state.global_products || []).push({ ...newProduct });
        const salesHistory: Record<string, number[]> = state.sales_history || {};
        salesHistory[newProduct.sku] = Array(30).fill(10);
        state.sales_history = salesHistory;
      }
      synced += 1;
    }

    (state.sync_state as any) = {
      status: "completed",
      operation_id: operationId,
      started_at: started,
      completed_at: new Date().toISOString(),
      products_synced: synced,
    };

    const activity = state.activity || [];
    activity.unshift({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category: "sync",
      title: "Mock Amazon seller data synced",
      detail: `${synced} product(s) upserted by ASIN and marketplace.`,
    });
    if (activity.length > 120) activity.length = 120;

    writeMockState(state);
    return state.sync_state;
  }

  async getSyncState(): Promise<SyncState> {
    const state = normalizeState(readMockState());
    return state.sync_state || { status: "not_synced" };
  }

  async getSellerStore(): Promise<SellerStoreItem[]> {
    const state = normalizeState(readMockState());
    return (state.seller_store || []).map((item: any) => ({
      id: item.id,
      asin: item.asin,
      name: item.name,
      sku: item.sku,
      category: item.category,
      price: Number(item.price),
      stock: Number(item.stock),
      visible: Boolean(item.visible),
      added_at: item.added_at || null,
    }));
  }

  async toggleSellerStoreVisibility(id: string, visible: boolean): Promise<SellerStoreItem> {
    const state = normalizeState(readMockState());
    const item = (state.seller_store || []).find((i: any) => i.id === id);
    if (!item) {
      throw new Error(`Seller store item not found: ${id}`);
    }
    item.visible = visible;
    writeMockState(state);
    return {
      id: item.id,
      asin: item.asin,
      name: item.name,
      sku: item.sku,
      category: item.category,
      price: Number(item.price),
      stock: Number(item.stock),
      visible: item.visible,
      added_at: item.added_at || null,
    };
  }

  async addToSellerStore(asin: string): Promise<SellerStoreItem> {
    const state = normalizeState(readMockState());
    const product = (state.products || []).find((p: any) => p.asin === asin);
    if (!product) {
      throw new Error(`Product not found: ${asin}`);
    }
    const existing = (state.seller_store || []).find((i: any) => i.asin === asin);
    if (existing) {
      throw new Error(`Product already in seller store: ${asin}`);
    }
    const item: any = {
      id: crypto.randomUUID(),
      asin: product.asin,
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: Number(product.price),
      stock: Number(product.stock),
      visible: true,
      added_at: new Date().toISOString(),
    };
    (state.seller_store || []).push(item);
    writeMockState(state);
    return {
      id: item.id,
      asin: item.asin,
      name: item.name,
      sku: item.sku,
      category: item.category,
      price: item.price,
      stock: item.stock,
      visible: item.visible,
      added_at: item.added_at,
    };
  }

  async getPpcData() {
    const state = normalizeState(readMockState());
    return {
      campaigns: (state.campaigns || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        sku: c.sku,
        base_acos: Number(c.base_acos),
        ad_share: Number(c.ad_share),
        avg_cpc: Number(c.avg_cpc),
        bid_floor: Number(c.bid_floor),
        acos_modifier: Number(c.acos_modifier || 1),
        bid_changes: c.bid_changes || [],
        ad_history: c.ad_history || [],
        trailing_acos: c.trailing_acos,
        last_guardrail_date: c.last_guardrail_date,
      })),
      search_terms: (state.search_terms || []).map((t: any) => ({
        term: t.term,
        clicks: Number(t.clicks),
        spend: Number(t.spend),
        conversions: Number(t.conversions),
        acos: Number(t.acos),
        sales: t.sales,
        impressions: t.impressions,
        order_value: t.order_value,
      })),
      targeted_exact_keywords: (state.targeted_exact_keywords || []).map((k: any) => ({
        term: k.term,
        added_at: k.added_at,
        source: k.source,
      })),
      negative_keywords: (state.negative_keywords || []).map((k: any) => ({
        term: k.term,
        added_at: k.added_at,
        source: k.source,
      })),
    };
  }

  async getReviews(filter: { product?: string; asin?: string; minRating?: number; maxRating?: number; theme?: string } = {}): Promise<Review[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.reviews || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (filter.product && String(r.product) !== filter.product) return false;
        if (filter.asin && String(r.asin) !== filter.asin) return false;
        if (filter.minRating !== undefined && Number(r.rating) < filter.minRating) return false;
        if (filter.maxRating !== undefined && Number(r.rating) > filter.maxRating) return false;
        if (filter.theme && String(r.theme) !== filter.theme) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        product: r.product,
        asin: r.asin,
        marketplace_id: r.marketplace_id,
        rating: Number(r.rating),
        date: r.date,
        theme: r.theme,
        text: r.text,
        customer_name: r.customer_name,
        verified_purchase: Boolean(r.verified_purchase),
        response: r.response,
        responded_at: r.responded_at,
      }));
  }

  async getReviewThemes(): Promise<Record<string, ReviewTheme>> {
    const state = normalizeState(readMockState());
    return state.review_themes || {};
  }

  async getCatalogProfiles(): Promise<Record<string, CatalogProfile>> {
    const state = normalizeState(readMockState());
    return state.catalog_profiles || {};
  }

  async getExecutionQueue(): Promise<ExecutionQueueItem[]> {
    const state = normalizeState(readMockState());
    return (state.execution_queue || []).map((q: any) => ({
      id: q.id,
      action: q.action,
      payload: q.payload || {},
      status: q.status,
      created_at: q.created_at,
      completed_at: q.completed_at || null,
    }));
  }

  async getManager(): Promise<Manager> {
    const state = normalizeState(readMockState());
    return {
      name: state.manager?.name || "User",
      role: state.manager?.role || "Procurement manager",
      initials: state.manager?.initials || "U",
    };
  }

  private writeAuditLog(state: any, entry: Omit<AuditLogEntry, "id" | "organization_id" | "seller_id" | "user_id" | "created_at">): void {
    const sellerId = this.requireActiveSeller();
    const stateOrgs = state.organizations || [];
    const orgId = stateOrgs.length ? stateOrgs[0].id : "";
    const auditLog: AuditLogEntry = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      seller_id: sellerId,
      user_id: "user-1",
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      before: entry.before,
      after: entry.after,
      created_at: new Date().toISOString(),
    };
    (state.audit_logs || []).unshift(auditLog);
    if ((state.audit_logs as any[]).length > 500) {
      (state.audit_logs as any[]).length = 500;
    }
  }

  async getOrganizations(): Promise<Organization[]> {
    const state = normalizeState(readMockState());
    return (state.organizations || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      created_at: o.created_at,
    }));
  }

  async getUsers(): Promise<User[]> {
    const state = normalizeState(readMockState());
    return (state.users || []).map((u: any) => ({
      id: u.id,
      organization_id: u.organization_id,
      email: u.email,
      name: u.name,
      role: u.role,
      is_active: Boolean(u.is_active),
      created_at: u.created_at,
    }));
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.audit_logs || [])
      .filter((a: any) => String(a.seller_id) === sellerId)
      .map((a: any) => ({
        id: a.id,
        organization_id: a.organization_id,
        seller_id: a.seller_id,
        user_id: a.user_id,
        action: a.action,
        target_type: a.target_type,
        target_id: a.target_id,
        before: a.before,
        after: a.after,
        created_at: a.created_at,
        ip: a.ip,
      }));
  }

  async getSyncJobs(): Promise<SyncJob[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.sync_jobs || [])
      .filter((j: any) => String(j.seller_id) === sellerId)
      .map((j: any) => ({
        id: j.id,
        organization_id: j.organization_id,
        seller_id: j.seller_id,
        type: j.type,
        status: j.status,
        started_at: j.started_at,
        completed_at: j.completed_at,
        records_processed: j.records_processed,
        error: j.error,
      }));
  }

  async getFinancialRecords(periodStart?: string, periodEnd?: string): Promise<FinancialRecord[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.financial_records || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (periodStart && r.period_start < periodStart) return false;
        if (periodEnd && r.period_end > periodEnd) return false;
        return true;
      })
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        period_start: r.period_start,
        period_end: r.period_end,
        revenue: Number(r.revenue),
        cogs: Number(r.cogs),
        fees: Number(r.fees),
        net_profit: Number(r.net_profit),
        units_sold: Number(r.units_sold),
        orders_count: Number(r.orders_count),
        created_at: r.created_at,
      }));
  }

  async getProfitability(periodStart?: string, periodEnd?: string): Promise<ProfitabilitySummary> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const records = (state.financial_records || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (periodStart && r.period_start < periodStart) return false;
        if (periodEnd && r.period_end > periodEnd) return false;
        return true;
      });

    let revenue = 0;
    let cogs = 0;
    let fees = 0;
    let netProfit = 0;
    let unitsSold = 0;
    let ordersCount = 0;
    const byCategory: Record<string, { revenue: number; net_profit: number; units_sold: number }> = {};

    const salesHistory: Record<string, number[]> = state.sales_history || {};
    const products = this.scopeProductsBySeller(state);

    for (const p of products) {
      const category = p.category || "Uncategorized";
      const history: number[] = (salesHistory || {})[p.sku] || [];
      const catUnits = history.reduce((sum: number, v: number) => sum + v, 0);
      if (!byCategory[category]) {
        byCategory[category] = { revenue: 0, net_profit: 0, units_sold: 0 };
      }
      byCategory[category].units_sold += catUnits;
      unitsSold += catUnits;
    }

    for (const r of records) {
      revenue += Number(r.revenue) || 0;
      cogs += Number(r.cogs) || 0;
      fees += Number(r.fees) || 0;
      netProfit += Number(r.net_profit) || 0;
      unitsSold += Number(r.units_sold) || 0;
      ordersCount += Number(r.orders_count) || 0;
    }

    const marginPct = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    return {
      period_start: periodStart || "",
      period_end: periodEnd || "",
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      fees: Math.round(fees),
      net_profit: Math.round(netProfit),
      margin_pct: marginPct,
      units_sold: unitsSold,
      orders_count: ordersCount,
      by_category: Object.entries(byCategory).map(([category, v]) => ({
        category,
        revenue: Math.round(v.revenue),
        net_profit: Math.round(v.net_profit),
        units_sold: v.units_sold,
      })),
    };
  }

  async getKeywords(): Promise<Keyword[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.keywords || [])
      .filter((k: any) => String(k.seller_id) === sellerId)
      .map((k: any) => ({
        id: k.id,
        seller_id: k.seller_id,
        keyword: k.keyword,
        marketplace_id: k.marketplace_id,
        search_volume: Number(k.search_volume),
        difficulty: Number(k.difficulty),
        cpc: Number(k.cpc),
        category: k.category,
        created_at: k.created_at,
        updated_at: k.updated_at,
      }));
  }

  async addKeyword(keyword: Omit<Keyword, "id">): Promise<Keyword> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Keyword = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      keyword: keyword.keyword,
      marketplace_id: keyword.marketplace_id,
      search_volume: Number(keyword.search_volume),
      difficulty: Number(keyword.difficulty),
      cpc: Number(keyword.cpc),
      category: keyword.category ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.keywords as any[]).unshift(record);
    if ((state.keywords as any[]).length > 500) {
      (state.keywords as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async getKeywordRanks(keywordId?: string, asin?: string): Promise<KeywordRankHistory[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.keyword_rank_history || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (keywordId && String(r.keyword_id) !== keywordId) return false;
        if (asin && String(r.asin) !== asin) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.rank_date).localeCompare(String(a.rank_date)))
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        keyword_id: r.keyword_id,
        asin: r.asin,
        marketplace_id: r.marketplace_id,
        rank: Number(r.rank),
        rank_date: r.rank_date,
        created_at: r.created_at,
      }));
  }

  async recordKeywordRank(keywordId: string, asin: string, rank: number): Promise<KeywordRankHistory> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const keyword = (state.keywords || []).find((k: any) => k.id === keywordId && String(k.seller_id) === sellerId);
    if (!keyword) {
      throw new Error(`Keyword not found: ${keywordId}`);
    }
    const record: KeywordRankHistory = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      keyword_id: keywordId,
      asin,
      marketplace_id: keyword.marketplace_id,
      rank: Number(rank),
      rank_date: new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
    };
    (state.keyword_rank_history as any[]).unshift(record);
    if ((state.keyword_rank_history as any[]).length > 1000) {
      (state.keyword_rank_history as any[]).length = 1000;
    }
    writeMockState(state);
    return record;
  }

  async getSuppliers(): Promise<Supplier[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.suppliers || [])
      .filter((s: any) => String(s.seller_id) === sellerId)
      .map((s: any) => ({
        id: s.id,
        seller_id: s.seller_id,
        name: s.name,
        contact_name: s.contact_name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        lead_time_days: Number(s.lead_time_days),
        min_order_qty: Number(s.min_order_qty),
        currency: s.currency,
        is_active: Boolean(s.is_active),
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const s = (state.suppliers || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!s) {
      return null;
    }
    return {
      id: s.id,
      seller_id: s.seller_id,
      name: s.name,
      contact_name: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      lead_time_days: Number(s.lead_time_days),
      min_order_qty: Number(s.min_order_qty),
      currency: s.currency,
      is_active: Boolean(s.is_active),
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  async addSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Supplier = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      name: supplier.name,
      contact_name: supplier.contact_name ?? null,
      email: supplier.email ?? null,
      phone: supplier.phone ?? null,
      address: supplier.address ?? null,
      lead_time_days: Number(supplier.lead_time_days),
      min_order_qty: Number(supplier.min_order_qty),
      currency: supplier.currency,
      is_active: Boolean(supplier.is_active),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.suppliers as any[]).push(record);
    if ((state.suppliers as any[]).length > 500) {
      (state.suppliers as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const s = (state.suppliers || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!s) {
      throw new Error(`Supplier not found: ${id}`);
    }
    Object.assign(s, patch);
    s.seller_id = sellerId;
    s.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: s.id,
      seller_id: s.seller_id,
      name: s.name,
      contact_name: s.contact_name,
      email: s.email,
      phone: s.phone,
      address: s.address,
      lead_time_days: Number(s.lead_time_days),
      min_order_qty: Number(s.min_order_qty),
      currency: s.currency,
      is_active: Boolean(s.is_active),
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  async getLandedCost(asin: string): Promise<LandedCost | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, asin);
    if (!product) {
      return null;
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      return null;
    }
    const lc = (state.landed_costs || []).find((x: any) => String(x.product_id) === product.id);
    if (!lc) {
      return null;
    }
    return {
      id: lc.id,
      product_id: lc.product_id,
      asin: lc.asin,
      unit_cost: Number(lc.unit_cost),
      shipping_per_unit: Number(lc.shipping_per_unit),
      duty_per_unit: Number(lc.duty_per_unit),
      freight_per_unit: Number(lc.freight_per_unit),
      other_per_unit: Number(lc.other_per_unit),
      total_landed_cost: Number(lc.total_landed_cost),
      currency: lc.currency,
      updated_by: lc.updated_by,
      updated_at: lc.updated_at,
    };
  }

  async setLandedCost(asin: string, patch: Partial<LandedCost>): Promise<LandedCost> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, asin);
    if (!product) {
      throw new Error(`Product not found: ${asin}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${asin}`);
    }
    const existing = (state.landed_costs || []).find((x: any) => String(x.product_id) === product.id);
    const now = new Date().toISOString();
    const record: LandedCost = existing
      ? {
          id: existing.id,
          product_id: product.id,
          asin: product.asin,
          unit_cost: Number(patch.unit_cost ?? existing.unit_cost),
          shipping_per_unit: Number(patch.shipping_per_unit ?? existing.shipping_per_unit),
          duty_per_unit: Number(patch.duty_per_unit ?? existing.duty_per_unit),
          freight_per_unit: Number(patch.freight_per_unit ?? existing.freight_per_unit),
          other_per_unit: Number(patch.other_per_unit ?? existing.other_per_unit),
          total_landed_cost: Number(
            (patch.unit_cost ?? existing.unit_cost) +
            (patch.shipping_per_unit ?? existing.shipping_per_unit) +
            (patch.duty_per_unit ?? existing.duty_per_unit) +
            (patch.freight_per_unit ?? existing.freight_per_unit) +
            (patch.other_per_unit ?? existing.other_per_unit),
          ),
          currency: patch.currency ?? existing.currency,
          updated_by: "mock@amzsphere.local",
          updated_at: now,
        }
      : {
          id: crypto.randomUUID(),
          product_id: product.id,
          asin: product.asin,
          unit_cost: Number(patch.unit_cost || 0),
          shipping_per_unit: Number(patch.shipping_per_unit || 0),
          duty_per_unit: Number(patch.duty_per_unit || 0),
          freight_per_unit: Number(patch.freight_per_unit || 0),
          other_per_unit: Number(patch.other_per_unit || 0),
          total_landed_cost: Number(
            (patch.unit_cost || 0) +
            (patch.shipping_per_unit || 0) +
            (patch.duty_per_unit || 0) +
            (patch.freight_per_unit || 0) +
            (patch.other_per_unit || 0),
          ),
          currency: patch.currency || "USD",
          updated_by: "mock@amzsphere.local",
          updated_at: now,
        };
    if (existing) {
      Object.assign(existing, {
        unit_cost: record.unit_cost,
        shipping_per_unit: record.shipping_per_unit,
        duty_per_unit: record.duty_per_unit,
        freight_per_unit: record.freight_per_unit,
        other_per_unit: record.other_per_unit,
        total_landed_cost: record.total_landed_cost,
        currency: record.currency,
        updated_at: record.updated_at,
      });
    } else {
      (state.landed_costs as any[]).push(record);
      if ((state.landed_costs as any[]).length > 500) {
        (state.landed_costs as any[]).length = 500;
      }
    }
    writeMockState(state);
    return record;
  }

  async getCompetitorProducts(asin?: string): Promise<CompetitorProduct[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.competitor_products || [])
      .filter((c: any) => String(c.seller_id) === sellerId)
      .filter((c: any) => {
        if (asin && String(c.asin) !== asin) return false;
        return true;
      })
      .map((c: any) => ({
        id: c.id,
        seller_id: c.seller_id,
        asin: c.asin,
        title: c.title,
        brand: c.brand,
        price: Number(c.price),
        marketplace_id: c.marketplace_id,
        category: c.category,
        buy_box_winner: Boolean(c.buy_box_winner),
        rating: c.rating,
        review_count: Number(c.review_count),
        in_stock: Boolean(c.in_stock),
        observed_at: c.observed_at,
        created_at: c.created_at,
      }));
  }

  async addCompetitorProduct(product: Omit<CompetitorProduct, "id">): Promise<CompetitorProduct> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: CompetitorProduct = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      asin: product.asin,
      title: product.title,
      brand: product.brand ?? null,
      price: Number(product.price),
      marketplace_id: product.marketplace_id,
      category: product.category ?? null,
      buy_box_winner: Boolean(product.buy_box_winner),
      rating: product.rating ?? null,
      review_count: Number(product.review_count),
      in_stock: Boolean(product.in_stock),
      observed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    (state.competitor_products as any[]).push(record);
    if ((state.competitor_products as any[]).length > 500) {
      (state.competitor_products as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async getCompetitorObservations(productAsin?: string): Promise<CompetitorObservation[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.competitor_observations || [])
      .filter((o: any) => String(o.seller_id) === sellerId)
      .filter((o: any) => {
        if (productAsin && String(o.product_asin) !== productAsin) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.observed_at).localeCompare(String(a.observed_at)))
      .map((o: any) => ({
        id: o.id,
        seller_id: o.seller_id,
        product_asin: o.product_asin,
        competitor_asin: o.competitor_asin,
        competitor_price: Number(o.competitor_price),
        price_gap: Number(o.price_gap),
        buy_box_eligible: Boolean(o.buy_box_eligible),
        observed_at: o.observed_at,
        created_at: o.created_at,
      }));
  }

  async recordCompetitorObservation(productAsin: string, competitorAsin: string, competitorPrice: number): Promise<CompetitorObservation> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, productAsin);
    if (!product) {
      throw new Error(`Product not found: ${productAsin}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${productAsin}`);
    }
    const ownPrice = Number(product.price);
    const observation: CompetitorObservation = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      product_asin: productAsin,
      competitor_asin: competitorAsin,
      competitor_price: Number(competitorPrice),
      price_gap: ownPrice - Number(competitorPrice),
      buy_box_eligible: ownPrice <= Number(competitorPrice),
      observed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    (state.competitor_observations as any[]).unshift(observation);
    if ((state.competitor_observations as any[]).length > 1000) {
      (state.competitor_observations as any[]).length = 1000;
    }
    writeMockState(state);
    return observation;
  }

  async getFeaturedOffer(asin: string): Promise<FeaturedOffer | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, asin);
    if (!product) {
      return null;
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      return null;
    }
    const fo = (state.featured_offers || []).find((x: any) => String(x.asin) === asin);
    if (!fo) {
      return null;
    }
    return {
      id: fo.id,
      seller_id: fo.seller_id,
      asin: fo.asin,
      is_buy_box_winner: Boolean(fo.is_buy_box_winner),
      offer_price: Number(fo.offer_price),
      lowest_price: Number(fo.lowest_price),
      shipping_cost: Number(fo.shipping_cost),
      prime_eligible: Boolean(fo.prime_eligible),
      fulfilled_by_amazon: Boolean(fo.fulfilled_by_amazon),
      observed_at: fo.observed_at,
      created_at: fo.created_at,
    };
  }

  async recordFeaturedOffer(asin: string, isBuyBoxWinner: boolean, offerPrice: number, lowestPrice: number): Promise<FeaturedOffer> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const product = findProduct(state, asin);
    if (!product) {
      throw new Error(`Product not found: ${asin}`);
    }
    if (String(product.seller_id || DEFAULT_SELLER_ID) !== sellerId) {
      throw new Error(`Product not found: ${asin}`);
    }
    const now = new Date().toISOString();
    const record: FeaturedOffer = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      asin,
      is_buy_box_winner: Boolean(isBuyBoxWinner),
      offer_price: Number(offerPrice),
      lowest_price: Number(lowestPrice),
      shipping_cost: 0,
      prime_eligible: true,
      fulfilled_by_amazon: true,
      observed_at: now,
      created_at: now,
    };
    (state.featured_offers as any[]).push(record);
    if ((state.featured_offers as any[]).length > 500) {
      (state.featured_offers as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async respondToReview(reviewId: string, response: string): Promise<Review> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const review = (state.reviews || []).find((r: any) => r.id === reviewId && String(r.seller_id) === sellerId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }
    review.response = response;
    review.responded_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: review.id,
      seller_id: review.seller_id,
      product: review.product,
      asin: review.asin,
      marketplace_id: review.marketplace_id,
      rating: Number(review.rating),
      date: review.date,
      theme: review.theme,
      text: review.text,
      customer_name: review.customer_name,
      verified_purchase: Boolean(review.verified_purchase),
      response: review.response,
      responded_at: review.responded_at,
    };
  }

  async getReturnRequests(): Promise<ReturnRequest[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.return_requests || [])
      .filter((rr: any) => String(rr.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.requested_at).localeCompare(String(a.requested_at)))
      .map((rr: any) => ({
        id: rr.id,
        seller_id: rr.seller_id,
        order_id: rr.order_id,
        asin: rr.asin,
        sku: rr.sku,
        customer_name: rr.customer_name,
        reason: rr.reason,
        status: rr.status,
        requested_at: rr.requested_at,
        resolved_at: rr.resolved_at,
        refund_amount: Number(rr.refund_amount),
        units: Number(rr.units),
      }));
  }

  async getReturnRequest(id: string): Promise<ReturnRequest | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const rr = (state.return_requests || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!rr) {
      return null;
    }
    return {
      id: rr.id,
      seller_id: rr.seller_id,
      order_id: rr.order_id,
      asin: rr.asin,
      sku: rr.sku,
      customer_name: rr.customer_name,
      reason: rr.reason,
      status: rr.status,
      requested_at: rr.requested_at,
      resolved_at: rr.resolved_at,
      refund_amount: Number(rr.refund_amount),
      units: Number(rr.units),
    };
  }

  async updateReturnRequest(id: string, patch: Partial<ReturnRequest>): Promise<ReturnRequest> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const rr = (state.return_requests || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!rr) {
      throw new Error(`Return request not found: ${id}`);
    }
    Object.assign(rr, patch);
    rr.seller_id = sellerId;
    if (patch.status && (patch.status === "approved" || patch.status === "denied" || patch.status === "received" || patch.status === "refunded" || patch.status === "rejected")) {
      rr.resolved_at = new Date().toISOString();
    }
    writeMockState(state);
    return {
      id: rr.id,
      seller_id: rr.seller_id,
      order_id: rr.order_id,
      asin: rr.asin,
      sku: rr.sku,
      customer_name: rr.customer_name,
      reason: rr.reason,
      status: rr.status,
      requested_at: rr.requested_at,
      resolved_at: rr.resolved_at,
      refund_amount: Number(rr.refund_amount),
      units: Number(rr.units),
    };
  }

  async getPromotions(): Promise<Promotion[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.promotions || [])
      .filter((p: any) => String(p.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((p: any) => ({
        id: p.id,
        seller_id: p.seller_id,
        name: p.name,
        type: p.type,
        discount_value: Number(p.discount_value),
        min_purchase: Number(p.min_purchase),
        max_discount: p.max_discount === null || p.max_discount === undefined ? null : Number(p.max_discount),
        start_date: p.start_date,
        end_date: p.end_date,
        status: p.status,
        redemption_count: Number(p.redemption_count),
        asin_list: p.asin_list || [],
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
  }

  async getPromotion(id: string): Promise<Promotion | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const p = (state.promotions || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!p) {
      return null;
    }
    return {
      id: p.id,
      seller_id: p.seller_id,
      name: p.name,
      type: p.type,
      discount_value: Number(p.discount_value),
      min_purchase: Number(p.min_purchase),
      max_discount: p.max_discount === null || p.max_discount === undefined ? null : Number(p.max_discount),
      start_date: p.start_date,
      end_date: p.end_date,
      status: p.status,
      redemption_count: Number(p.redemption_count),
      asin_list: p.asin_list || [],
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  async addPromotion(promotion: Omit<Promotion, "id">): Promise<Promotion> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Promotion = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      name: promotion.name,
      type: promotion.type,
      discount_value: Number(promotion.discount_value),
      min_purchase: Number(promotion.min_purchase),
      max_discount: promotion.max_discount === null || promotion.max_discount === undefined ? null : Number(promotion.max_discount),
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      status: promotion.status,
      redemption_count: Number(promotion.redemption_count),
      asin_list: promotion.asin_list || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.promotions as any[]).push(record);
    if ((state.promotions as any[]).length > 500) {
      (state.promotions as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async updatePromotion(id: string, patch: Partial<Promotion>): Promise<Promotion> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const p = (state.promotions || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!p) {
      throw new Error(`Promotion not found: ${id}`);
    }
    Object.assign(p, patch);
    p.seller_id = sellerId;
    p.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: p.id,
      seller_id: p.seller_id,
      name: p.name,
      type: p.type,
      discount_value: Number(p.discount_value),
      min_purchase: Number(p.min_purchase),
      max_discount: p.max_discount === null || p.max_discount === undefined ? null : Number(p.max_discount),
      start_date: p.start_date,
      end_date: p.end_date,
      status: p.status,
      redemption_count: Number(p.redemption_count),
      asin_list: p.asin_list || [],
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  async getCoupons(): Promise<Coupon[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.coupons || [])
      .filter((c: any) => String(c.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((c: any) => ({
        id: c.id,
        seller_id: c.seller_id,
        code: c.code,
        asin: c.asin,
        discount_type: c.discount_type,
        discount_value: Number(c.discount_value),
        min_purchase: Number(c.min_purchase),
        max_redemptions: c.max_redemptions === null || c.max_redemptions === undefined ? null : Number(c.max_redemptions),
        redeemed_count: Number(c.redeemed_count),
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
  }

  async getCoupon(id: string): Promise<Coupon | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const c = (state.coupons || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!c) {
      return null;
    }
    return {
      id: c.id,
      seller_id: c.seller_id,
      code: c.code,
      asin: c.asin,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      min_purchase: Number(c.min_purchase),
      max_redemptions: c.max_redemptions === null || c.max_redemptions === undefined ? null : Number(c.max_redemptions),
      redeemed_count: Number(c.redeemed_count),
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  async addCoupon(coupon: Omit<Coupon, "id">): Promise<Coupon> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Coupon = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      code: coupon.code,
      asin: coupon.asin,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      min_purchase: Number(coupon.min_purchase),
      max_redemptions: coupon.max_redemptions === null || coupon.max_redemptions === undefined ? null : Number(coupon.max_redemptions),
      redeemed_count: Number(coupon.redeemed_count),
      start_date: coupon.start_date,
      end_date: coupon.end_date,
      status: coupon.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.coupons as any[]).push(record);
    if ((state.coupons as any[]).length > 500) {
      (state.coupons as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async updateCoupon(id: string, patch: Partial<Coupon>): Promise<Coupon> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const c = (state.coupons || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!c) {
      throw new Error(`Coupon not found: ${id}`);
    }
    Object.assign(c, patch);
    c.seller_id = sellerId;
    c.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: c.id,
      seller_id: c.seller_id,
      code: c.code,
      asin: c.asin,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      min_purchase: Number(c.min_purchase),
      max_redemptions: c.max_redemptions === null || c.max_redemptions === undefined ? null : Number(c.max_redemptions),
      redeemed_count: Number(c.redeemed_count),
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  async getReports(): Promise<Report[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.reports || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        name: r.name,
        type: r.type,
        period_start: r.period_start,
        period_end: r.period_end,
        status: r.status,
        created_at: r.created_at,
        completed_at: r.completed_at,
        download_url: r.download_url,
        record_count: Number(r.record_count),
        error: r.error,
      }));
  }

  async getReport(id: string): Promise<Report | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const r = (state.reports || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      seller_id: r.seller_id,
      name: r.name,
      type: r.type,
      period_start: r.period_start,
      period_end: r.period_end,
      status: r.status,
      created_at: r.created_at,
      completed_at: r.completed_at,
      download_url: r.download_url,
      record_count: Number(r.record_count),
      error: r.error,
    };
  }

  async addReport(report: Omit<Report, "id">): Promise<Report> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Report = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      name: report.name,
      type: report.type,
      period_start: report.period_start,
      period_end: report.period_end,
      status: "queued",
      created_at: new Date().toISOString(),
      completed_at: null,
      download_url: null,
      record_count: 0,
      error: null,
    };
    (state.reports as any[]).push(record);
    if ((state.reports as any[]).length > 500) {
      (state.reports as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async getReportExecutions(reportId?: string): Promise<ReportExecution[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.report_executions || [])
      .filter((e: any) => String(e.seller_id) === sellerId)
      .filter((e: any) => {
        if (reportId && String(e.report_id) !== reportId) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.started_at).localeCompare(String(a.started_at)))
      .map((e: any) => ({
        id: e.id,
        report_id: e.report_id,
        seller_id: e.seller_id,
        status: e.status,
        started_at: e.started_at,
        completed_at: e.completed_at,
        records_processed: Number(e.records_processed),
        error: e.error,
      }));
  }

  async getExports(): Promise<Export[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.exports || [])
      .filter((e: any) => String(e.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((e: any) => ({
        id: e.id,
        seller_id: e.seller_id,
        report_id: e.report_id,
        format: e.format,
        status: e.status,
        created_at: e.created_at,
        completed_at: e.completed_at,
        download_url: e.download_url,
        record_count: Number(e.record_count),
        error: e.error,
      }));
  }

  async getExport(id: string): Promise<Export | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const e = (state.exports || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!e) {
      return null;
    }
    return {
      id: e.id,
      seller_id: e.seller_id,
      report_id: e.report_id,
      format: e.format,
      status: e.status,
      created_at: e.created_at,
      completed_at: e.completed_at,
      download_url: e.download_url,
      record_count: Number(e.record_count),
      error: e.error,
    };
  }

  async addExport(exportItem: Omit<Export, "id">): Promise<Export> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Export = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      report_id: exportItem.report_id,
      format: exportItem.format,
      status: "queued",
      created_at: new Date().toISOString(),
      completed_at: null,
      download_url: null,
      record_count: 0,
      error: null,
    };
    (state.exports as any[]).push(record);
    if ((state.exports as any[]).length > 500) {
      (state.exports as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async getForecasts(): Promise<Forecast[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.forecasts || [])
      .filter((f: any) => String(f.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((f: any) => ({
        id: f.id,
        seller_id: f.seller_id,
        name: f.name,
        type: f.type,
        horizon_days: Number(f.horizon_days),
        period_start: f.period_start,
        period_end: f.period_end,
        status: f.status,
        created_at: f.created_at,
        updated_at: f.updated_at,
      }));
  }

  async getForecast(id: string): Promise<Forecast | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const f = (state.forecasts || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!f) {
      return null;
    }
    return {
      id: f.id,
      seller_id: f.seller_id,
      name: f.name,
      type: f.type,
      horizon_days: Number(f.horizon_days),
      period_start: f.period_start,
      period_end: f.period_end,
      status: f.status,
      created_at: f.created_at,
      updated_at: f.updated_at,
    };
  }

  async addForecast(forecast: Omit<Forecast, "id">): Promise<Forecast> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: Forecast = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      name: forecast.name,
      type: forecast.type,
      horizon_days: Number(forecast.horizon_days),
      period_start: forecast.period_start,
      period_end: forecast.period_end,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.forecasts as any[]).push(record);
    if ((state.forecasts as any[]).length > 500) {
      (state.forecasts as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async getForecastPoints(forecastId: string): Promise<ForecastPoint[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.forecast_points || [])
      .filter((p: any) => String(p.forecast_id) === forecastId)
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))
      .map((p: any) => ({
        id: p.id,
        forecast_id: p.forecast_id,
        date: p.date,
        value: Number(p.value),
        lower_bound: p.lower_bound === null || p.lower_bound === undefined ? null : Number(p.lower_bound),
        upper_bound: p.upper_bound === null || p.upper_bound === undefined ? null : Number(p.upper_bound),
      }));
  }

  async getForecastScenarios(forecastId: string): Promise<ForecastScenario[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.forecast_scenarios || [])
      .filter((s: any) => String(s.forecast_id) === forecastId)
      .map((s: any) => ({
        id: s.id,
        forecast_id: s.forecast_id,
        name: s.name,
        growth_rate_pct: Number(s.growth_rate_pct),
        description: s.description,
      }));
  }

  async getAIRecommendations(filter: { type?: string; status?: string } = {}): Promise<AIRecommendation[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.ai_recommendations || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (filter.type && String(r.type) !== filter.type) return false;
        if (filter.status && String(r.status) !== filter.status) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        type: r.type,
        title: r.title,
        description: r.description,
        rationale: r.rationale,
        confidence: Number(r.confidence),
        impact: r.impact,
        estimated_monthly_lift_usd: r.estimated_monthly_lift_usd === null || r.estimated_monthly_lift_usd === undefined ? null : Number(r.estimated_monthly_lift_usd),
        asin: r.asin,
        sku: r.sku,
        status: r.status,
        source: r.source,
        model: r.model,
        created_at: r.created_at,
        updated_at: r.updated_at,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
      }));
  }

  async getAIRecommendation(id: string): Promise<AIRecommendation | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const r = (state.ai_recommendations || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      seller_id: r.seller_id,
      type: r.type,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      confidence: Number(r.confidence),
      impact: r.impact,
      estimated_monthly_lift_usd: r.estimated_monthly_lift_usd === null || r.estimated_monthly_lift_usd === undefined ? null : Number(r.estimated_monthly_lift_usd),
      asin: r.asin,
      sku: r.sku,
      status: r.status,
      source: r.source,
      model: r.model,
      created_at: r.created_at,
      updated_at: r.updated_at,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
    };
  }

  async createAIRecommendation(recommendation: Omit<AIRecommendation, "id">): Promise<AIRecommendation> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: AIRecommendation = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      type: recommendation.type,
      title: recommendation.title,
      description: recommendation.description,
      rationale: recommendation.rationale,
      confidence: Number(recommendation.confidence),
      impact: recommendation.impact,
      estimated_monthly_lift_usd: recommendation.estimated_monthly_lift_usd === null || recommendation.estimated_monthly_lift_usd === undefined ? null : Number(recommendation.estimated_monthly_lift_usd),
      asin: recommendation.asin ?? null,
      sku: recommendation.sku ?? null,
      status: recommendation.status,
      source: recommendation.source,
      model: recommendation.model ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reviewed_by: recommendation.reviewed_by ?? null,
      reviewed_at: recommendation.reviewed_at ?? null,
    };
    (state.ai_recommendations as any[]).push(record);
    if ((state.ai_recommendations as any[]).length > 500) {
      (state.ai_recommendations as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async updateAIRecommendation(id: string, patch: Partial<AIRecommendation>): Promise<AIRecommendation> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const r = (state.ai_recommendations || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!r) {
      throw new Error(`AI recommendation not found: ${id}`);
    }
    Object.assign(r, patch);
    r.seller_id = sellerId;
    r.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: r.id,
      seller_id: r.seller_id,
      type: r.type,
      title: r.title,
      description: r.description,
      rationale: r.rationale,
      confidence: Number(r.confidence),
      impact: r.impact,
      estimated_monthly_lift_usd: r.estimated_monthly_lift_usd === null || r.estimated_monthly_lift_usd === undefined ? null : Number(r.estimated_monthly_lift_usd),
      asin: r.asin,
      sku: r.sku,
      status: r.status,
      source: r.source,
      model: r.model,
      created_at: r.created_at,
      updated_at: r.updated_at,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
    };
  }

  async generateAIRecommendations(context: Record<string, unknown> = {}): Promise<AIRecommendation[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const now = new Date().toISOString();
    const recommendations: AIRecommendation[] = [];

    // Pricing recommendation: products priced above competitor with margin headroom
    for (const p of (state.products || []).filter((x: any) => String(x.seller_id || DEFAULT_SELLER_ID) === sellerId)) {
      const price = Number(p.price) || 0;
      const compPrice = Number(p.competitor_price) || 0;
      const floor = Number(p.min_floor) || 0;
      if (compPrice > 0 && price > compPrice && price > floor + 2) {
        const lift = Math.round((price - compPrice) * Number(p.daily_velocity || 1) * 30 * 100) / 100;
        recommendations.push({
          id: crypto.randomUUID(),
          seller_id: sellerId,
          type: "pricing",
          title: `Reprice ${p.asin} toward competitor`,
          description: `Your price ($${price.toFixed(2)}) is above the competitor ($${compPrice.toFixed(2)}). Consider lowering toward ${(compPrice - 0.01).toFixed(2)} while staying above your floor ($${floor.toFixed(2)}).`,
          rationale: `Price gap of $${(price - compPrice).toFixed(2)} vs competitor with ${Number(p.daily_velocity)} daily velocity.`,
          confidence: 0.75,
          impact: price > compPrice + 5 ? "high" : "medium",
          estimated_monthly_lift_usd: lift,
          asin: p.asin,
          sku: p.sku,
          status: "new",
          source: "simulated",
          model: "rule-based-pricing-v1",
          created_at: now,
          updated_at: now,
          reviewed_by: null,
          reviewed_at: null,
        });
      }
    }

    // Inventory recommendation: low days of supply
    for (const p of (state.products || []).filter((x: any) => String(x.seller_id || DEFAULT_SELLER_ID) === sellerId)) {
      const stock = Number(p.stock) || 0;
      const velocity = Number(p.daily_velocity) || 0;
      const daysSupply = velocity > 0 ? stock / velocity : 999;
      if (daysSupply < 15 && stock > 0) {
        const lift = Math.round((15 - daysSupply) * velocity * Number(p.price || 0) * 100) / 100;
        recommendations.push({
          id: crypto.randomUUID(),
          seller_id: sellerId,
          type: "inventory",
          title: `Restock ${p.asin} (${daysSupply.toFixed(1)} days of supply)`,
          description: `Only ${daysSupply.toFixed(1)} days of supply remain. Create a purchase order for ${Math.ceil((45 - daysSupply) * Math.max(velocity, 1))} units to reach 45-day coverage.`,
          rationale: `Days of supply below 15 threshold with ${velocity.toFixed(1)} daily velocity.`,
          confidence: 0.85,
          impact: daysSupply < 7 ? "high" : "medium",
          estimated_monthly_lift_usd: lift,
          asin: p.asin,
          sku: p.sku,
          status: "new",
          source: "simulated",
          model: "rule-based-inventory-v1",
          created_at: now,
          updated_at: now,
          reviewed_by: null,
          reviewed_at: null,
        });
      }
    }

    // SEO recommendation: suppressed or low-opt-score listings
    for (const p of (state.products || []).filter((x: any) => String(x.seller_id || DEFAULT_SELLER_ID) === sellerId)) {
      if (p.suppressed || (Number(p.opt_score) || 0) < 60) {
        recommendations.push({
          id: crypto.randomUUID(),
          seller_id: sellerId,
          type: "seo",
          title: `Optimize listing ${p.asin}`,
          description: `Listing ${p.name} has an optimization score of ${Number(p.opt_score) || 0}. Review title length, bullet count, and backend keywords.`,
          rationale: `Opt score ${Number(p.opt_score) || 0}${p.suppressed ? "; listing suppressed" : ""}.`,
          confidence: 0.8,
          impact: p.suppressed ? "high" : "medium",
          estimated_monthly_lift_usd: null,
          asin: p.asin,
          sku: p.sku,
          status: "new",
          source: "simulated",
          model: "rule-based-seo-v1",
          created_at: now,
          updated_at: now,
          reviewed_by: null,
          reviewed_at: null,
        });
      }
    }

    // Deduplicate by type+asin, cap
    const seen = new Set<string>();
    const deduped: AIRecommendation[] = [];
    for (const r of recommendations) {
      const key = `${r.type}|${r.asin || "none"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    (state.ai_recommendations as any[]).unshift(...deduped);
    if ((state.ai_recommendations as any[]).length > 500) {
      (state.ai_recommendations as any[]).length = 500;
    }
    writeMockState(state);
    return deduped;
  }

  async getAIConversations(): Promise<AIConversation[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.ai_conversations || [])
      .filter((c: any) => String(c.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map((c: any) => ({
        id: c.id,
        seller_id: c.seller_id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
  }

  async getAIConversation(id: string): Promise<AIConversation | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const c = (state.ai_conversations || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!c) {
      return null;
    }
    return {
      id: c.id,
      seller_id: c.seller_id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }

  async addAIMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<AIMessage> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const conv = (state.ai_conversations || []).find((x: any) => x.id === conversationId && String(x.seller_id) === sellerId);
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    conv.updated_at = new Date().toISOString();
    const record: AIMessage = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    (state.ai_messages as any[]).push(record);
    if ((state.ai_messages as any[]).length > 1000) {
      (state.ai_messages as any[]).length = 1000;
    }
    writeMockState(state);
    return record;
  }

  async getAIMessages(conversationId: string): Promise<AIMessage[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const conv = (state.ai_conversations || []).find((x: any) => x.id === conversationId && String(x.seller_id) === sellerId);
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return (state.ai_messages || [])
      .filter((m: any) => String(m.conversation_id) === conversationId)
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((m: any) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
  }

  async getAutomationRules(filter: { type?: string; enabled?: boolean } = {}): Promise<AutomationRule[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.automation_rules || [])
      .filter((r: any) => String(r.seller_id) === sellerId)
      .filter((r: any) => {
        if (filter.type && String(r.type) !== filter.type) return false;
        if (filter.enabled !== undefined && Boolean(r.enabled) !== filter.enabled) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((r: any) => ({
        id: r.id,
        seller_id: r.seller_id,
        name: r.name,
        description: r.description,
        type: r.type,
        enabled: Boolean(r.enabled),
        conditions: r.conditions,
        actions: r.actions,
        schedule_cron: r.schedule_cron,
        last_run_at: r.last_run_at,
        next_run_at: r.next_run_at,
        run_count: Number(r.run_count),
        success_count: Number(r.success_count),
        failure_count: Number(r.failure_count),
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
  }

  async getAutomationRule(id: string): Promise<AutomationRule | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const r = (state.automation_rules || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      seller_id: r.seller_id,
      name: r.name,
      description: r.description,
      type: r.type,
      enabled: Boolean(r.enabled),
      conditions: r.conditions,
      actions: r.actions,
      schedule_cron: r.schedule_cron,
      last_run_at: r.last_run_at,
      next_run_at: r.next_run_at,
      run_count: Number(r.run_count),
      success_count: Number(r.success_count),
      failure_count: Number(r.failure_count),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  async addAutomationRule(rule: Omit<AutomationRule, "id">): Promise<AutomationRule> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const record: AutomationRule = {
      id: crypto.randomUUID(),
      seller_id: sellerId,
      name: rule.name,
      description: rule.description ?? null,
      type: rule.type,
      enabled: Boolean(rule.enabled),
      conditions: rule.conditions,
      actions: rule.actions,
      schedule_cron: rule.schedule_cron ?? null,
      last_run_at: null,
      next_run_at: null,
      run_count: 0,
      success_count: 0,
      failure_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.automation_rules as any[]).push(record);
    if ((state.automation_rules as any[]).length > 500) {
      (state.automation_rules as any[]).length = 500;
    }
    writeMockState(state);
    return record;
  }

  async updateAutomationRule(id: string, patch: Partial<AutomationRule>): Promise<AutomationRule> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const r = (state.automation_rules || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!r) {
      throw new Error(`Automation rule not found: ${id}`);
    }
    Object.assign(r, patch);
    r.seller_id = sellerId;
    r.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: r.id,
      seller_id: r.seller_id,
      name: r.name,
      description: r.description,
      type: r.type,
      enabled: Boolean(r.enabled),
      conditions: r.conditions,
      actions: r.actions,
      schedule_cron: r.schedule_cron,
      last_run_at: r.last_run_at,
      next_run_at: r.next_run_at,
      run_count: Number(r.run_count),
      success_count: Number(r.success_count),
      failure_count: Number(r.failure_count),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  async deleteAutomationRule(id: string): Promise<void> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const idx = (state.automation_rules || []).findIndex((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (idx === -1) {
      throw new Error(`Automation rule not found: ${id}`);
    }
    (state.automation_rules as any[]).splice(idx, 1);
    writeMockState(state);
  }

  async runAutomationRule(id: string): Promise<AutomationExecution> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const rule = (state.automation_rules || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!rule) {
      throw new Error(`Automation rule not found: ${id}`);
    }
    if (!rule.enabled) {
      throw new Error(`Automation rule is disabled: ${id}`);
    }
    const now = new Date().toISOString();
    const execution: AutomationExecution = {
      id: crypto.randomUUID(),
      rule_id: id,
      seller_id: sellerId,
      status: "completed",
      started_at: now,
      completed_at: now,
      records_processed: 1,
      result_summary: `Executed rule "${rule.name}" (type: ${rule.type}) successfully.`,
      error: null,
    };
    (state.automation_executions || []).push(execution);
    if ((state.automation_executions as any[]).length > 1000) {
      (state.automation_executions as any[]).length = 1000;
    }
    rule.last_run_at = now;
    rule.run_count = Number(rule.run_count) + 1;
    rule.success_count = Number(rule.success_count) + 1;
    writeMockState(state);
    return execution;
  }

  async getAutomationExecutions(ruleId?: string): Promise<AutomationExecution[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.automation_executions || [])
      .filter((e: any) => String(e.seller_id) === sellerId)
      .filter((e: any) => {
        if (ruleId && String(e.rule_id) !== ruleId) return false;
        return true;
      })
      .sort((a: any, b: any) => String(b.started_at).localeCompare(String(a.started_at)))
      .map((e: any) => ({
        id: e.id,
        rule_id: e.rule_id,
        seller_id: e.seller_id,
        status: e.status,
        started_at: e.started_at,
        completed_at: e.completed_at,
        records_processed: Number(e.records_processed),
        result_summary: e.result_summary,
        error: e.error,
      }));
  }

  async getNotifications(): Promise<Notification[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.notifications || [])
      .filter((n: any) => String(n.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((n: any) => ({
        id: n.id,
        seller_id: n.seller_id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: Boolean(n.read),
        related_type: n.related_type,
        related_id: n.related_id,
        created_at: n.created_at,
      }));
  }

  async getNotification(id: string): Promise<Notification | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const n = (state.notifications || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!n) {
      return null;
    }
    return {
      id: n.id,
      seller_id: n.seller_id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      related_type: n.related_type,
      related_id: n.related_id,
      created_at: n.created_at,
    };
  }

  async markNotificationRead(id: string): Promise<Notification> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const n = (state.notifications || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!n) {
      throw new Error(`Notification not found: ${id}`);
    }
    n.read = true;
    writeMockState(state);
    return {
      id: n.id,
      seller_id: n.seller_id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: true,
      related_type: n.related_type,
      related_id: n.related_id,
      created_at: n.created_at,
    };
  }

  async getAlerts(): Promise<Alert[]> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    return (state.alerts || [])
      .filter((a: any) => String(a.seller_id) === sellerId)
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((a: any) => ({
        id: a.id,
        seller_id: a.seller_id,
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        acknowledged: Boolean(a.acknowledged),
        acknowledged_at: a.acknowledged_at,
        acknowledged_by: a.acknowledged_by,
        related_type: a.related_type,
        related_id: a.related_id,
        created_at: a.created_at,
      }));
  }

  async getAlert(id: string): Promise<Alert | null> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const a = (state.alerts || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!a) {
      return null;
    }
    return {
      id: a.id,
      seller_id: a.seller_id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      acknowledged: Boolean(a.acknowledged),
      acknowledged_at: a.acknowledged_at,
      acknowledged_by: a.acknowledged_by,
      related_type: a.related_type,
      related_id: a.related_id,
      created_at: a.created_at,
    };
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<Alert> {
    const sellerId = this.requireActiveSeller();
    const state = normalizeState(readMockState());
    const a = (state.alerts || []).find((x: any) => x.id === id && String(x.seller_id) === sellerId);
    if (!a) {
      throw new Error(`Alert not found: ${id}`);
    }
    a.acknowledged = true;
    a.acknowledged_at = new Date().toISOString();
    a.acknowledged_by = acknowledgedBy;
    writeMockState(state);
    return {
      id: a.id,
      seller_id: a.seller_id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      acknowledged: true,
      acknowledged_at: a.acknowledged_at,
      acknowledged_by: a.acknowledged_by,
      related_type: a.related_type,
      related_id: a.related_id,
      created_at: a.created_at,
    };
  }


  async getOrganization(id: string): Promise<Organization | null> {
    const state = normalizeState(readMockState());
    const o = (state.organizations || []).find((x: any) => x.id === id);
    if (!o) {
      return null;
    }
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      created_at: o.created_at,
    };
  }

  async updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization> {
    const state = normalizeState(readMockState());
    const o = (state.organizations || []).find((x: any) => x.id === id);
    if (!o) {
      throw new Error(`Organization not found: ${id}`);
    }
    Object.assign(o, patch);
    writeMockState(state);
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      created_at: o.created_at,
    };
  }

  async getUser(id: string): Promise<User | null> {
    const state = normalizeState(readMockState());
    const u = (state.users || []).find((x: any) => x.id === id);
    if (!u) {
      return null;
    }
    return {
      id: u.id,
      organization_id: u.organization_id,
      email: u.email,
      name: u.name,
      role: u.role,
      is_active: Boolean(u.is_active),
      created_at: u.created_at,
    };
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const state = normalizeState(readMockState());
    const u = (state.users || []).find((x: any) => x.id === id);
    if (!u) {
      throw new Error(`User not found: ${id}`);
    }
    Object.assign(u, patch);
    writeMockState(state);
    return {
      id: u.id,
      organization_id: u.organization_id,
      email: u.email,
      name: u.name,
      role: u.role,
      is_active: Boolean(u.is_active),
      created_at: u.created_at,
    };
  }

  async getSellerAccount(id: string): Promise<SellerAccount | null> {
    const state = normalizeState(readMockState());
    const a = (state.seller_accounts || []).find((x: any) => x.id === id);
    if (!a) {
      return null;
    }
    return {
      id: a.id,
      organization_id: a.organization_id,
      merchant_id: a.merchant_id,
      marketplace_id: a.marketplace_id,
      region: a.region,
      sp_api_connected: Boolean(a.sp_api_connected),
      created_at: a.created_at,
    };
  }

  async addSellerAccount(account: Omit<SellerAccount, "id">): Promise<SellerAccount> {
    const state = normalizeState(readMockState());
    const record: SellerAccount = {
      id: crypto.randomUUID(),
      organization_id: account.organization_id,
      merchant_id: account.merchant_id,
      marketplace_id: account.marketplace_id,
      region: account.region,
      sp_api_connected: Boolean(account.sp_api_connected),
      created_at: new Date().toISOString(),
    };
    (state.seller_accounts as any[]).push(record);
    writeMockState(state);
    return record;
  }

  async updateSellerAccount(id: string, patch: Partial<SellerAccount>): Promise<SellerAccount> {
    const state = normalizeState(readMockState());
    const a = (state.seller_accounts || []).find((x: any) => x.id === id);
    if (!a) {
      throw new Error(`Seller account not found: ${id}`);
    }
    Object.assign(a, patch);
    writeMockState(state);
    return {
      id: a.id,
      organization_id: a.organization_id,
      merchant_id: a.merchant_id,
      marketplace_id: a.marketplace_id,
      region: a.region,
      sp_api_connected: Boolean(a.sp_api_connected),
      created_at: a.created_at,
    };
  }

  async deleteSellerAccount(id: string): Promise<void> {
    const state = normalizeState(readMockState());
    const idx = (state.seller_accounts || []).findIndex((x: any) => x.id === id);
    if (idx === -1) {
      throw new Error(`Seller account not found: ${id}`);
    }
    (state.seller_accounts as any[]).splice(idx, 1);
    writeMockState(state);
  }

  async getSubscriptions(): Promise<Subscription[]> {
    const state = normalizeState(readMockState());
    return (state.subscriptions || []).map((s: any) => ({
      id: s.id,
      organization_id: s.organization_id,
      plan: s.plan,
      status: s.status,
      price_usd_cents: Number(s.price_usd_cents),
      currency: s.currency,
      interval: s.interval,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      canceled_at: s.canceled_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    const state = normalizeState(readMockState());
    const s = (state.subscriptions || []).find((x: any) => x.id === id);
    if (!s) {
      return null;
    }
    return {
      id: s.id,
      organization_id: s.organization_id,
      plan: s.plan,
      status: s.status,
      price_usd_cents: Number(s.price_usd_cents),
      currency: s.currency,
      interval: s.interval,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      canceled_at: s.canceled_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  async addSubscription(subscription: Omit<Subscription, "id">): Promise<Subscription> {
    const state = normalizeState(readMockState());
    const record: Subscription = {
      id: crypto.randomUUID(),
      organization_id: subscription.organization_id,
      plan: subscription.plan,
      status: subscription.status,
      price_usd_cents: Number(subscription.price_usd_cents),
      currency: subscription.currency,
      interval: subscription.interval,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      canceled_at: subscription.canceled_at ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.subscriptions as any[]).push(record);
    writeMockState(state);
    return record;
  }

  async updateSubscription(id: string, patch: Partial<Subscription>): Promise<Subscription> {
    const state = normalizeState(readMockState());
    const s = (state.subscriptions || []).find((x: any) => x.id === id);
    if (!s) {
      throw new Error(`Subscription not found: ${id}`);
    }
    Object.assign(s, patch);
    s.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: s.id,
      organization_id: s.organization_id,
      plan: s.plan,
      status: s.status,
      price_usd_cents: Number(s.price_usd_cents),
      currency: s.currency,
      interval: s.interval,
      current_period_start: s.current_period_start,
      current_period_end: s.current_period_end,
      cancel_at_period_end: Boolean(s.cancel_at_period_end),
      canceled_at: s.canceled_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  async cancelSubscription(id: string): Promise<void> {
    const state = normalizeState(readMockState());
    const s = (state.subscriptions || []).find((x: any) => x.id === id);
    if (!s) {
      throw new Error(`Subscription not found: ${id}`);
    }
    s.status = "canceled";
    s.canceled_at = new Date().toISOString();
    s.updated_at = new Date().toISOString();
    writeMockState(state);
  }

  async getInvoices(): Promise<Invoice[]> {
    const state = normalizeState(readMockState());
    return (state.invoices || []).map((i: any) => ({
      id: i.id,
      organization_id: i.organization_id,
      subscription_id: i.subscription_id,
      invoice_number: i.invoice_number,
      status: i.status,
      amount_usd_cents: Number(i.amount_usd_cents),
      currency: i.currency,
      due_at: i.due_at,
      paid_at: i.paid_at,
      created_at: i.created_at,
    }));
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const state = normalizeState(readMockState());
    const i = (state.invoices || []).find((x: any) => x.id === id);
    if (!i) {
      return null;
    }
    return {
      id: i.id,
      organization_id: i.organization_id,
      subscription_id: i.subscription_id,
      invoice_number: i.invoice_number,
      status: i.status,
      amount_usd_cents: Number(i.amount_usd_cents),
      currency: i.currency,
      due_at: i.due_at,
      paid_at: i.paid_at,
      created_at: i.created_at,
    };
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const state = normalizeState(readMockState());
    return (state.payment_methods || []).map((p: any) => ({
      id: p.id,
      organization_id: p.organization_id,
      type: p.type,
      last4: p.last4,
      brand: p.brand,
      expiry_month: p.expiry_month,
      expiry_year: p.expiry_year,
      is_default: Boolean(p.is_default),
      created_at: p.created_at,
    }));
  }

  async addPaymentMethod(method: Omit<PaymentMethod, "id">): Promise<PaymentMethod> {
    const state = normalizeState(readMockState());
    const record: PaymentMethod = {
      id: crypto.randomUUID(),
      organization_id: method.organization_id,
      type: method.type,
      last4: method.last4 ?? null,
      brand: method.brand ?? null,
      expiry_month: method.expiry_month ?? null,
      expiry_year: method.expiry_year ?? null,
      is_default: Boolean(method.is_default),
      created_at: new Date().toISOString(),
    };
    if (record.is_default) {
      for (const p of state.payment_methods || []) {
        if (String(p.organization_id) === method.organization_id) {
          p.is_default = false;
        }
      }
    }
    (state.payment_methods as any[]).push(record);
    writeMockState(state);
    return record;
  }

  async updatePaymentMethod(id: string, patch: Partial<PaymentMethod>): Promise<PaymentMethod> {
    const state = normalizeState(readMockState());
    const p = (state.payment_methods || []).find((x: any) => x.id === id);
    if (!p) {
      throw new Error(`Payment method not found: ${id}`);
    }
    if (patch.is_default) {
      for (const pm of state.payment_methods || []) {
        if (String(pm.organization_id) === p.organization_id) {
          pm.is_default = false;
        }
      }
    }
    Object.assign(p, patch);
    writeMockState(state);
    return {
      id: p.id,
      organization_id: p.organization_id,
      type: p.type,
      last4: p.last4,
      brand: p.brand,
      expiry_month: p.expiry_month,
      expiry_year: p.expiry_year,
      is_default: Boolean(p.is_default),
      created_at: p.created_at,
    };
  }

  async deletePaymentMethod(id: string): Promise<void> {
    const state = normalizeState(readMockState());
    const idx = (state.payment_methods || []).findIndex((x: any) => x.id === id);
    if (idx === -1) {
      throw new Error(`Payment method not found: ${id}`);
    }
    (state.payment_methods as any[]).splice(idx, 1);
    writeMockState(state);
  }

  async getBillingAddresses(): Promise<BillingAddress[]> {
    const state = normalizeState(readMockState());
    return (state.billing_addresses || []).map((b: any) => ({
      id: b.id,
      organization_id: b.organization_id,
      name: b.name,
      line1: b.line1,
      line2: b.line2,
      city: b.city,
      state: b.state,
      postal_code: b.postal_code,
      country: b.country,
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));
  }

  async addBillingAddress(address: Omit<BillingAddress, "id">): Promise<BillingAddress> {
    const state = normalizeState(readMockState());
    const record: BillingAddress = {
      id: crypto.randomUUID(),
      organization_id: address.organization_id,
      name: address.name ?? null,
      line1: address.line1 ?? null,
      line2: address.line2 ?? null,
      city: address.city ?? null,
      state: address.state ?? null,
      postal_code: address.postal_code ?? null,
      country: address.country ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.billing_addresses as any[]).push(record);
    writeMockState(state);
    return record;
  }

  async updateBillingAddress(id: string, patch: Partial<BillingAddress>): Promise<BillingAddress> {
    const state = normalizeState(readMockState());
    const b = (state.billing_addresses || []).find((x: any) => x.id === id);
    if (!b) {
      throw new Error(`Billing address not found: ${id}`);
    }
    Object.assign(b, patch);
    b.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: b.id,
      organization_id: b.organization_id,
      name: b.name,
      line1: b.line1,
      line2: b.line2,
      city: b.city,
      state: b.state,
      postal_code: b.postal_code,
      country: b.country,
      created_at: b.created_at,
      updated_at: b.updated_at,
    };
  }

  async getTeamMemberships(): Promise<TeamMembership[]> {
    const state = normalizeState(readMockState());
    return (state.team_memberships || []).map((m: any) => ({
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      invited_by: m.invited_by,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      is_active: Boolean(m.is_active),
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  async addTeamMembership(membership: Omit<TeamMembership, "id">): Promise<TeamMembership> {
    const state = normalizeState(readMockState());
    const record: TeamMembership = {
      id: crypto.randomUUID(),
      organization_id: membership.organization_id,
      user_id: membership.user_id,
      role: membership.role,
      invited_by: membership.invited_by ?? null,
      invited_at: membership.invited_at ?? null,
      accepted_at: membership.accepted_at ?? null,
      is_active: Boolean(membership.is_active),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (state.team_memberships as any[]).push(record);
    writeMockState(state);
    return record;
  }

  async updateTeamMembership(id: string, patch: Partial<TeamMembership>): Promise<TeamMembership> {
    const state = normalizeState(readMockState());
    const m = (state.team_memberships || []).find((x: any) => x.id === id);
    if (!m) {
      throw new Error(`Team membership not found: ${id}`);
    }
    Object.assign(m, patch);
    m.updated_at = new Date().toISOString();
    writeMockState(state);
    return {
      id: m.id,
      organization_id: m.organization_id,
      user_id: m.user_id,
      role: m.role,
      invited_by: m.invited_by,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      is_active: Boolean(m.is_active),
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  }

  async removeTeamMembership(id: string): Promise<void> {
    const state = normalizeState(readMockState());
    const idx = (state.team_memberships || []).findIndex((x: any) => x.id === id);
    if (idx === -1) {
      throw new Error(`Team membership not found: ${id}`);
    }
    (state.team_memberships as any[]).splice(idx, 1);
    writeMockState(state);
  }

  async getBillingPlans(): Promise<BillingPlan[]> {
    const state = normalizeState(readMockState());
    return (state.billing_plans || []).map((p: any) => ({
      id: p.id,
      plan: p.plan,
      name: p.name,
      description: p.description,
      price_usd_cents: Number(p.price_usd_cents),
      currency: p.currency,
      interval: p.interval,
      max_sellers: Number(p.max_sellers),
      max_marketplaces: Number(p.max_marketplaces),
      features: p.features,
      is_active: Boolean(p.is_active),
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }
}
