# Vercel Audit — AmzSphere Mock Simulator

## 1. Repo structure and frameworks

Root `/home/lkkolokoy/AmzSphere`:

- `local_server.py` — mock dashboard server (Python stdlib `http.server`), runs on port 8000, ticks a `MockSimulator` every 10 s, reads/writes `mock_db.json`.
- `simulator.py` — `MockSimulator` with repricing, PPC drift/harvest, guardrails, sales-history roll, inventory burn, PO drafting.
- `scoring.py` — deterministic listing optimization score (pure Python).
- `database.py` — `JsonStateStore` (local file) and `SupabaseStateStore` abstractions.
- `mock_db.json` — committed mock state (products, campaigns, search terms, activity, orders, purchase orders, etc.).
- `generate_mock_db.py` — seed-data generator.
- `server.py` — production FastAPI scaffold (not dependency-installed, paused).
- `backend/` — production FastAPI app + workers (paused).
- `web/` — Next.js 15 App Router frontend (React 19, Tailwind, Recharts).
- `static/` — legacy HTML/JS/CSS frontend served by `local_server.py`.
- `supabase/` — migration SQL.
- `tests/` — Python unittest suite.
- `vercel.json` — two services: `web` (Next.js) and `api` (FastAPI), with `/api/*` rewrites to the API service.
- `.env` / `.env.example` — configuration, including `AMZSPHERE_BACKEND_URL=http://localhost:8001`.

Frameworks: Python stdlib (mock server), FastAPI (production scaffold, paused), Next.js 15 (frontend).

## 2. How the mock simulator starts and what endpoints/data it serves

Start: `python3 local_server.py`. It launches a `ThreadingHTTPServer` on `HOST:PORT` (default `127.0.0.1:8000`), plus a daemon thread `simulator_loop()` that reads `mock_db.json`, calls `SIMULATOR.tick(state)`, and writes it back every `TICK_SECONDS` (10 s). State is persisted to `mock_db.json` on every tick and every mutating request.

Endpoints served by `local_server.py` (`DashboardHandler`):

- `GET /api/health` — `{"ok": true, "mode": "mock"}`
- `GET /api/state` — full mock state
- `GET /api/seller-store` — seller-store products
- `GET /api/products` — paginated/filtered/sorted product list
- `GET /api/products/{ref}` — single product
- `GET /api/sync/status` — sync state
- `GET /api/overview/summary` — dashboard summary
- `POST /api/simulator/tick` — force one simulator tick
- `POST /api/agent-actions` — stage `catalog_push` or `procurement_po` jobs (sandbox only)
- `POST /api/orders/{order_id}/decision` — approve/deny an order
- `POST /api/seller-store/{id}/toggle-visibility`
- `POST /api/seller-store/add`
- `POST /api/catalog-products` — add catalog product
- `POST /api/products` — add product
- `POST /api/products/import` — import from mock Amazon catalog
- `POST /api/products/optimize-bulk`
- `POST /api/products/{id}/optimize`
- `POST /api/approvals/{id}/approve|reject`
- `POST /api/sync` — mock sync (upserts from `amazon_catalog`)
- `PATCH /api/products/{ref}` — update product
- Static file serving (`/static/*`, `index.html`)

Data: everything in `mock_db.json` — products, campaigns, search terms, activity log, orders, purchase orders, product revisions, marketplace listings, sync state, manager info.

## 3. How the frontend gets its data (which URLs, which files)

**Next.js frontend (`web/`):**

- `web/app/page.tsx` (Dashboard): `USE_MOCK_DATA = true`. On fetch failure it falls back to a hardcoded `mockDashboard`. Fetches:
  - `GET /api/sellers` → proxied to `${AMZSPHERE_BACKEND_URL}/api/v1/sellers` (requires `AMZSPHERE_BACKEND_URL` + `AMZSPHERE_PLATFORM_API_KEY` env vars; auth via NextAuth)
  - `GET /api/access` → local Next.js route returning session email/isApprover
  - `GET /api/dashboard?seller_id=...` → proxied to `${AMZSPHERE_BACKEND_URL}/api/v1/dashboard`
  - `POST /api/purchase-orders/{id}/decision` → proxied to backend
  - `POST /api/seller/sync` → proxied to backend
  - `POST /api/inventory/scan` → proxied to backend
- `web/app/api/dashboard/route.ts`, `sellers/route.ts`, `operations/[operationId]/route.ts`, `purchase-orders/[id]/decision/route.ts`, `seller/sync/route.ts`, `inventory/scan/route.ts` — all proxy to `AMZSPHERE_BACKEND_URL` with `X-Platform-Key` and `X-Workspace-User` headers.
- `web/app/api/access/route.ts` — returns auth info from NextAuth session.
- `web/context/ProductContext.tsx` — local React context with hardcoded default product (no network).
- Pages `catalog`, `inventory`, `ppc`, `repricer`, `seller-store`, `approvals`, `activity`, `sourcing` — mostly hardcoded local mock data; some fetch `/api/access`.

**Legacy static frontend (`static/`):** Served by `local_server.py` on port 8000; `static/app.js` fetches from the same-origin port-8000 endpoints (`/api/state`, `/api/products`, etc.).

## 4. What will NOT work on Vercel

1. **Port-based always-on server** — `local_server.py` binds `0.0.0.0:8000` and runs `serve_forever()`. Vercel serverless functions cannot listen on arbitrary ports or keep a process alive between invocations.
2. **Background simulator thread** — `simulator_loop()` runs an infinite `while True` loop with `time.sleep(10)`. Vercel has no long-running background processes or Celery workers.
3. **Local-file database writes** — `mock_db.json` is written on every tick and mutating request (`write_database` / `JsonStateStore.write`). Vercel's filesystem is read-only for committed files and ephemeral across invocations/regions; writes do not persist.
4. **Hardcoded localhost URLs** — `.env.example` sets `AMZSPHERE_BACKEND_URL=http://localhost:8001` and `AUTH_URL=http://localhost:3000`; `require-user.ts` defaults `AUTH_URL` to `http://localhost:3000`. These do not resolve in production.
5. **Supabase/PostgreSQL/Redis dependencies** — not installed; the production scaffold requires external infra not available on Vercel without separate setup.
6. **NextAuth Google provider** — requires real OAuth credentials; not configured for mock-only review.

## 5. Recommended approach

**Move the mock endpoints into Next.js route handlers inside `web/app/api/`, loading `mock_db.json` as read-only seed data.** Next.js API routes are serverless functions that run on Vercel with no long-running process, no port binding, and no background thread. `mock_db.json` is committed to the repo and readable at request time, which is sufficient for a read-mostly mock review. Write endpoints (tick, approve, optimize, PO decision, etc.) operate on an in-memory copy of the loaded state within a single invocation; state does not need to persist across requests for a preview. The Next.js pages already have a `USE_MOCK_DATA = true` flag and hardcoded fallbacks, so they can be switched to call the local `/api/*` route handlers instead of proxying to `AMZSPHERE_BACKEND_URL`. No hardcoded localhost or port-8000 URLs remain; all calls use relative paths.

**Alternative:** Deploy `local_server.py` as a standalone always-on service on an external platform (e.g. Railway, Render, Fly.io) and point the Next.js frontend at that URL via `AMZSPHERE_BACKEND_URL`. This keeps the mock server unchanged but requires a separate always-on host and an external URL, which the goal explicitly avoids.

STOP — waiting for your approval before proceeding to Step 2 (plan).
