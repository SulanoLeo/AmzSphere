# AmzSphere Project Guide

AmzSphere is a portfolio-ready Amazon seller operations demo. Its screens, API routes, and business workflows run locally against deterministic mock data; it does not connect to Amazon or any production service.

## Stack and boundaries

- Next.js 16 App Router, TypeScript, React 19, and Tailwind CSS 4.
- All application code lives in `web/`.
- Next.js route handlers under `web/app/api/` use mock data from `web/lib/mock-state.ts`.
- `web/lib/scoring.ts` and `web/lib/simulator.ts` implement deterministic demo logic.
- Do not add Python/FastAPI, a live database, Redis, Amazon credentials, or external provider calls.

## Run and verify

Use Node.js 20 or later:

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>. The project checks are:

```bash
npm test
npm run typecheck
npm run build
```

## Main screens

| Route | Purpose |
|---|---|
| `/` | Mock seller overview and KPI summary |
| `/catalog` | Product listings, optimization, and approval drafts |
| `/inventory` | Stock levels, reorder proposals, and shipment workflows |
| `/ppc` | Mock campaigns, search terms, and bid controls |
| `/approvals` | Review mock purchase orders and listing revisions |
| `/seller-store` | Sample storefront pages, products, and visibility controls |
| `/repricer` | Simulated pricing and competitor monitoring |
| `/activity` | Sample operations and automation activity |
| `/seo-tools` | Browse and compare sample SEO tools |
| `/admin/seo-tools` | Edit the local sample SEO tool catalog |
| `/how` | Explain the demo's workflow |

Product Research is intentionally out of scope for this pass; do not describe the catalog as a complete product-research module.

## Mock data and persistence

`web/lib/mock-state.ts` reads the committed seed file `web/mock_db.json` into a process-local memory cache. API mutations can change the state seen by the current running process, but they do not write back to the seed file and are not durable across restarts, serverless invocations, or regions. Seed data is restored when a new process starts.

Set `AMZ_DATA_MODE=mock` for the demo mode. This is the intended and only supported operating mode for this project. The mock provider simulates integrations and never calls Amazon. Do not enter real credentials. Google sign-in is optional and is not required for local mock-mode use.

## API routes

The route handlers under `web/app/api/` expose mock-backed workflows for products, dashboard metrics, sellers, purchase orders, listing revisions, PPC, activity, inventory, storefront management, approvals, SEO tools, automation, and related demo features. Keep new routes inside the Next.js app and back them with mock state or deterministic mock-only logic.

## Current constraints

- This is a work sample, not a production seller platform. Metrics, account status, inventory, ads, approvals, and integration activity are sample data.
- Mutations are demonstrative and process-local; they do not cause external side effects.
- No production authentication, durable storage, background job service, Amazon SP-API, Ads API, or live SEO-data provider is configured.
- The absent Product Research page is a known scope gap, not an implemented feature.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the mock data flow and [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) for the safe demo/deployment checklist.
