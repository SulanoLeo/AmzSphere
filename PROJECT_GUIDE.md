# AmzSphere Project Guide

This guide explains the purpose and behavior of each AmzSphere page and the
code behind it. The current project is an Amazon marketplace **simulator**:
it uses sample data and local rules to demonstrate seller workflows. It is not
connected to Amazon, an advertising account, an AI provider, or a supplier.

## Start and Explore

Run the local, dependency-free server from the project directory:

```bash
python3 local_server.py
```

Open <http://127.0.0.1:8000>. Stop it with `Ctrl+C`. The state is read from and
written to `mock_db.json`; the mock simulator advances about every 10 seconds.
There is no Node.js build step. Chart.js is loaded from a CDN, so charts need
internet access. The stylesheet prefers Amazon Ember, but uses a system font
when Amazon Ember is not installed.

Use the left navigation to open each page. The application refreshes its mock
state on a timer while the page is open. Buttons that stage work or approve
workflows update the local mock state; they do not place real orders or change
Amazon listings.

## Dashboard Pages

### Overview Dashboard

This is the portfolio summary and quickest entry point to the main workflows.

- **Portfolio ACoS** displays the latest value in `acos_history`. ACoS means
  advertising cost of sales: ad spend divided by attributed sales.
- **Units on hand** totals product stock. **Pending approvals** counts pending
  purchase workflows and sums their proposed amounts. **Critical stock alerts**
  counts products with fewer than 15 days of supply.
- **Advertising efficiency** charts the mock ACoS history. The guardrail banner
  describes a trailing-seven-day rule, but that displayed rule is not connected
  to a bid-changing implementation.
- **Procurement mix** charts non-denied purchase workflow amounts by category.
- **Autonomous procurement queue** estimates a 45-day replenishment quantity:
  `max(0, ceil(daily velocity * 45 - stock))`. Supplier-verification labels are
  sample values. Its button stages eligible products below 30 days of supply
  through the mock API; no supplier receives a PO.
- **Automation activity** shows recent events. The review summary and review
  text are sample content, not an AI analysis of live reviews.

### SEO & Catalog Agent

Select a sample product to compare its current listing snapshot with proposed
optimized copy. The table shows each product's ASIN, illustrative organic rank,
keyword gaps, and sync status. Ranks, gaps, and listing copy are hard-coded
sample profiles in `static/app.js`; they are not fetched from Amazon or a search
provider.

The **Approve & Push** button posts the selected ASIN to the mock API. The API
records a `staged` catalog action with `worker_status: not_configured`. No
Seller Central request is made, so the status will not become `Synced` in this
mock implementation.

### PPC Ads Engine

This page summarizes sample search-term spend, clicks, conversions, ACoS,
targeted exact keywords, and negative keywords. The simulator evaluates each
term on a tick:

- More than 5 conversions and less than 25% ACoS adds an exact keyword.
- More than 15 clicks and zero conversions adds a negative keyword.
- Existing keywords are checked case-insensitively so repeated ticks do not
  add duplicate rules.

The ACoS chart includes a visible bid-floor guardrail statement. It is display
only: the mock simulator does not calculate trailing 7-day ACoS or change
advertising bids.

### Inventory Hub

This page shows sample stock, sales velocity, coverage, and draft purchase
orders. Days of supply is calculated as `stock / daily velocity`:

- **Critical:** fewer than 15 days.
- **Watch:** 15 to fewer than 30 days.
- **Healthy:** 30 or more days.

Every simulator tick reduces stock by `daily velocity * 10 / 86,400`, modeling
10 seconds of sales at the configured daily rate. When coverage drops below 15
days and the product has no existing draft, the simulator creates one local PO
draft for approximately 30 days of velocity (with a 100-unit minimum). Drafts
are records only; they are not sent to suppliers.

### Repricer Monitor

The monitor compares the sample offer, competitor offer, and minimum price
floor. Each tick moves the competitor price randomly by $0.10 to $1.50 up or
down, with a $0.50 minimum competitor price. If the competitor is below the
current offer but above the seller's floor, the simulator lowers the offer to
one cent below the competitor, never below the floor. The mock rule does not
raise prices when the competitor rises. Updates are written to the activity
log.

### Automation Activity Logs

This is the newest-first audit-style feed for simulator events. Filters can
limit events to repricing, PPC, inventory, or procurement. The simulator keeps
at most 120 events. These are local sample decisions, not Amazon account audit
records.

### B2B Approvals

