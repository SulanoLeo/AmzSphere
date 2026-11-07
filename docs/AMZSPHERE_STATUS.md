# AmzSphere Project Status

AmzSphere is a mock-only Next.js work sample. Earlier implementation plans and audit notes described a Python/FastAPI backend, production Amazon integrations, and database infrastructure that are no longer part of the project; treat those claims as superseded.

## Current implementation

The application uses Next.js 16 App Router, TypeScript, React 19, and Tailwind CSS 4 under `web/`. Native route handlers read and mutate a process-local cache initialized from `web/mock_db.json`. The scoring and simulator logic is deterministic mock behavior.

## Current product surface

| Area | Route | Scope |
|---|---|---|
| Overview | `/` | Mock seller KPIs and summary |
| Catalog | `/catalog` | Sample products, listing optimization, approval drafts |
| Inventory | `/inventory` | Stock levels, reorder proposals, shipment demo |
| PPC | `/ppc` | Sample campaigns, search terms, and bid controls |
| Approvals | `/approvals` | Mock purchase-order and listing-review workflows |
| Seller store | `/seller-store` | Sample pages, products, and visibility controls |
| Repricer | `/repricer` | Simulated prices and competitor observations |
| Activity | `/activity` | Sample operational activity |
| SEO tools | `/seo-tools` | Sample directory, filters, comparisons, saved selections |
| SEO tool admin | `/admin/seo-tools` | Process-local sample catalog administration |
| How it works | `/how` | Demo explanation |

Product Research has no dedicated page and is intentionally deferred. A listed workflow should be described as simulated unless it is explicitly verified to do something else.

## Known limitations

- The mock state is in memory only. Mutations do not update the seed file, survive process restarts, or synchronize across serverless invocations and regions.
- Mock-mode authentication and approver privileges are not production security controls.
- No Amazon SP-API, Ads API, external SEO provider, durable database, or background job system is configured.
- The UI is a demonstration; it must not imply that sample account, sales, advertising, inventory, or integration status is live.

## Verification

From `web/`, run `npm test`, `npm run typecheck`, and `npm run build`. See [README.md](../README.md) for setup and [PROJECT_GUIDE.md](../PROJECT_GUIDE.md) for the route map and data behavior.
