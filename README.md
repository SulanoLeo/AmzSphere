# AmzSphere

Amazon marketplace operations simulator MVP — now a unified, pure-frontend Next.js (App Router) + Tailwind CSS application optimized for production on Vercel.

The Python/FastAPI backend has been completely removed. All business logic, fields, schemas, and processing paradigms are preserved and driven by deterministic local mock data (`mock_db.json`) served through native Next.js API Routes under `web/app/api/`.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript, React 19)
- **Styling:** Tailwind CSS (dark-mode palettes, flex/grid layouts)
- **Data:** Local mock state (`mock_db.json`) with in-memory read/write via `web/lib/mock-state.ts`
- **Deployment:** Vercel (zero backend; `vercel.json` simplified to project settings only)

## Run locally

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>.

Available scripts:

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (Vercel-ready) |
| `npm run start` | Start the production server |
| `npx tsc --noEmit` | TypeScript typecheck |

## Data strategy

All API routes read from and write to `mock_db.json` (loaded once and cached in memory). Mock responses are deterministic and react to client payloads: search/filter/sort on `/api/products`, dynamic opt-score computation via `web/lib/scoring.ts`, purchase-order approve/deny transitions, revision approve/reject, catalog optimization queuing, sync simulation, and inventory scanning via the mock simulator (`web/lib/simulator.ts`).

UI surfaces loading states (`isLoading`), error states, and data tables/charts exactly as live production streams would.

## API routes

Native Next.js route handlers under `web/app/api/`:

- `GET /api/health` — mock service health
- `GET /api/state` — full mock state snapshot
- `GET /api/dashboard` — aggregated seller dashboard
- `GET /api/products` — paginated, filterable, searchable product catalog
- `POST /api/products` — create a product
- `PATCH /api/products/[id]` — update a product (recomputes opt_score)
- `GET /api/sellers` — connected seller accounts
- `POST /api/seller/sync` — simulate Amazon catalog sync
- `GET /api/orders` — purchase workflows
- `POST /api/purchase-orders/[id]/decision` — approve/deny a workflow
- `GET /api/purchase-orders/[id]/pdf` — mock PO draft PDF
- `GET /api/product-revisions` — pending optimization drafts
- `POST /api/product-revisions/[id]/[action]` — approve/reject a revision
- `POST /api/catalog/optimize` — queue a catalog optimization (mock)
- `GET /api/catalog/helium10/status` — mock Helium 10 status
- `POST /api/catalog/helium10/token` — mock token store
- `GET /api/activity` — activity feed
- `GET /api/campaigns`, `GET /api/search-terms`, `GET /api/ppc` — PPC data
- `GET /api/execution-queue` — async execution queue
- `GET /api/operations/[id]`, `POST /api/operations/[id]/approve` — operation lifecycle
- `GET /api/seller-store`, `POST /api/seller-store`, `PATCH /api/seller-store/[id]/visibility`
- `GET /api/reviews`, `GET /api/review-themes`, `GET /api/catalog-profiles`
- `POST /api/inventory/scan` — run a mock inventory scan tick
- `GET /api/access`, `GET /api/manager` — access / profile
- `POST /api/listings/remediations/approve` — mock listing remediation
- `POST /api/procurement/bulk-approve` — mock bulk PO approval
- `GET /api/procurement/pdf/preview/[id]`, `POST /api/procurement/pdf/[id]/dispatch` — mock PO PDF

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel. Set the root directory to `web` (or rely on automatic Next.js detection).
3. Add `AMZ_DATA_MODE=mock` (default) if desired. No database, Redis, or SP-API credentials are required.
4. Deploy. The app is fully static/client-rendered with dynamic API routes; no `vercel.json` rewrites or cron jobs are needed.

No Supabase, PostgreSQL, or Python runtime is provisioned.
