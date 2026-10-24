import { readMockState, writeMockState } from "@/lib/mock-state";
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
  Seller,
  SyncState,
  Dashboard,
  SellerStoreItem,
  Review,
  ReviewTheme,
  CatalogProfile,
  ExecutionQueueItem,
  Manager,
} from "./types";
import { ProductProvider } from "./interface";

const US_MARKETPLACE_ID = "ATVPDKIKX0DER";

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
  };
}

function impactRank(product: any): number {
  const score = Number(product.opt_score) || 0;
  const history: number[] = ((product.sales_history as any) || []) as number[];
  const volume = history.length > 0 ? history.slice(-7).reduce((sum, v) => sum + v, 0) : (Number(product.daily_velocity) || 0) * 7;
  return (100 - score) * volume;
}

export class MockProvider implements ProductProvider {
  async getProducts(filter: ProductFilter = {}): Promise<ProductList> {
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

    let products = [...(state.products || [])];

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
    const state = normalizeState(readMockState());
    return findProduct(state, id);
  }

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    const state = normalizeState(readMockState());
    const newProduct = { ...product, id: crypto.randomUUID() } as any;
    productDefaults(newProduct);
    const salesHistory: Record<string, number[]> = state.sales_history || {};
    const velocity = Math.round(Number(newProduct.daily_velocity) || 10);
    salesHistory[newProduct.sku] = Array(30).fill(velocity);
    state.sales_history = salesHistory;
    (state.products || []).push(newProduct);
    (state.global_products || []).push({ ...newProduct });
    writeMockState(state);
    return newProduct;
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    const state = normalizeState(readMockState());
    const product = findProduct(state, id);
    if (!product) {
      throw new Error(`Product not found: ${id}`);
    }
    Object.assign(product, patch);
    const optResult = computeOptScore(product);
    product.opt_score = optResult.score;
    product.opt_issues = optResult.issues;
    product.opt_status = optResult.status;
    product.last_optimized_at = new Date().toISOString();
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

  async getDashboard(): Promise<Dashboard> {
    const state = normalizeState(readMockState());
    const salesHistory: Record<string, number[]> = state.sales_history || {};

    const products = (state.products || []).map((p: any) => toDashboardProduct(p, salesHistory));
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

    return {
      seller_id: "mock-seller",
      marketplace_id: US_MARKETPLACE_ID,
      products,
      pending_purchase_orders: pendingPurchaseOrders,
      sync_status: syncState.status,
      last_synced_at: syncState.completed_at || null,
      needs_optimization_count: needsOptimizationCount,
      top_10_by_impact: top10,
    };
  }

  async getSellers(): Promise<Seller[]> {
    return [{ id: "mock-seller", merchant_id: "Mock Seller", marketplace_id: US_MARKETPLACE_ID, region: "us-east-1" }];
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const state = normalizeState(readMockState());
    return (state.purchase_orders || []).map((po: any) => ({
      id: po.id,
      product_asin: po.product_asin,
      product_name: po.product_name,
      supplier: po.supplier,
      units: Number(po.units),
      status: po.status,
      created_at: po.created_at,
    }));
  }

  async getOrders(): Promise<Order[]> {
    const state = normalizeState(readMockState());
    return (state.orders || []).map((o: any) => ({
      id: o.id,
      product_name: o.product_name,
      supplier: o.supplier,
      amount: Number(o.amount),
      units: Number(o.units),
      status: o.status,
      reviewed_by: o.reviewed_by,
      reviewed_at: o.reviewed_at,
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
    const state = normalizeState(readMockState());
    const order = (state.orders || []).find((o: any) => o.id === id);
    if (!order) {
      throw new Error(`Order not found: ${id}`);
    }
    if (order.status !== "pending") {
      throw new Error("This workflow has already been reviewed");
    }
    order.status = action === "approve" ? "approved" : "denied";
    order.reviewed_by = "mock@amzsphere.local";
    order.reviewed_at = new Date().toISOString();

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
    const state = normalizeState(readMockState());
    const revision = (state.product_revisions || []).find((r: any) => r.id === id);
    if (!revision) {
      throw new Error(`Revision not found: ${id}`);
    }
    if (revision.status !== "pending_approval") {
      throw new Error("This revision has already been reviewed");
    }
    const product = findProduct(state, revision.product_id);
    if (!product) {
      throw new Error(`Product not found: ${revision.product_id}`);
    }
    const now = new Date().toISOString();
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
    writeMockState(state);
    return { revision: { ...revision }, product: { ...product } };
  }

  async syncState(): Promise<SyncState> {
    const state = normalizeState(readMockState());
    const operationId = crypto.randomUUID();
    const started = new Date().toISOString();
    state.sync_state = { status: "running", operation_id: operationId, started_at: started } as any;

    const catalog: any[] = (state.amazon_catalog || []).map((entry: any) => ({
      asin: entry.asin,
      marketplace_id: entry.marketplace_id || US_MARKETPLACE_ID,
      ...entry,
    }));
    let synced = 0;
    for (const entry of catalog) {
      const asin = entry.asin;
      const marketplaceId = entry.marketplace_id || US_MARKETPLACE_ID;
      const product = (state.products || []).find(
        (p: any) => p.asin === asin && p.marketplace_id === marketplaceId,
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

  async getReviews(): Promise<Review[]> {
    const state = normalizeState(readMockState());
    return (state.reviews || []).map((r: any) => ({
      id: r.id,
      product: r.product,
      rating: Number(r.rating),
      date: r.date,
      theme: r.theme,
      text: r.text,
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
}
