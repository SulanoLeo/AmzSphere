# Vercel Deploy Plan — AmzSphere Mock (mock-data only)

Goal: Move the mock simulator endpoints into Next.js route handlers under `web/app/api/`, load `mock_db.json` as read-only seed data, port simulator + scoring logic to TypeScript, and point the frontend at relative `/api/*` paths. No localhost URLs, no port 8000, no background workers, no production scaffold changes unless listed.

## Item 1 — mock-state utility ✅ DONE
Files to touch: `web/lib/mock-state.ts` (new)
What to do: Create a module that imports `mock_db.json` (via `resolveJsonModule`) and exports helpers: `readMockState()`, `writeMockState(state)` (in-memory copy, no disk write), and a deep-clone helper. No simulator logic yet.
Acceptance check: `tsc --noEmit` passes; module imports and returns the parsed JSON object.

## Item 2 — scoring port ✅ DONE
Files to touch: `web/lib/scoring.ts` (new)
What to do: Port `scoring.py` (`compute_opt_score`, `evaluate_rules`, `status_for_score`, `impact_rank`, `recent_sales_volume`) to TypeScript as pure functions. Same rule penalties and thresholds.
Acceptance check: `tsc --noEmit` passes; `compute_opt_score` returns the same score/issues/status as the Python version for a sample product.

## Item 3 — simulator port ✅ DONE
Files to touch: `web/lib/simulator.ts` (new)
What to do: Port `MockSimulator.tick()` and all private methods (`_reprice`, `_drift_search_terms`, `_harvest_keywords`, `_apply_guardrail`, `_roll_history`, `_append_day`, `_burn_stock`, `_draft_purchase_orders`) from `simulator.py` to TypeScript. Same constants (TICK_SECONDS=10, etc.). No background loop — just a `tick(state)` pure-ish function that mutates the passed state object.
Acceptance check: `tsc --noEmit` passes; calling `tick()` on a cloned state produces state mutations matching the Python simulator.

## Item 4 — GET /api/state route ✅ DONE
Files to touch: `web/app/api/state/route.ts` (new)
What to do: Create a Next.js GET route that imports `mock_db.json` via `mock-state.ts` and returns the full state as JSON. No auth requirement (mock mode).
Acceptance check: `tsc --noEmit` passes; route returns `{"ok": true, ...state}` shape with `generated_at`.

## Item 5 — GET /api/products route ✅ DONE
Files to touch: `web/app/api/products/route.ts` (new)
What to do: Create a Next.js GET route supporting the same query params as the Python server (`opt_status`, `low_stock`, `suppressed`, `search`, `sort`, `page`, `page_size`). Returns paginated product list from `mock_db.json`.
Acceptance check: `tsc --noEmit` passes; route returns `{ products, total, page, page_size, total_pages }`.

## Item 6 — GET /api/sellers → mock ✅ DONE
Files to touch: `web/app/api/sellers/route.ts` (existing)
What to do: Replace the backend proxy with a mock implementation that returns a single mock seller (`id: "mock-seller"`, `merchant_id: "Mock Seller"`, `marketplace_id: "ATVPDKIKX0DER"`, `region: "us-east-1"`). Remove `AMZSPHERE_BACKEND_URL`/`AMZSPHERE_PLATFORM_API_KEY` dependency.
Acceptance check: `tsc --noEmit` passes; route returns mock seller list without requiring backend env vars.

## Item 7 — GET /api/dashboard → mock
Files to touch: `web/app/api/dashboard/route.ts` (existing)
What to do: Replace the backend proxy with a mock implementation that computes the dashboard summary from `mock_db.json` (catalog items, sellable units, reorder flags, pending approvals, needs_optimization, top_10 by impact). Use `scoring.ts` for impact_rank.
Acceptance check: `tsc --noEmit` passes; route returns dashboard summary matching `mock_db.json` data.

## Item 8 — POST /api/purchase-orders/[id]/decision → mock ✅ DONE
Files to touch: `web/app/api/purchase-orders/[purchaseOrderId]/decision/route.ts` (existing)
What to do: Replace the backend proxy with a mock implementation that reads `mock_db.json`, finds the order by ID, approves/denies it, mutates the in-memory state, and returns the updated order. Remove `requireSameOrigin` and backend env var dependency.
Acceptance check: `tsc --noEmit` passes; route returns 200 with updated order for a valid order ID, 404 for unknown.

## Item 9 — POST /api/seller/sync → mock ✅ DONE
Files to touch: `web/app/api/seller/sync/route.ts` (existing)
What to do: Replace the backend proxy with a mock implementation that sets `sync_state` to completed and returns a mock operation result. Remove backend env var dependency.
Acceptance check: `tsc --noEmit` passes; route returns `{ operation_id, status: "completed", products_synced }`.

## Item 10 — POST /api/inventory/scan → mock ✅ DONE
Files to touch: `web/app/api/inventory/scan/route.ts` (existing)
What to do: Replace the backend proxy with a mock implementation that runs one simulator tick on inventory state and returns a scan result. Remove backend env var dependency.
Acceptance check: `tsc --noEmit` passes; route returns scan summary without backend env vars.

## Item 11 — Auth bypass for mock mode ✅ DONE
Files to touch: `web/lib/require-user.ts` (existing)
What to do: Add a mock-mode bypass: when `process.env.AMZ_DATA_MODE === "mock"` (or `VERCEL` is set with no real auth configured), `requireAllowedUser()` returns a default mock user (`email: "mock@amzsphere.local"`, `isApprover: true`) instead of requiring NextAuth. `requireSameOrigin` returns null in mock mode.
Acceptance check: `tsc --noEmit` passes; mock API routes are accessible without Google OAuth or `WEB_ALLOWED_EMAILS`.

## Item 12 — Frontend relative /api/* paths ✅ DONE (no changes needed — already uses relative paths)
Files to touch: `web/app/page.tsx` (existing)
What to do: Ensure all fetch calls use relative `/api/*` paths (already the case for most). Verify no `AMZSPHERE_BACKEND_URL` references remain in page.tsx. Keep `USE_MOCK_DATA = true` fallback for resilience.
Acceptance check: `tsc --noEmit` passes; no `AMZSPHERE_BACKEND_URL` or `localhost` references in page.tsx.

## Item 13 — vercel.json single service ✅ DONE
Files to touch: `vercel.json` (existing)
What to do: Replace the two-service config with a single Next.js web service at root `web`, remove the `api` backend service and `/api/(.*)` rewrite to backend. Add a wildcard rewrite so `/api/*` routes are handled by Next.js API routes.
Acceptance check: `tsc --noEmit` passes; `vercel.json` is valid JSON with one web service.

## Item 14 — Final build + typecheck ✅ DONE
Files to touch: none (verification)
What to do: Run `cd web && npm run build` and `cd web && npm run typecheck` from the repo root. Show real command output. Fix any errors.
Acceptance check: Both `next build` and `tsc --noEmit` complete with zero errors.

STOP — waiting for your approval before starting Item 1.
