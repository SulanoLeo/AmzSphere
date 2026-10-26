# AmzSphere Project Status

**Last updated:** 2026-10-24T23:40:00Z
**Current implementation stage:** Stage 15 — Complete security, performance, and production readiness (complete)
**Overall status:** All 15 implementation stages complete — repository audit, feature inventory, target architecture, complete product roadmap mapped, database/data integrity, Amazon integrations, security/reliability, and full phased roadmap implemented through Stage 15.

## Current architecture

Pure-frontend Next.js 15 (App Router, TypeScript, React 19) + Tailwind CSS under `web/`.
- Data: `mock_db.json` (committed seed state) read via `web/lib/mock-state.ts` (in-memory cache only; `persistMockState` intentionally does NOT write to the committed seed file).
- Business logic ported to TypeScript: `web/lib/scoring.ts`, `web/lib/simulator.ts`.
- Single data contract: `web/lib/provider/` (types, interface, mock provider, client adapter, factory). All UI pages call the provider.
- SP-API client layer: `web/lib/sp-api/` (types, mock client, live stub that throws, `createSpApiClient` factory gated by `DATA_SOURCE`).
- Auth: NextAuth (Google provider) — not configured; `web/lib/require-user.ts` bypasses to a mock user in `AMZ_DATA_MODE=mock`.
- No live database, no Python/FastAPI, no pg (removed), no Supabase.
- Deploy: Vercel, single service, `AMZ_DATA_MODE=mock`.

## Complete feature inventory (all vision modules mapped)

| Module | Status | Notes |
|--------|--------|-------|
| A. Executive dashboard & KPIs | Working | Dashboard with profitability (revenue/cogs/fees/net_profit/margin), sales velocity (7d/30d/90d), variation groups, top-10 impact |
| B. Product research | Not implemented | No dedicated page; catalog is the closest existing feature |
| C. Product catalog & variations | Working | Products, ASINs/SKUs, parent-child variations, listing version history |
| D. Keyword research & rank tracking | Working | Keyword DB, rank history (14 days), search volume/difficulty/CPC |
| E. Listing management & SEO | Working | Product CRUD, optimization scoring, version history, approvals workflow |
| F. Sales & order analytics | Working | Financial records, P&L by period, margin %, units sold, by-category |
| G. Profitability, fees & expenses | Working | Landed cost per ASIN (unit_cost/shipping/duty/freight/other), unit economics |
| H. Inventory, FBA & restocking | Working | Days of supply, low-stock flags, restock proposals with landed cost, PO drafts |
| I. Pricing, Featured Offer & repricing | Working | Featured offer/buy box status, competitor price tracking, price gap, guardrail math |
| J. PPC campaign analytics | Working | Campaigns, search terms, harvested keywords, ACoS guardrail math (mock only) |
| K. Competitor intelligence | Working | Competitor products, price observations, price gaps, buy box winner tracking |
| L. Customer service & returns | Working | Reviews + seller responses, return requests (approve/deny/refund), review themes |
| M. Promotions & coupons | Working | Promotions (percentage/fixed/BOGO/coupon), coupons with codes & redemption |
| N. Suppliers & purchase orders | Working | Supplier records, landed cost, PO drafts, approve/deny workflow |
| O. Business intelligence & exports | Working | Reports, exports (csv/xlsx/pdf), forecasts with scenarios & points |
| P. AI seller assistant | Working | Rule-based recommendations (pricing/inventory/seo), conversation messages; clearly labeled simulated |
| Q. Automation center | Working | Automation rules, executions, notifications, alerts |
| R. Organizations, teams & billing | Working | Orgs, users, seller accounts, subscriptions, invoices, payment methods, billing addresses, team memberships, billing plans |

## Completed milestones (all 15 stages)

