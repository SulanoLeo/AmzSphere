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

export interface ProductProvider {
  getProducts(filter?: ProductFilter): Promise<ProductList>;
  getProduct(id: string): Promise<Product | null>;
  addProduct(product: Omit<Product, "id">): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product>;
  getProductVariations(parentAsin: string): Promise<Product[]>;
  getProductOptimization(id: string): Promise<OptimizationStatus>;
  getListingVersions(productId: string): Promise<ListingVersion[]>;
  createListingVersion(productId: string, snapshot: Record<string, unknown>, changedBy: string, changeSummary: string[]): Promise<ListingVersion>;
  getDashboard(): Promise<Dashboard>;
  getSellers(): Promise<Seller[]>;
  getSellerAccounts(): Promise<SellerAccount[]>;
  setActiveSeller(sellerId: string): void;
  getActiveSeller(): string | null;
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
  getOrganizations(): Promise<Organization[]>;
  getUsers(): Promise<User[]>;
  getAuditLogs(): Promise<AuditLogEntry[]>;
  getSyncJobs(): Promise<SyncJob[]>;
  getFinancialRecords(periodStart?: string, periodEnd?: string): Promise<FinancialRecord[]>;
  getProfitability(periodStart?: string, periodEnd?: string): Promise<ProfitabilitySummary>;
  getKeywords(): Promise<Keyword[]>;
  addKeyword(keyword: Omit<Keyword, "id">): Promise<Keyword>;
  getKeywordRanks(keywordId?: string, asin?: string): Promise<KeywordRankHistory[]>;
  recordKeywordRank(keywordId: string, asin: string, rank: number): Promise<KeywordRankHistory>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  addSupplier(supplier: Omit<Supplier, "id">): Promise<Supplier>;
  updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier>;
  getLandedCost(asin: string): Promise<LandedCost | null>;
  setLandedCost(asin: string, patch: Partial<LandedCost>): Promise<LandedCost>;
  getCompetitorProducts(asin?: string): Promise<CompetitorProduct[]>;
  addCompetitorProduct(product: Omit<CompetitorProduct, "id">): Promise<CompetitorProduct>;
  getCompetitorObservations(productAsin?: string): Promise<CompetitorObservation[]>;
  recordCompetitorObservation(productAsin: string, competitorAsin: string, competitorPrice: number): Promise<CompetitorObservation>;
  getFeaturedOffer(asin: string): Promise<FeaturedOffer | null>;
  recordFeaturedOffer(asin: string, isBuyBoxWinner: boolean, offerPrice: number, lowestPrice: number): Promise<FeaturedOffer>;
  getReviews(filter?: { product?: string; asin?: string; minRating?: number; maxRating?: number; theme?: string }): Promise<Review[]>;
  respondToReview(reviewId: string, response: string): Promise<Review>;
  getReturnRequests(): Promise<ReturnRequest[]>;
  getReturnRequest(id: string): Promise<ReturnRequest | null>;
  updateReturnRequest(id: string, patch: Partial<ReturnRequest>): Promise<ReturnRequest>;
  getPromotions(): Promise<Promotion[]>;
  getPromotion(id: string): Promise<Promotion | null>;
  addPromotion(promotion: Omit<Promotion, "id">): Promise<Promotion>;
  updatePromotion(id: string, patch: Partial<Promotion>): Promise<Promotion>;
  getCoupons(): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | null>;
  addCoupon(coupon: Omit<Coupon, "id">): Promise<Coupon>;
  updateCoupon(id: string, patch: Partial<Coupon>): Promise<Coupon>;
  getReports(): Promise<Report[]>;
  getReport(id: string): Promise<Report | null>;
  addReport(report: Omit<Report, "id">): Promise<Report>;
  getReportExecutions(reportId?: string): Promise<ReportExecution[]>;
  getExports(): Promise<Export[]>;
  getExport(id: string): Promise<Export | null>;
  addExport(exportItem: Omit<Export, "id">): Promise<Export>;
  getForecasts(): Promise<Forecast[]>;
  getForecast(id: string): Promise<Forecast | null>;
  addForecast(forecast: Omit<Forecast, "id">): Promise<Forecast>;
  getForecastPoints(forecastId: string): Promise<ForecastPoint[]>;
  getForecastScenarios(forecastId: string): Promise<ForecastScenario[]>;
  getAIRecommendations(filter?: { type?: string; status?: string }): Promise<AIRecommendation[]>;
  getAIRecommendation(id: string): Promise<AIRecommendation | null>;
  createAIRecommendation(recommendation: Omit<AIRecommendation, "id">): Promise<AIRecommendation>;
  updateAIRecommendation(id: string, patch: Partial<AIRecommendation>): Promise<AIRecommendation>;
  generateAIRecommendations(context?: Record<string, unknown>): Promise<AIRecommendation[]>;
  getAIConversations(): Promise<AIConversation[]>;
  getAIConversation(id: string): Promise<AIConversation | null>;
  addAIMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<AIMessage>;
  getAIMessages(conversationId: string): Promise<AIMessage[]>;
  getAutomationRules(filter?: { type?: string; enabled?: boolean }): Promise<AutomationRule[]>;
  getAutomationRule(id: string): Promise<AutomationRule | null>;
  addAutomationRule(rule: Omit<AutomationRule, "id">): Promise<AutomationRule>;
  updateAutomationRule(id: string, patch: Partial<AutomationRule>): Promise<AutomationRule>;
  deleteAutomationRule(id: string): Promise<void>;
  runAutomationRule(id: string): Promise<AutomationExecution>;
  getAutomationExecutions(ruleId?: string): Promise<AutomationExecution[]>;
  getNotifications(): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | null>;
  markNotificationRead(id: string): Promise<Notification>;
  getAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | null>;
  acknowledgeAlert(id: string, acknowledgedBy: string): Promise<Alert>;
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, patch: Partial<Organization>): Promise<Organization>;
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;
  getSellerAccounts(): Promise<SellerAccount[]>;
  getSellerAccount(id: string): Promise<SellerAccount | null>;
  addSellerAccount(account: Omit<SellerAccount, "id">): Promise<SellerAccount>;
  updateSellerAccount(id: string, patch: Partial<SellerAccount>): Promise<SellerAccount>;
  deleteSellerAccount(id: string): Promise<void>;
  getSubscriptions(): Promise<Subscription[]>;
  getSubscription(id: string): Promise<Subscription | null>;
  addSubscription(subscription: Omit<Subscription, "id">): Promise<Subscription>;
  updateSubscription(id: string, patch: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(id: string): Promise<void>;
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | null>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  addPaymentMethod(method: Omit<PaymentMethod, "id">): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, patch: Partial<PaymentMethod>): Promise<PaymentMethod>;
  deletePaymentMethod(id: string): Promise<void>;
  getBillingAddresses(): Promise<BillingAddress[]>;
  addBillingAddress(address: Omit<BillingAddress, "id">): Promise<BillingAddress>;
  updateBillingAddress(id: string, patch: Partial<BillingAddress>): Promise<BillingAddress>;
  getTeamMemberships(): Promise<TeamMembership[]>;
  addTeamMembership(membership: Omit<TeamMembership, "id">): Promise<TeamMembership>;
  updateTeamMembership(id: string, patch: Partial<TeamMembership>): Promise<TeamMembership>;
  removeTeamMembership(id: string): Promise<void>;
  getBillingPlans(): Promise<BillingPlan[]>;
}

export type DataSource = "mock" | "live";

export class LiveProviderError extends Error {
  constructor() {
    super("Live provider not configured. Set DATA_SOURCE=mock or configure live SP-API credentials.");
    this.name = "LiveProviderError";
  }
}
