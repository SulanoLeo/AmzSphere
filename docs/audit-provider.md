# Provider Audit — AmzSphere Data Flow

## 1. Places where UI code fetches data directly or hardcodes data

### `web/app/page.tsx` (Dashboard)
- **Fetch calls (client-side):**
  - `GET /api/dashboard?seller_id=...` → dashboard data (products, top_10_by_impact, pending_purchase_orders, sync_status, needs_optimization_count)
  - `GET /api/sellers` → seller list
  - `GET /api/access` → isApprover flag
  - `POST /api/purchase-orders/{id}/decision` → approve/deny PO
  - `POST /api/seller/sync` → sync seller
  - `POST /api/inventory/scan` → run inventory scan
- **Hardcoded data:**
  - `mockDashboard` constant (5 products with `stock`, `velocity_7d/30d/90d`, `days_supply`, `reorder_flag`, `opt_score`, `opt_status`, `needs_optimization`) — different shape from mock_db.json products
  - `mockSellers` fallback (1 seller) — duplicates `web/app/api/sellers/route.ts`
  - `acosHistory` chart data (12 points)
  - `procurementMix` chart data (4 categories)
- **USE_MOCK_DATA = true** flag controls fallback behavior

### `web/app/catalog/page.tsx`
- **Fetch calls (client-side):**
  - `GET /api/access` → isApprover
  - `GET /api/operations/{id}` → poll operation status
  - `POST /api/operations/{id}/approve` → approve operation
  - `POST /api/catalog/optimize` → queue optimization
- **Hardcoded data:**
  - `mockProducts` constant (5 products: asin, sku, title, category, opt_status, opt_score, opt_issues[], stock, days_of_supply, price) — stock/days_of_supply/price are string `"—"` placeholders, not real numbers
  - "Add product" form (import/manual) — no submit handler wired to any API
  - Optimize drawer — Save draft / Send to approval buttons have no handlers

### `web/app/inventory/page.tsx`
- **Hardcoded data:**
  - `products = []` (empty array, typed with asin, sku, name, stock, daily_velocity, opt_score?, opt_status?, po_draft_id?)
  - `purchaseOrders = []` (empty array)
  - `mockUnitCost = {}` (empty record)
  - No fetch calls; no data source connected

### `web/app/approvals/page.tsx`
- **Hardcoded data:**
  - `revisions = []` (empty array)
  - `orders = []` (empty array)
  - Approve/Reject buttons have no handlers
  - No fetch calls; no data source connected

### `web/app/seller-store/page.tsx`
- **Hardcoded data:**
  - `sellerStore = []` (empty array, typed with id, name, sku, asin, price, stock, category, visible)
  - `catalogNotAdded = []` (empty array)
  - Add button has no handler
  - No fetch calls; no data source connected

### `web/app/ppc/page.tsx`
- **Hardcoded data:**
  - `search_terms = []` (empty array)
  - `targeted_exact_keywords = []` (empty array)
  - `negative_keywords = []` (empty array)
  - `campaigns = []` (empty array)
  - `currentAcos()` returns hardcoded `8.2`
  - No fetch calls; no data source connected

### `web/app/repricer/page.tsx`
- **Hardcoded data:**
  - `products = []` (empty array, typed with asin, sku, name, price, competitor_price, min_floor)
  - `payoutMargin()` returns `null`
  - No fetch calls; no data source connected

### `web/app/activity/page.tsx`
- **Hardcoded data:**
  - `items = []` (empty array, typed with timestamp, title, detail, category)
  - No fetch calls; no data source connected

### `web/app/sourcing/page.tsx`
- **Data source:**
  - `useProduct()` from `ProductContext` — local React state only, no fetch, no persistence
  - `pushChangesSync()` — no-op placeholder ("sync entry point for future backend POST")
- **No fetch calls**

### `web/app/how/page.tsx`
- **No data fetching** — static informational page

### `web/components/product/StorefrontView.tsx`
- **Data source:** `useProduct()` context — local state only

### `web/components/product/BuyBoxStatus.tsx`
- **Data source:** `useProduct()` context — local state only

### `web/components/product/MetricsPanel.tsx`
- **Data source:** `useProduct()` context — local state only

### `web/components/ApiIntegrationStatus.tsx`
- **Fetch calls (client-side):**
  - `GET /api/catalog/helium10/status` → connection status
  - `POST /api/catalog/helium10/token` → save Helium 10 token

### `web/context/ProductContext.tsx`
- **Hardcoded data:** `DEFAULT_PRODUCT` (single product: sku, asin, supplierName, factoryUnitCost, shippingCostPerUnit, retailPrice, salesVelocity, currentStock, dailyPpcAdSpend, hasBuyBox, competitorPrice) — completely different shape from mock_db.json products
- **Local state only** — no fetch, no persistence

