# AmzSphere Operations Architecture

## Current Implementation Boundary

The existing `local_server.py` app on port 8000 remains the mock dashboard. It
uses `mock_db.json`; its actions do not contact Amazon or suppliers. The separate
`web/` and `backend/` trees now contain a production-oriented Next.js, FastAPI,
PostgreSQL, Redis/Celery, SigV4/LWA, SP-API ingestion, feed, and notification
scaffold. That stack is disabled by default and has not yet been dependency-
installed or verified against AWS, Amazon, a real IdP, or a live database. Its
presence in source is not evidence of a successful seller connection or an
Amazon acknowledgement. See `PRODUCTION_SETUP.md` for setup and go-live gates.

Credentials stay server-side. The production web proxy uses OIDC and email
allowlists; FastAPI requires an internal service key and checks that the
forwarded workspace identity owns the seller. Replace these bootstrap controls
with workload identity and an organization-backed role/membership system before
public multi-tenant launch.

## Production Request and Execution Path

1. A user authenticates through the web application. The API enforces tenant,
   seller, marketplace, role, CSRF, and action-level authorization.
2. The API validates a versioned command, checks the current listing or
   procurement revision, and applies policy constraints. It writes the command
   and an outbox event in one PostgreSQL transaction with an idempotency key.
3. An outbox dispatcher publishes the event to a managed queue. The API returns
   `202 Accepted` with an operation ID; the UI polls or subscribes to operation
   status rather than holding the request open for Amazon.
4. Isolated workers claim jobs with a lease, load seller-scoped credentials
   from a secret manager, and obtain LWA access tokens server-side. SP-API calls
   use the correct regional endpoint, marketplace, and AWS request signing.
5. Workers apply per-seller and per-operation rate limits, bounded exponential
   backoff with jitter for retryable responses, and honor `429`/`Retry-After`.
   Non-retryable validation failures become terminal; exhausted jobs enter a
   dead-letter queue for operator review. Idempotency keys and remote operation
   IDs prevent duplicate writes after retries.
6. The worker persists each transition (`queued`, `running`, `succeeded`,
   `failed`, `needs_review`) and an append-only audit event. It reconciles
   asynchronous Amazon processing reports before declaring a listing update
   complete. Secrets and raw authorization headers are excluded from logs.

Use separate queues and worker concurrency budgets for catalog writes,
procurement, and ingestion. Add tenant-aware quotas, database connection pools,
queue-depth alerts, tracing by operation ID, retention controls, encrypted
backups, and a kill switch before enabling autonomous writes. Procurement must
also require configured supplier identity, price/quantity limits, and a human
approval policy before any external PO transmission.

## Data Ingestion and Reconciliation

1. Scheduled connectors ingest official SP-API catalog, listing, inventory,
   order, and reports data using seller- and marketplace-scoped cursors. Persist
   raw responses to encrypted object storage with source, request ID, fetched
   timestamp, marketplace, and schema version metadata.
2. A separate, contract-approved Helium 10 or SERP connector ingests keyword
   observations. Do not bypass authentication, robots/access controls, or
   provider terms with generic scraping. Persist query, locale, provider,
   observation time, and source attribution; treat rankings and search volume as
   estimates, not Amazon-authoritative listing state.
3. Normalize both sources into staging tables. Deduplicate by provider record
   identity and observation window. Validate types, marketplace, currency,
   ASIN/SKU relationships, and freshness; quarantine malformed or conflicting
   records rather than overwriting good data.
4. Merge transactionally into canonical tables keyed by tenant, seller,
   marketplace, ASIN/SKU, and source. Official SP-API payloads own Amazon
   listing/inventory/order facts; external search providers contribute
   attributed keyword/rank observations only. Preserve effective timestamps,
   provenance, and historical snapshots.
5. Publish a versioned feature snapshot for the agent. Optimization output is
   a proposal with source references and a diff from the official listing. A
   separate approval/write command enters the queue; success is confirmed only
   by Amazon's processing result and a subsequent read/reconciliation.

## Environment and Deployment

Copy the variable names from [`.env.example`](.env.example) into a local ignored
`.env` for development. Production secrets belong in the hosting platform's
secret manager or workload identity, with rotation and least privilege. Prefer
AWS role credentials over static access keys. Configure regional SP-API
endpoints and marketplace IDs per seller; never use one seller's refresh token
for another seller. `OPENAI_API_KEY` and search-provider credentials are
server-only and should be scoped, monitored, and independently revocable.