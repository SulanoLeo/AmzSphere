# Production Stack Setup

This is an **initial production-oriented scaffold**, not a live Amazon deployment.
The existing mock server and mock dashboard remain available on port 8000. The
new stack is separate: Next.js web on 3000, FastAPI on 8001, PostgreSQL, Redis,
Celery workers/beat, and an SQS notification consumer.

## What is implemented

- Next.js App Router UI with Tailwind, Recharts, reusable shadcn-style controls,
  OIDC sign-in through Keycloak, workspace and approver email allowlists, and a
  server-side backend proxy. Sellers are selected from tenant-scoped OAuth links.
- FastAPI `/api/v1` routes for LWA seller consent, catalog optimization queueing,
  operation status, approval, seller sync, inventory scan, and reviewable PO PDFs.
- PostgreSQL SQLAlchemy models and initial SQL migration for tenants/sellers,
  catalog items, vendor profiles, daily sales, inventory snapshots, operations,
  outbox events, purchase orders, and Amazon feed state.
- Redis LWA access-token cache with expiry skew and a refresh lock; seller- and
  operation-scoped atomic token buckets for SP-API.
- Celery queues for catalog, inventory, ingestion, and notifications. API writes
  an operation and outbox event in one SQL transaction. Celery beat dispatches
  outbox rows; duplicate delivery is expected and tasks use operation state to
  avoid repeating completed feed submissions. Connected sellers are scheduled
  for a sync every `SELLER_SYNC_INTERVAL_SECONDS` (default 900); a seller with
  an active sync is skipped to prevent overlap.
- `searchListingsItems` catalog pagination, FBA inventory summaries, and Sales
  `getOrderMetrics` daily unit history. Per-SKU sales calls are paced at the
  documented operation rate.
- Structured OpenAI suggestions and SerpApi rank observations. Suggestions are
  saved for review; a separate approve action submits `JSON_LISTINGS_FEED` with
  `PARTIAL_UPDATE` for the changed listing attributes.
- Feed notifications consumed from an Amazon-configured SQS queue, followed by
  result-document retrieval. Unknown report formats and item errors become
  `needs_review`/failed, not false success.
- 7/30/90-day velocity, 30-day-of-supply flagging, vendor-spec PDF draft POs,
  and a human review queue. Approval records a state change only; it does not
  email a vendor or send a purchase order.

## Amazon API details

- LWA token exchange uses `https://api.amazon.com/auth/o2/token` with the
  authorization-code grant on consent callback and refresh-token grant for
  access-token renewals. Refresh tokens are encrypted in PostgreSQL; access
  tokens are cached in Redis with a 120-second expiry safety margin.
- Listings Items is addressed by `/listings/2021-08-01/items/{sellerId}/{sku}`.
  The API takes a seller SKU, not an ASIN. The UI/API can accept an ASIN, but
  returns a conflict if it maps to multiple seller SKUs and requires a SKU.
- The feed type is `JSON_LISTINGS_FEED`. The worker follows create document,
  upload JSON to the presigned URL, then create feed. It records the feed ID and
  waits for processing notification and report reconciliation.
- Amazon feed notifications are delivered through configured destinations such
  as SQS/EventBridge. This scaffold includes an SQS consumer, not an arbitrary
  public unauthenticated webhook. Configure the Amazon Notifications API
  destination/subscription and the SQS queue policy before enabling it.
- SP-API defaults to disabled and dry-run. Reads require `SP_API_ENABLED=true`;
  writes additionally require `SP_API_DRY_RUN=false`, human approval, valid
  roles, credentials, and production review. The queue and adapters cannot be
  considered production-ready until sandbox/limited-seller tests pass.

## Local prerequisites

- Docker Compose v2 for the service stack.
- Node.js 22 and npm for direct Next.js development and type/lint/build checks.
- Python 3.13 for direct backend development. Use the repository `.venv`.
- A Keycloak OIDC realm/client, an authorized Amazon SP-API application, AWS
  workload identity, SerpApi access, and an OpenAI API key for integrations.

Node.js, npm, and Docker were not installed in the authoring environment, and
the new Python packages are not installed in `.venv`. Therefore this scaffold
has not yet been dependency-installed, container-built, or run against live
services. Python syntax and the dependency-free existing tests are validated
separately; no Amazon account call has been made.

## Local setup

1. Copy `.env.example` to the ignored `.env`. Generate unique values for
   `POSTGRES_PASSWORD`, `AUTH_SECRET`, `PLATFORM_API_KEY`, and `FERNET_KEY`.
   Do not copy real LWA/AWS/OpenAI secrets into chat or source control.
2. Configure Keycloak client ID/secret/issuer, set `WEB_ALLOWED_EMAILS` to a
   comma-separated allowlist, and set `AUTH_URL=http://localhost:3000`.
3. Keep `SP_API_ENABLED=false` and `SP_API_DRY_RUN=true` for first startup.
4. Start the separate services with `docker compose -f compose.yaml up --build`.
   The compose file binds API and web only to localhost; PostgreSQL and Redis
   have no host ports. Open <http://127.0.0.1:3000> and sign in via Keycloak.
