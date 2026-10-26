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
  ListingVersion,
  Seller,
  SyncState,
  SellerStoreItem,
  PpcData,
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

  async getReviews(filter: { product?: string; asin?: string; minRating?: number; maxRating?: number; theme?: string } = {}): Promise<Review[]> {
    const params = new URLSearchParams();
    if (filter.product) params.set("product", filter.product);
    if (filter.asin) params.set("asin", filter.asin);
    if (filter.minRating !== undefined) params.set("min_rating", String(filter.minRating));
    if (filter.maxRating !== undefined) params.set("max_rating", String(filter.maxRating));
    if (filter.theme) params.set("theme", filter.theme);
    return json<Review[]>(`/api/reviews?${params.toString()}`);
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

  async getFinancialRecords(periodStart?: string, periodEnd?: string): Promise<FinancialRecord[]> {
    const params = new URLSearchParams();
    if (periodStart) params.set("period_start", periodStart);
    if (periodEnd) params.set("period_end", periodEnd);
    return json<FinancialRecord[]>(`/api/financials?${params.toString()}`);
  }

  async getProfitability(periodStart?: string, periodEnd?: string): Promise<ProfitabilitySummary> {
    const params = new URLSearchParams();
    if (periodStart) params.set("period_start", periodStart);
    if (periodEnd) params.set("period_end", periodEnd);
    const dashboard = await json<{ profitability: ProfitabilitySummary }>(`/api/dashboard?${params.toString()}`);
    return dashboard.profitability;
  }

  async getKeywords(): Promise<Keyword[]> {
    return json<Keyword[]>("/api/keywords");
  }

  async addKeyword(keyword: Omit<Keyword, "id">): Promise<Keyword> {
    return json<Keyword>("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keyword),
    });
  }

  async getKeywordRanks(keywordId?: string, asin?: string): Promise<KeywordRankHistory[]> {
    const params = new URLSearchParams();
    if (keywordId) params.set("keyword_id", keywordId);
    if (asin) params.set("asin", asin);
    return json<KeywordRankHistory[]>(`/api/keywords/ranks?${params.toString()}`);
  }

  async recordKeywordRank(keywordId: string, asin: string, rank: number): Promise<KeywordRankHistory> {
    return json<KeywordRankHistory>("/api/keywords/ranks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword_id: keywordId, asin, rank }),
    });
  }

  async getSuppliers(): Promise<Supplier[]> {
    return json<Supplier[]>("/api/suppliers");
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    return json<Supplier | null>(`/api/suppliers/${encodeURIComponent(id)}`);
  }

  async addSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier> {
    return json<Supplier>("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(supplier),
    });
  }

  async updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
    return json<Supplier>(`/api/suppliers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getLandedCost(asin: string): Promise<LandedCost | null> {
    return json<LandedCost | null>(`/api/landed-cost/${encodeURIComponent(asin)}`);
  }

  async setLandedCost(asin: string, patch: Partial<LandedCost>): Promise<LandedCost> {
    return json<LandedCost>(`/api/landed-cost/${encodeURIComponent(asin)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getCompetitorProducts(asin?: string): Promise<CompetitorProduct[]> {
    const params = new URLSearchParams();
    if (asin) params.set("asin", asin);
    return json<CompetitorProduct[]>(`/api/competitors/products?${params.toString()}`);
  }

  async addCompetitorProduct(product: Omit<CompetitorProduct, "id">): Promise<CompetitorProduct> {
    return json<CompetitorProduct>("/api/competitors/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
  }

  async getCompetitorObservations(productAsin?: string): Promise<CompetitorObservation[]> {
    const params = new URLSearchParams();
    if (productAsin) params.set("product_asin", productAsin);
    return json<CompetitorObservation[]>(`/api/competitors/observations?${params.toString()}`);
  }

  async recordCompetitorObservation(productAsin: string, competitorAsin: string, competitorPrice: number): Promise<CompetitorObservation> {
    return json<CompetitorObservation>("/api/competitors/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_asin: productAsin, competitor_asin: competitorAsin, competitor_price: competitorPrice }),
    });
  }

  async getFeaturedOffer(asin: string): Promise<FeaturedOffer | null> {
    return json<FeaturedOffer | null>(`/api/featured-offers/${encodeURIComponent(asin)}`);
  }

  async recordFeaturedOffer(asin: string, isBuyBoxWinner: boolean, offerPrice: number, lowestPrice: number): Promise<FeaturedOffer> {
    return json<FeaturedOffer>(`/api/featured-offers/${encodeURIComponent(asin)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_buy_box_winner: isBuyBoxWinner, offer_price: offerPrice, lowest_price: lowestPrice }),
    });
  }

  async respondToReview(reviewId: string, response: string): Promise<Review> {
    return json<Review>(`/api/reviews/${encodeURIComponent(reviewId)}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response }),
    });
  }

  async getReturnRequests(): Promise<ReturnRequest[]> {
    return json<ReturnRequest[]>("/api/returns");
  }

  async getReturnRequest(id: string): Promise<ReturnRequest | null> {
    return json<ReturnRequest | null>(`/api/returns/${encodeURIComponent(id)}`);
  }

  async updateReturnRequest(id: string, patch: Partial<ReturnRequest>): Promise<ReturnRequest> {
    return json<ReturnRequest>(`/api/returns/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getPromotions(): Promise<Promotion[]> {
    return json<Promotion[]>("/api/promotions");
  }

  async getPromotion(id: string): Promise<Promotion | null> {
    return json<Promotion | null>(`/api/promotions/${encodeURIComponent(id)}`);
  }

  async addPromotion(promotion: Omit<Promotion, "id">): Promise<Promotion> {
    return json<Promotion>("/api/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promotion),
    });
  }

  async updatePromotion(id: string, patch: Partial<Promotion>): Promise<Promotion> {
    return json<Promotion>(`/api/promotions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getCoupons(): Promise<Coupon[]> {
    return json<Coupon[]>("/api/coupons");
  }

  async getCoupon(id: string): Promise<Coupon | null> {
    return json<Coupon | null>(`/api/coupons/${encodeURIComponent(id)}`);
  }

  async addCoupon(coupon: Omit<Coupon, "id">): Promise<Coupon> {
    return json<Coupon>("/api/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coupon),
    });
  }

  async updateCoupon(id: string, patch: Partial<Coupon>): Promise<Coupon> {
    return json<Coupon>(`/api/coupons/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getReports(): Promise<Report[]> {
    return json<Report[]>("/api/reports");
  }

  async getReport(id: string): Promise<Report | null> {
    return json<Report | null>(`/api/reports/${encodeURIComponent(id)}`);
  }

  async addReport(report: Omit<Report, "id">): Promise<Report> {
    return json<Report>("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
  }

  async getReportExecutions(reportId?: string): Promise<ReportExecution[]> {
    const params = new URLSearchParams();
    if (reportId) params.set("report_id", reportId);
    return json<ReportExecution[]>(`/api/reports/executions?${params.toString()}`);
  }

  async getExports(): Promise<Export[]> {
    return json<Export[]>("/api/exports");
  }

  async getExport(id: string): Promise<Export | null> {
    return json<Export | null>(`/api/exports/${encodeURIComponent(id)}`);
  }

  async addExport(exportItem: Omit<Export, "id">): Promise<Export> {
    return json<Export>("/api/exports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(exportItem),
    });
  }

  async getForecasts(): Promise<Forecast[]> {
    return json<Forecast[]>("/api/forecasts");
  }

  async getForecast(id: string): Promise<Forecast | null> {
    return json<Forecast | null>(`/api/forecasts/${encodeURIComponent(id)}`);
  }

  async addForecast(forecast: Omit<Forecast, "id">): Promise<Forecast> {
    return json<Forecast>("/api/forecasts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forecast),
    });
  }

  async getForecastPoints(forecastId: string): Promise<ForecastPoint[]> {
    return json<ForecastPoint[]>(`/api/forecasts/${encodeURIComponent(forecastId)}/points`);
  }

  async getForecastScenarios(forecastId: string): Promise<ForecastScenario[]> {
    return json<ForecastScenario[]>(`/api/forecasts/${encodeURIComponent(forecastId)}/scenarios`);
  }

  async getAIRecommendations(filter: { type?: string; status?: string } = {}): Promise<AIRecommendation[]> {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.status) params.set("status", filter.status);
    return json<AIRecommendation[]>(`/api/ai/recommendations?${params.toString()}`);
  }

  async getAIRecommendation(id: string): Promise<AIRecommendation | null> {
    return json<AIRecommendation | null>(`/api/ai/recommendations/${encodeURIComponent(id)}`);
  }

  async createAIRecommendation(recommendation: Omit<AIRecommendation, "id">): Promise<AIRecommendation> {
    return json<AIRecommendation>("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recommendation),
    });
  }

  async updateAIRecommendation(id: string, patch: Partial<AIRecommendation>): Promise<AIRecommendation> {
    return json<AIRecommendation>(`/api/ai/recommendations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async generateAIRecommendations(context: Record<string, unknown> = {}): Promise<AIRecommendation[]> {
    return json<AIRecommendation[]>("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context }),
    });
  }

  async getAIConversations(): Promise<AIConversation[]> {
    return json<AIConversation[]>("/api/ai/conversations");
  }

  async getAIConversation(id: string): Promise<AIConversation | null> {
    return json<AIConversation | null>(`/api/ai/conversations/${encodeURIComponent(id)}`);
  }

  async addAIMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<AIMessage> {
    return json<AIMessage>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    });
  }

  async getAIMessages(conversationId: string): Promise<AIMessage[]> {
    return json<AIMessage[]>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`);
  }

  async getAutomationRules(): Promise<AutomationRule[]> {
    return json<AutomationRule[]>("/api/automation/rules");
  }

  async getAutomationRule(id: string): Promise<AutomationRule | null> {
    return json<AutomationRule | null>(`/api/automation/rules/${encodeURIComponent(id)}`);
  }

  async addAutomationRule(rule: Omit<AutomationRule, "id">): Promise<AutomationRule> {
    return json<AutomationRule>("/api/automation/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
  }

  async updateAutomationRule(id: string, patch: Partial<AutomationRule>): Promise<AutomationRule> {
    return json<AutomationRule>(`/api/automation/rules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async deleteAutomationRule(id: string): Promise<void> {
    return json<void>(`/api/automation/rules/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async runAutomationRule(id: string): Promise<AutomationExecution> {
    return json<AutomationExecution>(`/api/automation/rules/${encodeURIComponent(id)}/run`, {
      method: "POST",
    });
  }

  async getAutomationExecutions(ruleId?: string): Promise<AutomationExecution[]> {
    const params = new URLSearchParams();
    if (ruleId) params.set("rule_id", ruleId);
    return json<AutomationExecution[]>(`/api/automation/executions?${params.toString()}`);
  }

  async getNotifications(): Promise<Notification[]> {
    return json<Notification[]>("/api/notifications");
  }

  async getNotification(id: string): Promise<Notification | null> {
    return json<Notification | null>(`/api/notifications/${encodeURIComponent(id)}`);
  }

  async markNotificationRead(id: string): Promise<Notification> {
    return json<Notification>(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: "POST",
    });
  }

  async getAlerts(): Promise<Alert[]> {
    return json<Alert[]>("/api/alerts");
  }

  async getAlert(id: string): Promise<Alert | null> {
    return json<Alert | null>(`/api/alerts/${encodeURIComponent(id)}`);
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<Alert> {
    return json<Alert>(`/api/alerts/${encodeURIComponent(id)}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    });
  }

  async getOrganizations(): Promise<Organization[]> {
    return json<Organization[]>("/api/saas/organizations");
  }

  async getOrganization(id: string): Promise<Organization | null> {
    return json<Organization | null>(`/api/saas/organizations/${encodeURIComponent(id)}`);
  }

  async updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization> {
    return json<Organization>(`/api/saas/organizations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getUsers(): Promise<User[]> {
    return json<User[]>("/api/saas/users");
  }

  async getUser(id: string): Promise<User | null> {
    return json<User | null>(`/api/saas/users/${encodeURIComponent(id)}`);
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    return json<User>(`/api/saas/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getSellerAccounts(): Promise<SellerAccount[]> {
    return json<SellerAccount[]>("/api/saas/seller-accounts");
  }

  async getSellerAccount(id: string): Promise<SellerAccount | null> {
    return json<SellerAccount | null>(`/api/saas/seller-accounts/${encodeURIComponent(id)}`);
  }

  async addSellerAccount(account: Omit<SellerAccount, "id">): Promise<SellerAccount> {
    return json<SellerAccount>("/api/saas/seller-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account),
    });
  }

  async updateSellerAccount(id: string, patch: Partial<SellerAccount>): Promise<SellerAccount> {
    return json<SellerAccount>(`/api/saas/seller-accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async deleteSellerAccount(id: string): Promise<void> {
    return json<void>(`/api/saas/seller-accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async getSubscriptions(): Promise<Subscription[]> {
    return json<Subscription[]>("/api/saas/subscriptions");
  }

  async getSubscription(id: string): Promise<Subscription | null> {
    return json<Subscription | null>(`/api/saas/subscriptions/${encodeURIComponent(id)}`);
  }

  async addSubscription(subscription: Omit<Subscription, "id">): Promise<Subscription> {
    return json<Subscription>("/api/saas/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
  }

  async updateSubscription(id: string, patch: Partial<Subscription>): Promise<Subscription> {
    return json<Subscription>(`/api/saas/subscriptions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async cancelSubscription(id: string): Promise<void> {
    return json<void>(`/api/saas/subscriptions/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
    });
  }

  async getInvoices(): Promise<Invoice[]> {
    return json<Invoice[]>("/api/saas/invoices");
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    return json<Invoice | null>(`/api/saas/invoices/${encodeURIComponent(id)}`);
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return json<PaymentMethod[]>("/api/saas/payment-methods");
  }

  async addPaymentMethod(method: Omit<PaymentMethod, "id">): Promise<PaymentMethod> {
    return json<PaymentMethod>("/api/saas/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method),
    });
  }

  async updatePaymentMethod(id: string, patch: Partial<PaymentMethod>): Promise<PaymentMethod> {
    return json<PaymentMethod>(`/api/saas/payment-methods/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async deletePaymentMethod(id: string): Promise<void> {
    return json<void>(`/api/saas/payment-methods/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async getBillingAddresses(): Promise<BillingAddress[]> {
    return json<BillingAddress[]>("/api/saas/billing-addresses");
  }

  async addBillingAddress(address: Omit<BillingAddress, "id">): Promise<BillingAddress> {
    return json<BillingAddress>("/api/saas/billing-addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
  }

  async updateBillingAddress(id: string, patch: Partial<BillingAddress>): Promise<BillingAddress> {
    return json<BillingAddress>(`/api/saas/billing-addresses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async getTeamMemberships(): Promise<TeamMembership[]> {
    return json<TeamMembership[]>("/api/saas/team-memberships");
  }

  async addTeamMembership(membership: Omit<TeamMembership, "id">): Promise<TeamMembership> {
    return json<TeamMembership>("/api/saas/team-memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(membership),
    });
  }

  async updateTeamMembership(id: string, patch: Partial<TeamMembership>): Promise<TeamMembership> {
    return json<TeamMembership>(`/api/saas/team-memberships/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async removeTeamMembership(id: string): Promise<void> {
    return json<void>(`/api/saas/team-memberships/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async getBillingPlans(): Promise<BillingPlan[]> {
    return json<BillingPlan[]>("/api/saas/billing-plans");
  }
}