### `web/app/api/sellers/route.ts`
- **Hardcoded data:** returns single mock seller `{ id: "mock-seller", merchant_id: "Mock Seller", marketplace_id: "ATVPDKIKX0DER", region: "us-east-1" }` — duplicates page.tsx mockSellers fallback

### `web/app/api/dashboard/route.ts`
- **Data source:** `readMockState()` from `mock_db.json` — computes derived fields (velocity from sales_history, opt_score from scoring.ts)
- **Shape mismatch:** Output Dashboard type differs from mock_db.json Product type (manual mapping in code)

### `web/app/api/products/route.ts`
- **Data source:** `readMockState()` from `mock_db.json` — pagination, filtering, sorting
- **No auth** (unlike other API routes)

### `web/app/api/state/route.ts`
- **Data source:** `readMockState()` — returns full raw state

### `web/app/api/seller/sync/route.ts`
- **Data source:** `readMockState()` + `writeMockState()` — mutates in-memory cache, upserts products from amazon_catalog

### `web/app/api/inventory/scan/route.ts`
- **Data source:** `readMockState()` + `writeMockState()` — runs `MockSimulator.tick(state)` then returns product inventory view

### `web/app/api/purchase-orders/[id]/decision/route.ts`
- **Data source:** `readMockState()` + `writeMockState()` — approves/denies orders

### `web/app/api/catalog/optimize/route.ts`
- **Proxy:** forwards to `AMZSPHERE_BACKEND_URL` (not configured in mock mode → 503)

### `web/app/api/catalog/helium10/status/route.ts`
- **Proxy:** forwards to `AMZSPHERE_BACKEND_URL` (not configured → returns `connected: false`)

### `web/app/api/catalog/helium10/token/route.ts`
- **Proxy:** forwards to `AMZSPHERE_BACKEND_URL` (not configured → silently swallows error, returns ok)

### `web/app/api/operations/[id]/route.ts` and `/approve`
- **Proxy:** forwards to `AMZSPHERE_BACKEND_URL` (not configured → 503)

## 2. Data types and current shapes

### Product (mock_db.json source of truth)
30 products. Each has: `id`, `asin`, `sku`, `marketplace_id`, `source`, `name`, `title`, `category`, `price`, `bullets[]`, `description`, `backend_keywords[]`, `images[]`, `sellable_units`, `stock`, `days_of_supply`, `daily_velocity`, `competitor_price`, `market_price`, `min_floor`, `max_price`, `unit_cost`, `lead_time_days`, `supplier`, `po_draft_id`, `suppressed`, `last_synced_at`, `sync_status`, `last_optimized_at`, `opt_score`, `opt_issues[]`, `opt_status`

### Dashboard Product (page.tsx local type)
`asin`, `sku`, `vendor`, `stock`, `velocity_7d`, `velocity_30d`, `velocity_90d`, `days_supply`, `reorder_flag`, `opt_score`, `opt_status`, `needs_optimization` — computed/derived, different shape from source

### Catalog Product (catalog/page.tsx local type)
`asin`, `sku`, `title`, `category`, `opt_status`, `opt_score`, `opt_issues[]`, `stock`, `days_of_supply`, `price` — stock/days_of_supply/price are string `"—"` placeholders

### Inventory Product (inventory/page.tsx local type)
`asin`, `sku`, `name`, `stock`, `daily_velocity`, `opt_score?`, `opt_status?`, `po_draft_id?` — currently empty array

### Repricer Product (repricer/page.tsx local type)
`asin`, `sku`, `name`, `price`, `competitor_price`, `min_floor` — currently empty array

### Seller Store Product (seller-store/page.tsx local type)
`id`, `name`, `sku`, `asin`, `price`, `stock`, `category`, `visible` — currently empty array

### Order (mock_db.json)
12 orders. Fields: `id`, `product_name`, `supplier`, `amount`, `units`, `status`, `reviewed_by?`, `reviewed_at?`

### Purchase Order (mock_db.json)
12 purchase orders. Fields: `id`, `product_asin`, `product_name`, `supplier`, `units`, `status`, `created_at`

### Campaign (mock_db.json)
5 campaigns. Fields: `name`, `sku`, `ad_history[]`, `bid_floor`, `bid_changes[]`, `acos_modifier`

### Search Term (mock_db.json)
23 search terms. Fields: `term`, `clicks`, `spend`, `conversions`, `acos`, `sales?`, `impressions?`

### Activity Item
`id`, `timestamp`, `category`, `title`, `detail` — 120 items in mock_db.json

### Product Revision
`id`, `product_id`, `field_changes`, `status`, `created_by`, `created_at` — 0 items currently

### Seller
`id`, `merchant_id`, `marketplace_id`, `region` — hardcoded in two places