5. Configure the Amazon consent callback URL to the deployed API callback.
  Sign in, select **Connect a seller account**, and complete Seller Central
  consent. The callback stores an encrypted refresh token for the signed-in
  tenant and returns to the web app, which discovers that tenant's sellers.
  For a controlled one-seller migration only, `python -m
  backend.scripts.bootstrap_seller` encrypts the already-authorized
  `SP_API_REFRESH_TOKEN` into the matching seller row; clear the token from
  process environment after bootstrap and prefer OAuth for normal onboarding.
6. Select the seller and queue `POST /api/v1/sellers/{seller_uuid}/sync` with a unique
   `Idempotency-Key`. Verify catalog rows, inventory snapshots, and daily sales
   before enabling procurement rules.
7. Configure the Amazon Notifications API SQS destination and the consumer's
   `AMAZON_NOTIFICATIONS_SQS_URL`. Validate test notifications and DLQ redrive.
8. Test catalog proposals and PO drafts using a test seller. Only after product
   type validation, rate monitoring, audit review, and operator sign-off should
   `SP_API_ENABLED=true` and `SP_API_DRY_RUN=false` be considered.

## Direct development

Backend:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001 --no-access-log
```

In separate terminals, start PostgreSQL and Redis, then run the worker and beat:

```bash
.venv/bin/celery -A backend.app.celery_app:celery_app worker --loglevel=INFO
.venv/bin/celery -A backend.app.celery_app:celery_app beat --loglevel=INFO
```

Web:

```bash
cd web
npm install
npm run dev
```

Commit the generated `web/package-lock.json` and use `npm ci` in CI/production
builds. The current Dockerfile uses `npm install` only because the lockfile
cannot be generated in the Node-less authoring environment.

## Critical go-live work remaining

- Replace the single static `PLATFORM_API_KEY` trust boundary with short-lived
  service credentials or workload identity and tenant-scoped authorization.
- Replace email allowlists with verified OIDC organization groups and a managed
  user/role membership model. The scaffold supports tenant matching and a
  separate approver email allowlist, but not full RBAC/SCIM lifecycle.
- Add a transactional OAuth callback route allowlist and deploy it behind TLS;
  verify Amazon application registration, scopes/roles, LWA credentials,
  marketplace endpoint, AWS SigV4 role relationship, and notification policies.
- Confirm `JSON_LISTINGS_FEED` schema against Product Type Definitions per ASIN;
  generated title/bullets/terms alone do not make a complete valid listing.
- Parse the exact JSON Listings Feed processing report schema with fixtures
  from authorized test submissions. Unknown formats deliberately require review.
- Add explicit vendor approval limits and a real supplier adapter before sending
  POs; the current approve action is internal review state only.
- Add Amazon Ads API OAuth/adapters before claiming PPC charts or bid guardrails
  are live. The `AMAZON_ADS_*` variables are placeholders only. The new
  production UI currently focuses on catalog and inventory.
- Use managed PostgreSQL/Redis with TLS, KMS/Secrets Manager, backups, PITR,
  migrations in CI, network isolation, queue DLQs, observability, and a tested
  incident/revocation procedure. Local Compose is development scaffolding only.
- The old port-8000 dashboard still contains mock PPC/pricing views. This new
  production scaffold does not include an Amazon Ads adapter or real bid
  guardrail execution; credentials in `AMAZON_ADS_*` alone do not enable it.
- Add integration tests against local PostgreSQL/Redis, LWA/SerpApi/OpenAI
  fakes, Celery redelivery tests, and an authorized Amazon sandbox/test seller.

## Main files

| Path | Responsibility |
| --- | --- |
| `web/app/` | Next.js pages and authenticated server-side API routes. |
| `web/auth.ts` | Keycloak OIDC session setup. |
| `backend/app/main.py` | FastAPI routes, OAuth state, protected operations. |
| `backend/app/services/sp_api.py` | SigV4 transport, LWA access, throttling, Listings/Feeds API. |
| `backend/app/services/rate_limiter.py` | Redis atomic token buckets keyed per seller and operation. |
| `backend/app/tasks/` | Celery catalog, inventory, ingestion, feed, and outbox tasks. |
| `backend/app/workers/amazon_sqs_consumer.py` | Amazon notification SQS consumer. |
| `backend/app/models.py` | SQLAlchemy relational schema. |
| `backend/migrations/001_initial.sql` | Initial PostgreSQL schema. |
| `compose.yaml` | Local multi-service development environment. |

## Official Amazon references

- [Connect to the SP-API](https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api)
- [Listings Items API](https://developer-docs.amazon.com/sp-api/reference/listings-items-v2021-08-01)
- [Feeds API submit workflow](https://developer-docs.amazon.com/sp-api/docs/submit-a-feed)
- [JSON Listings Feed schema/type](https://developer-docs.amazon.com/sp-api/docs/listings-feed-type-values)
- [Notifications API use cases](https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide)
- [FBA inventory summaries](https://developer-docs.amazon.com/sp-api/reference/getinventorysummaries)
- [Sales order metrics](https://developer-docs.amazon.com/sp-api/reference/getordermetrics)