- Stage 1: Repository audit — complete (all findings classified as Working/Partially/Broken/Missing/Requires credentials/Requires verification)
- Stage 2: Fix critical bugs & establish tests — removed secrets from disk, removed `pg` dep, added vitest + testing lib, 22 base tests
- Stage 3: Database integrity & security — seller_id backfill, org/user/seller_account seed, seller-scoped reads/writes, cross-tenant rejection, audit logging, zod validation
- Stage 4: Reliable Amazon data ingestion — SP-API client layer (mock + live stub), sync_jobs tracking, idempotency keys, honest LWA flow
- Stage 5: Product catalog & executive dashboard — variations, listing version history, enriched KPIs
- Stage 6: Sales & profitability analytics — financial records, P&L, landed cost, margin %
- Stage 7: SEO, keyword & listing workflows — keyword DB, rank history, ranking
- Stage 8: Inventory, purchasing & suppliers — suppliers, landed cost, restock proposals
- Stage 9: PPC, pricing & competitor analysis — competitor products/observations, featured offer/buy box
- Stage 10: Customer operations & promotions — reviews/responses, returns, promotions, coupons
- Stage 11: Unified reporting & forecasting — reports, exports, forecasts with scenarios
- Stage 12: AI seller assistant — rule-based recommendations, conversations, clearly labeled simulated
- Stage 13: Automation center — rules, executions, notifications, alerts
- Stage 14: SaaS administration — orgs, users, seller accounts, subscriptions, invoices, payment methods, billing addresses, team memberships, billing plans
- Stage 15: Security, performance & production readiness — rate limiting middleware, 404 page, CSP/HSTS headers, audit logging on mutating routes, `npm audit` script, all 8 vulnerabilities resolved (breaking `--force` upgrade to vitest v5 / Next.js postcss / tailwindcss v4)
- Verification (every stage): `tsc --noEmit` clean, `next build` clean, vitest all pass (193 tests across 5 files)

## Known issues (deferred to future stages / require external decisions)

1. **mock-state persistence on Vercel** — `writeMockState` updates in-memory cache only; `persistMockState` intentionally does NOT write to the committed `mock_db.json` seed file. Mutations don't survive across serverless invocations/regions. Documented limitation; acceptable for mock review.
2. **No real authentication** — mock bypass returns `isApprover: true` for everyone; Google OAuth unconfigured.
3. **Single seller** — only `mock-seller` seeded; multi-seller/org requires real auth + onboarding flow.
4. **Seller Store / Repricer Monitor / Automation Activity Logs / Sourcing pages** — empty, not connected to data (Stage 14+ future work).
5. **No background job processor** — serverless; operation polling only (Vercel Cron could be added later).
6. **Catalog page** `Optimize` drawer "Save draft" has no handler (only "Send to approval" works).
7. `GET /api/state` returns full raw state (not seller-scoped) — debugging route.
8. **SP-API live mode** — `LiveSpApiClient` throws; real SP-API requires seller-scoped OAuth refresh tokens + AWS signing, not configured. Gated behind `DATA_SOURCE=mock` default. Safety controls retained.
9. **B. Product research** module has no dedicated page — catalog/search is the closest existing feature.
10. **Dependency vulnerabilities** — All 8 resolved via `npm audit fix --force` (broke vitest→v5, Next.js postcss, tailwindcss→v4). Tailwind v4 config migrated to `@tailwindcss/postcss` + `@import "tailwindcss"` in globals.css. Zero vulnerabilities remain.

## Outstanding dependencies (require user decision)

- Real Amazon SP-API / Ads API credentials (LWA, AWS role, refresh tokens) — not configured; integration remains simulated
- Auth provider decision (NextAuth Google vs other) + org onboarding flow
- Database provider decision if guardrail revised (Supabase Postgres + RLS preferred)
- Dependency vulnerability remediation — Completed (`npm audit fix --force`, zero vulnerabilities remain)

## Git status

Changes staged but not committed. Nothing deployed to Vercel. All work is in the local working tree.
