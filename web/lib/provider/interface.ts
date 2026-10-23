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
  PpcData,
  Review,
  ReviewTheme,
  CatalogProfile,
  ExecutionQueueItem,
  Manager,
} from "./types";

export interface ProductProvider {
  getProducts(filter?: ProductFilter): Promise<ProductList>;
  getProduct(id: string): Promise<Product | null>;
  addProduct(product: Omit<Product, "id">): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  getProductOptimization(id: string): Promise<OptimizationStatus>;
  getDashboard(): Promise<Dashboard>;
  getSellers(): Promise<Seller[]>;
  getPurchaseOrders(): Promise<PurchaseOrder[]>;
  getOrders(): Promise<Order[]>;
  getCampaigns(): Promise<Campaign[]>;
  getSearchTerms(): Promise<SearchTerm[]>;
  getActivity(): Promise<ActivityItem[]>;
  getProductRevisions(): Promise<ProductRevision[]>;
  decidePurchaseOrder(id: string, action: "approve" | "deny"): Promise<{ order: Order }>;
  decideRevision(id: string, action: "approve" | "reject"): Promise<{ revision: ProductRevision; product: Product }>;
  syncState(): Promise<SyncState>;
  getSyncState(): Promise<SyncState>;
  getSellerStore(): Promise<SellerStoreItem[]>;
  toggleSellerStoreVisibility(id: string, visible: boolean): Promise<SellerStoreItem>;
  addToSellerStore(asin: string): Promise<SellerStoreItem>;
  getPpcData(): Promise<PpcData>;
  getReviews(): Promise<Review[]>;
  getReviewThemes(): Promise<Record<string, ReviewTheme>>;
  getCatalogProfiles(): Promise<Record<string, CatalogProfile>>;
  getExecutionQueue(): Promise<ExecutionQueueItem[]>;
  getManager(): Promise<Manager>;
}

export type DataSource = "mock" | "live";

export class LiveProviderError extends Error {
  constructor() {
    super("Live provider not configured. Set DATA_SOURCE=mock or configure live SP-API credentials.");
    this.name = "LiveProviderError";
  }
}
