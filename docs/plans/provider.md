# Provider Unification Plan — AmzSphere

Goal: Route all UI data through a single provider interface so mock and future live Amazon integration share the same code path. Mock data only; no real credentials. Swap providers via `DATA_SOURCE=mock|live`, not by rewriting pages.

Key flow to protect: Centralized product list → add product → optimize product. Changes must show on every page that displays products (list, dashboard, optimization views), and the dashboard must flag which products need optimization.

Architecture notes:
- Server Components (inventory, approvals, seller-store, ppc, repricer, activity, how) can use the server-side provider directly.
- Client Components (dashboard, catalog, sourcing) need a client-side provider adapter that wraps fetch calls to API routes — components call `provider.getProducts()`, not `fetch()` directly.
- API routes will be refactored to delegate to the provider instead of reading mock-state directly.
- `mock-state.ts` caches in-memory only; changes don't persist across serverless invocations. This is acceptable for mock review; the provider interface abstracts this away.

## Item 1 — Define product types/schemas in one shared file ✅ DONE

Files to touch: `web/lib/provider/types.ts` (new)

What to do:
- Define `Product` type matching mock_db.json product shape (id, asin, sku, marketplace_id, source, name, title, category, price, bullets[], description, backend_keywords[], images[], sellable_units, stock, days_of_supply, daily_velocity, competitor_price, market_price, min_floor, max_price, unit_cost, lead_time_days, supplier, po_draft_id, suppressed, last_synced_at, sync_status, last_optimized_at, opt_score, opt_issues[], opt_status).
- Define `ProductList` (paginated response), `OptimizationStatus` (opt_score, opt_issues, opt_status), `ProductFilter` (opt_status, low_stock, suppressed, search, sort, page, page_size).
- Export all types.

Acceptance check: `tsc --noEmit` passes; types compile and are importable.

## Item 2 — Define the provider interface ✅ DONE

Files to touch: `web/lib/provider/interface.ts` (new)

What to do:
- Define `ProductProvider` interface (abstract class or interface) with methods:
  - `getProducts(filter?): Promise<ProductList>`
  - `getProduct(id: string): Promise<Product | null>`
  - `addProduct(product: Partial<Product>): Promise<Product>`
  - `updateProduct(id: string, patch: Partial<Product>): Promise<Product>`
  - `getProductOptimization(id: string): Promise<OptimizationStatus>`
- Define `DataSource` enum/type: `"mock" | "live"`.
- Do NOT implement logic yet — just the interface.

Acceptance check: `tsc --noEmit` passes; interface is exported and type-checks.

## Item 3 — Implement MockProvider ✅ DONE

Files to touch: `web/lib/provider/mock.ts` (new)

What to do:
- Implement `MockProvider` implementing `ProductProvider`.
- Use existing `readMockState`/`writeMockState` from `@/lib/mock-state` and scoring functions from `@/lib/scoring`.
- `getProducts` — read state, apply filters/pagination/sort (same logic as current `web/app/api/products/route.ts`).
- `getProduct` — find by id or asin.
- `addProduct` — generate id, normalize defaults, append to state.products, write state.
- `updateProduct` — find product, apply patch, recompute opt_score via scoring.ts, write state.
- `getProductOptimization` — compute score/issues/status via scoring.ts.

Acceptance check: `tsc --noEmit` passes; `getProducts()` returns all 30 products from mock_db.json; `addProduct` + `getProduct` round-trips.

## Item 4 — Add DATA_SOURCE env var + provider factory ✅ DONE

Files to touch: `web/lib/provider/factory.ts` (new), `.env.example` (edit)

What to do:
- Add `DATA_SOURCE=mock` to `.env.example`.
- Create `createProductProvider()` factory that reads `process.env.DATA_SOURCE`.
- `mock` → return `MockProvider`.
- `live` → return `LiveProvider` stub that throws `"Live provider not configured. Set DATA_SOURCE=mock or configure live SP-API credentials."`
- Export `getProductProvider()` singleton helper.

Acceptance check: `tsc --noEmit` passes; `DATA_SOURCE=mock` returns MockProvider; `DATA_SOURCE=live` throws clear error on instantiation.

## Item 5 — Move Dashboard page to provider ✅ DONE

Files to touch: `web/app/page.tsx`

What to do:
- Replace hardcoded `mockDashboard` and direct `fetch` calls with provider calls.
- Since page.tsx is `"use client"`, use a client-side provider adapter that calls API routes (or convert to Server Component if feasible).
- Products come from `provider.getProducts()`. Dashboard computes `needs_optimization_count`, `top_10_by_impact` from provider data.
- Remove `USE_MOCK_DATA` flag and hardcoded mock data.
- Sellers and access still come from API routes (those are already mocked).