The page lists sample procurement workflows and lets the active mock manager
approve or deny a pending workflow. A decision changes its status, adds a
reviewer and timestamp, and writes an activity event. The mock endpoint does
not authenticate the manager, transmit a PO, or move money. Do not expose this
demo workflow publicly as an approval system.

### How It Works

This in-app reference links together the simulator cycle, inventory, PPC,
repricer, approvals, and deployment modes. It describes current mock behavior
and calls out that the live Amazon connection is inactive.

## How the Application Works

1. `static/index.html` loads the page shell, stylesheet, Chart.js, and the
   JavaScript application.
2. `static/app.js` reads the URL hash (for example `#/inventory`), fetches
   `GET /api/state`, renders the selected page, and mounts charts.
3. While open, the browser posts `POST /api/simulator/tick` every 10 seconds.
   The API checks whether a tick is due before applying simulator rules.
4. The Python simulator mutates mock products, keywords, purchase drafts, and
   activity. The local server persists those changes to `mock_db.json`.
5. UI actions call the API and refresh the page state after a successful
   response. State is shared through the selected backend store, not browser
   local storage.

The shell re-renders when navigating or refreshing. It preserves the selected
catalog item and some keyboard/focus state; charts are destroyed and recreated
after each page render.

## Main Data in `mock_db.json`

- `products`: ASIN, SKU, name, category, current and competitor prices, minimum
  price floor, stock, daily velocity, supplier label, and existing PO draft ID.
- `search_terms`: term, clicks, spend, conversions, and ACoS.
- `targeted_exact_keywords` and `negative_keywords`: terms classified by PPC
  rules, including their source and creation time.
- `orders`: manager-review procurement workflows, their status, quantity,
  amount, supplier, and review details.
- `purchase_orders`: locally generated inventory replenishment drafts.
- `execution_queue`: catalog/procurement actions staged by the UI. Entries are
  bounded to the latest 100 and remain staged because no worker is configured.
- `acos_history`, `reviews`, `activity`, `manager`, and `last_updated`: sample
  chart data, review text, event log, mock identity, and simulator timestamp.

## API Reference

The same-origin API is served by either local launcher:

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Returns API health and current mode. |
| `GET /api/state` | Returns the current mock dashboard state. |
| `POST /api/simulator/tick` | Advances the simulator only when a tick is due. |
| `POST /api/orders/{order_id}/decision` | Approves or denies a pending sample workflow. |
| `POST /api/agent-actions` | Validates and stages a catalog or procurement mock action; returns `202`. |
| `GET /api/cron/simulator` | FastAPI deployment heartbeat; requires a configured bearer `CRON_SECRET`. |

The local standard-library server is `local_server.py`. `server.py` is the
FastAPI version and uses `database.py` to choose local JSON or Supabase storage.
FastAPI mode validates request bodies with Pydantic and retries state writes
when Supabase detects a revision conflict. Neither launcher has an SP-API,
Amazon Ads, AI, or supplier adapter.

## Code Map and Study Path

Suggested reading order:

1. `static/app.js`: navigation, each page renderer, UI events, API requests, and
   chart setup.
2. `mock_db.json`: the starting shape and example records behind the pages.
3. `simulator.py`: rules that modify prices, keywords, stock, and activity.
4. `local_server.py`: simple HTTP routes and local JSON persistence.
5. `server.py` and `database.py`: FastAPI routes and the JSON/Supabase store.
6. `tests/test_simulator.py` and `tests/test_database.py`: examples of the
   expected simulator and persistence behavior.
7. `ARCHITECTURE.md`: the proposed production async-worker and ingestion design.

`static/styles.css` contains the visual system and responsive layouts.
`supabase/migrations/` contains the current hosted mock-state schema. `.env.example`
lists configuration names, but Amazon and AI values are placeholders and are
not read by the mock simulator.

Run the current regression tests with:

```bash
python3 -m unittest discover -s tests -v
```

## Important Terms

- **ASIN:** Amazon Standard Identification Number, identifying a catalog item.
- **SKU:** Seller-specific stock keeping unit.
- **ACoS:** Advertising cost of sales, ad spend divided by attributed sales.
- **Days of supply:** Estimated stock coverage at the current daily velocity.
- **PO:** Purchase order. In this project, generated POs are drafts only.
- **SP-API:** Amazon Selling Partner API. It is not connected in this project.
- **LWA:** Login with Amazon, the OAuth mechanism used by SP-API applications.

For production deployment, credentials, queues, authentication, seller-scoped
data, rate limits, and reconciliation are separate work. See `ARCHITECTURE.md`;
do not treat this guide's mock controls as production integrations.