### ProductContext ProductRecord (local state only)
`sku`, `asin`, `supplierName`, `factoryUnitCost`, `shippingCostPerUnit`, `retailPrice`, `salesVelocity`, `currentStock`, `dailyPpcAdSpend`, `hasBuyBox`, `competitorPrice` — completely different shape from all product types above

## 3. Where data is duplicated or could get out of sync

1. **Product list** — `mock_db.json` (source), `page.tsx` `mockDashboard` (hardcoded, different shape), `catalog/page.tsx` `mockProducts` (hardcoded, string placeholders for numeric fields). Adding a product in one place won't show in others.

2. **Seller list** — `page.tsx` `mockSellers` fallback AND `web/app/api/sellers/route.ts` both hardcode the same single seller. If one changes, the other won't.

3. **Dashboard derived fields** — API route computes `velocity_7d/30d/90d`, `reorder_flag`, `opt_score`, `needs_optimization` from `mock_db.json` + `scoring.ts`. The hardcoded `mockDashboard` in page.tsx has static values that don't match.

4. **Catalog vs Dashboard product shapes** — catalog table uses `opt_score`/`opt_status` from `mockProducts` constant; dashboard uses computed values from API. They won't agree if mock_db.json changes.

5. **Inventory page** — empty array; `inventory/scan` API returns products but the page never calls it.

6. **ProductContext vs mock_db products** — completely unrelated shapes. `useProduct()` default product (`AMZ-001` / `B0C9W7XNQ3`) doesn't exist in mock_db.json.

7. **In-memory cache** — `mock-state.ts` caches state in a module-level variable. `writeMockState()` only updates the in-memory cache, not `mock_db.json`. Changes from one API call won't be visible in the next serverless invocation (each invocation re-reads from `mock_db.json`). This means add/optimize operations don't persist across page reloads.

8. **Approvals/Revisions** — `product_revisions` array exists in mock_db.json (0 items) but approvals page has empty hardcoded array and no fetch to create/retrieve revisions.

## Files

All paths relative to `/home/lkkolokoy/AmzSphere/`.

**UI pages with direct fetch or hardcoded data:**
- `web/app/page.tsx` (Dashboard)
- `web/app/catalog/page.tsx`
- `web/app/inventory/page.tsx`
- `web/app/approvals/page.tsx`
- `web/app/seller-store/page.tsx`
- `web/app/ppc/page.tsx`
- `web/app/repricer/page.tsx`
- `web/app/activity/page.tsx`
- `web/app/sourcing/page.tsx`
- `web/app/how/page.tsx`

**Components using ProductContext (local state only):**
- `web/components/product/StorefrontView.tsx`
- `web/components/product/BuyBoxStatus.tsx`
- `web/components/product/MetricsPanel.tsx`
- `web/components/ApiIntegrationStatus.tsx`

**API routes (data providers):**
- `web/app/api/dashboard/route.ts`
- `web/app/api/products/route.ts`
- `web/app/api/state/route.ts`
- `web/app/api/sellers/route.ts`
- `web/app/api/seller/sync/route.ts`
- `web/app/api/inventory/scan/route.ts`
- `web/app/api/purchase-orders/[purchaseOrderId]/decision/route.ts`
- `web/app/api/catalog/optimize/route.ts` (proxy to backend)
- `web/app/api/catalog/helium10/status/route.ts` (proxy to backend)
- `web/app/api/catalog/helium10/token/route.ts` (proxy to backend)
- `web/app/api/operations/[operationId]/route.ts` (proxy to backend)
- `web/app/api/operations/[operationId]/approve/route.ts` (proxy to backend)

**Shared libs:**
- `web/lib/mock-state.ts` — in-memory cache of `mock_db.json`
- `web/lib/scoring.ts` — optimization scoring rules
- `web/lib/simulator.ts` — simulator tick logic
- `web/context/ProductContext.tsx` — local product state context

**Data source:**
- `mock_db.json` — 30 products, campaigns, search terms, orders, purchase orders, activity, etc.

## Provider interface candidates

To unify all data flow, a single provider interface is needed with methods like:
- `getProducts()` / `getProduct(id)` — product catalog
- `addProduct(product)` — create product
- `updateProduct(id, patch)` — update product (including optimization)
- `getProductOptimizationStatus(id)` — opt_score, opt_issues, opt_status
- `getDashboard()` — aggregated dashboard view
- `getSellers()` — seller list
- `getInventory()` — inventory view
- `getOrders()` / `decideOrder(id, action)` — purchase workflows
- `getActivity()` — activity log

Mock provider implements these from `mock_db.json`. Live provider stub throws "live provider not configured". `DATA_SOURCE=mock|live` env var selects between them.

STOP — waiting for approval before writing the plan.
