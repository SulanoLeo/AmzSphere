# AmzSphere Architecture

## Runtime boundary

AmzSphere is a Next.js 16 App Router application with TypeScript, React 19, and Tailwind CSS 4. Pages and API route handlers are in `web/app/`; reusable UI is in `web/components/`; mock business logic and data access are in `web/lib/`.

The application is mock-only. No API route should call Amazon, an ad network, an SEO provider, or a database. Do not add the removed Python/FastAPI service, PostgreSQL, Redis, Supabase, or external credentials.

## Request and data flow

1. A page or client component requests data from a native route handler under `web/app/api/`.
2. The route handler reads or updates state through `web/lib/mock-state.ts`.
3. `mock-state.ts` loads the committed seed `web/mock_db.json` and maintains a process-local memory cache.
4. Mock-only helpers such as `web/lib/scoring.ts` and `web/lib/simulator.ts` calculate deterministic outcomes.
5. The route returns JSON to the client component, which renders the result and status feedback.

Keep the provider interfaces and mock implementations under `web/lib/provider/` when shared product data access is needed. A provider abstraction is not permission to add a live provider.

## Persistence and side effects

Mock mutations update only the current Node.js process's in-memory cache. They do not update `web/mock_db.json`, survive process restarts, or synchronize between serverless invocations and regions. A fresh process starts from the committed seed. Any status described as synced, launched, published, or submitted is simulated and must not imply an external operation.

Authentication bypasses external sign-in in `AMZ_DATA_MODE=mock` and uses a seeded demo user. This is for demonstration only; it is not an authorization boundary for a production service.

## Runtime configuration

`AMZ_DATA_MODE=mock` is the supported configuration. No database URL, queue, provider key, OAuth secret, or Amazon credential is needed to run the mock demo. Keep `.env.example` limited to safe mock-mode configuration and never add real secrets to the repository.

## Deployments

The project can be hosted as a single Next.js app with `web/` as the application root. Hosting does not make the mock state durable or make any integration real. Refer to [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) for demo deployment guidance and limitations.
