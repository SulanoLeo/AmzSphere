# AmzSphere

AmzSphere is a portfolio demo of Amazon seller operations built with mock data. It showcases sample dashboards and seller workflows without connecting to Amazon or any production service.

## Stack

- Next.js 16 App Router, TypeScript, React 19
- Tailwind CSS 4
- Native Next.js API routes backed by deterministic, process-local mock state
- Node.js 20 or later

## Run locally

```bash
cd web
npm install
AMZ_DATA_MODE=mock npm run dev
```

Open <http://localhost:3000>. The mock-mode flag is required; no credentials, database, or external account is needed.

## Verify changes

Run from `web/`:

```bash
npm test
npm run typecheck
npm run build
```

## Demo routes

- `/` — Overview
- `/catalog/products` — Products / Listings
- `/catalog/seo` — Listing Optimization / SEO
- `/catalog/seo/tools` — SEO Tools
- `/catalog/seo/preview` — Buyer Preview
- `/catalog/pricing` — Pricing
- `/supply/inventory` — Inventory
- `/supply/replenishment` — Replenishment (the existing combined inventory view until Phase 3)
- `/supply/purchasing` — Purchasing & Suppliers; legacy approvals redirect here with `?tab=approvals`
- `/marketing/ppc` — Advertising / PPC
- `/admin/audit` — Audit Log
- `/admin/help` — Help / Onboarding
- `/admin/seo-tools` — role-gated SEO Tool Admin, not in the sidebar
- `/sales/orders`, `/sales/returns`, `/finance/profit`, `/compliance/health`, `/ops/tasks`, `/ops/alerts`, `/admin/sync`, and `/admin/settings` — shared coming-soon placeholder

Legacy page URLs redirect to their canonical destinations, including `/catalog`,
`/seo-triage`, `/seo-tools`, `/seller-store`, `/repricer`, `/inventory`,
`/approvals`, `/ppc`, `/activity`, `/how`, and `/sourcing`.

## Mock-only behavior

The committed seed data is `web/mock_db.json`. The app loads it into an in-memory cache; mutations do not write to the seed file and are lost when the process restarts. Serverless invocations do not share that memory. Integration, publishing, campaign, and synchronization actions are simulated and have no external side effects.

Products created with the Add Product form are held in client-side Zustand state so they appear across the Overview, Catalog, and Inventory Hub during client-side navigation. They are not written to the mock seed or server and reset when the page is refreshed.

Keep `AMZ_DATA_MODE=mock`. Do not add production credentials or enable a live integration. Product Research is a known feature gap and is intentionally deferred.

See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md).
