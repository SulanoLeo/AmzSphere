import type {
  Dashboard,
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
  SellerStoreItem,
  PpcData,
  Review,
  ReviewTheme,
  CatalogProfile,
  ExecutionQueueItem,
  Manager,
} from "./types";

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export class ClientProductProvider {
  async getProducts(filter?: ProductFilter): Promise<ProductList> {
    const params = new URLSearchParams();
    if (filter?.opt_status) params.set("opt_status", filter.opt_status);
    if (filter?.low_stock) params.set("low_stock", "1");
    if (filter?.suppressed) params.set("suppressed", "1");
    if (filter?.search) params.set("search", filter.search);
    if (filter?.sort) params.set("sort", filter.sort);
    if (filter?.page) params.set("page", String(filter.page));
    if (filter?.page_size) params.set("page_size", String(filter.page_size));
    return json<ProductList>(`/api/products?${params.toString()}`);
  }

  async getProduct(id: string): Promise<Product | null> {
    return json<Product | null>(`/api/state`).then((state: any) => {
      const products: Product[] = state.products || [];
      return products.find((p: Product) => p.id === id || p.asin === id) ?? null;
    });
  }

  async addProduct(product: Omit<Product, "id">): Promise<Product> {
    return json<Product>("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
    return json<Product>(`/api/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getProductOptimization(id: string): Promise<OptimizationStatus> {
    return json<OptimizationStatus>(`/api/products/${encodeURIComponent(id)}/optimize`);
  }

  async getDashboard(): Promise<Dashboard> {
    return json<Dashboard>("/api/dashboard");
  }

  async getSellers(): Promise<Seller[]> {
    return json<Seller[]>("/api/sellers");
  }

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return json<PurchaseOrder[]>("/api/purchase-orders");
  }

  async getOrders(): Promise<Order[]> {
    return json<Order[]>("/api/orders");
  }

  async getCampaigns(): Promise<Campaign[]> {
    return json<Campaign[]>("/api/campaigns");
  }

  async getSearchTerms(): Promise<SearchTerm[]> {
    return json<SearchTerm[]>("/api/search-terms");
  }

  async getActivity(): Promise<ActivityItem[]> {
    return json<ActivityItem[]>("/api/activity");
  }

  async getProductRevisions(): Promise<ProductRevision[]> {
    return json<ProductRevision[]>("/api/product-revisions");
  }

  async decidePurchaseOrder(id: string, action: "approve" | "deny"): Promise<{ order: Order }> {
    return json<{ order: Order }>(`/api/purchase-orders/${encodeURIComponent(id)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  }

  async decideRevision(id: string, action: "approve" | "reject"): Promise<{ revision: ProductRevision; product: Product }> {
    return json<{ revision: ProductRevision; product: Product }>(`/api/product-revisions/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
    });
  }

  async syncState(): Promise<SyncState> {
    return json<SyncState>("/api/seller/sync", { method: "POST", body: JSON.stringify({}) });
  }

  async getSyncState(): Promise<SyncState> {
    return json<SyncState>("/api/sync-state");
  }

  async runInventoryScan(sellerId: string): Promise<any> {
    return json<any>(`/api/inventory/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seller_id: sellerId }),
    });
  }

  async getSellerStore(): Promise<SellerStoreItem[]> {
    return json<SellerStoreItem[]>("/api/seller-store");
  }

  async toggleSellerStoreVisibility(id: string, visible: boolean): Promise<SellerStoreItem> {
    return json<SellerStoreItem>(`/api/seller-store/${encodeURIComponent(id)}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    });
  }

  async addToSellerStore(asin: string): Promise<SellerStoreItem> {
    return json<SellerStoreItem>("/api/seller-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asin }),
    });
  }

  async getPpcData() {
    return json<{ campaigns: any[]; search_terms: any[]; targeted_exact_keywords: any[]; negative_keywords: any[] }>("/api/ppc");
  }

  async getReviews(): Promise<Review[]> {
    return json<Review[]>("/api/reviews");
  }

  async getReviewThemes(): Promise<Record<string, ReviewTheme>> {
    return json<Record<string, ReviewTheme>>("/api/review-themes");
  }

  async getCatalogProfiles(): Promise<Record<string, CatalogProfile>> {
    return json<Record<string, CatalogProfile>>("/api/catalog-profiles");
  }

  async getExecutionQueue(): Promise<ExecutionQueueItem[]> {
    return json<ExecutionQueueItem[]>("/api/execution-queue");
  }

  async getManager(): Promise<Manager> {
    return json<Manager>("/api/manager");
  }
}