Acceptance check: `tsc --noEmit` passes; `next build` passes; dashboard loads products via provider; dashboard flags products needing optimization.

## Item 6 — Move Catalog page to provider ✅ DONE

Files to touch: `web/app/catalog/page.tsx`

What to do:
- Replace hardcoded `mockProducts` with `provider.getProducts()`.
- Replace empty optimize drawer with real product data from provider.
- "Add product" form submits to `provider.addProduct()`.
- "Send to approval" calls `provider.updateProduct()` to set opt_status.
- Table shows real opt_score/opt_status from provider.

Acceptance check: `tsc --noEmit` passes; `next build` passes; catalog table populated from provider; add product shows in table.

## Item 7 — Move Inventory page to provider ✅ DONE

Files to touch: `web/app/inventory/page.tsx`

What to do:
- Replace empty `products = []` and `purchaseOrders = []` with `provider.getProducts()` and `provider.getPurchaseOrders()`.
- Display real stock, days_of_supply, opt_status, po_draft_id from provider data.

Acceptance check: `tsc --noEmit` passes; `next build` passes; inventory table shows products from provider.

## Item 8 — Move Approvals page to provider ✅ DONE

Files to touch: `web/app/approvals/page.tsx`

What to do:
- Replace empty `revisions = []` with `provider.getProductRevisions()`.
- Replace empty `orders = []` with `provider.getPurchaseOrders()`.
- Approve/Reject buttons call `provider.decidePurchaseOrder()` / `provider.approveRevision()` / `provider.rejectRevision()`.

Acceptance check: `tsc --noEmit` passes; `next build` passes; approvals page shows provider data.

## Item 9 — Move Seller Store page to provider ✅ DONE

Files to touch: `web/app/seller-store/page.tsx`

What to do:
- Replace empty `sellerStore = []` with `provider.getSellerStore()`.
- Replace empty `catalogNotAdded = []` with products from provider not in seller store.
- Add product button calls `provider.addToSellerStore()`.
- Visibility toggle calls `provider.toggleSellerStoreVisibility()`.

Acceptance check: `tsc --noEmit` passes; `next build` passes; seller store page shows provider data.

## Item 10 — Move PPC page to provider ✅ DONE

Files to touch: `web/app/ppc/page.tsx`

What to do:
- Replace empty arrays with `provider.getSearchTerms()`, `provider.getCampaigns()`, etc.
- Show real ACoS, spend, clicks from provider data.

Acceptance check: `tsc --noEmit` passes; `next build` passes; PPC page shows provider data.

## Item 11 — Move Repricer page to provider ✅ DONE

Files to touch: `web/app/repricer/page.tsx`

What to do:
- Replace empty `products = []` with `provider.getProducts()` (pricing-relevant fields).
- Show real price, competitor_price, min_floor from provider.

Acceptance check: `tsc --noEmit` passes; `next build` passes; repricer page shows provider data.

## Item 12 — Move Activity page to provider ✅ DONE

Files to touch: `web/app/activity/page.tsx`

What to do:
- Replace empty `items = []` with `provider.getActivity()`.
- Show real activity log entries from provider.

Acceptance check: `tsc --noEmit` passes; `next build` passes; activity page shows provider data.

## Item 13 — Move Sourcing page to provider ✅ DONE

Files to touch: `web/app/sourcing/page.tsx`, `web/context/ProductContext.tsx`

What to do:
- Replace `useProduct()` local state with provider-backed product data.
- `updateSourcing` calls `provider.updateProduct()`.
- `pushChangesSync` persists via provider.
- StorefrontView, BuyBoxStatus, MetricsPanel get data from provider context.

Acceptance check: `tsc --noEmit` passes; `next build` passes; sourcing page reads/writes via provider.

## Item 14 — Repeat for inventory, orders, ads data types ✅ DONE

Files to touch: `web/lib/provider/types.ts` (extend), `web/lib/provider/interface.ts` (extend), `web/lib/provider/mock.ts` (extend), affected pages/API routes

What to do:
- Add types for orders, purchase orders, campaigns, search terms, activity, revisions.
- Extend provider interface with `getOrders`, `getPurchaseOrders`, `getCampaigns`, `getSearchTerms`, `getActivity`, `decidePurchaseOrder`, etc.
- Implement in MockProvider.
- Update remaining API routes to delegate to provider.

Acceptance check: `tsc --noEmit` passes; `next build` passes; all data flows through provider.

STOP — waiting for approval before starting Item 1.
