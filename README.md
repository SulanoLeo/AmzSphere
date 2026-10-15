# AmzSphere

Amazon marketplace operations simulator MVP. The current app runs entirely on
local mock data; SP-API credentials in `.env.example` are placeholders and are
not read by the mock server.

## Run locally

The simplest option uses only Python's standard library:

```bash
python3 local_server.py
```

Open <http://127.0.0.1:8000>. Stop the server with `Ctrl+C`. The JSON state is
stored in `mock_db.json` and the simulator updates it every 10 seconds.

No frontend build step is needed. Chart.js and the display fonts load from CDNs,
so those visual assets require an internet connection.

## FastAPI option

Install the system's Python venv support if needed, then install the declared
dependencies in a project-local environment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
AMZ_DATA_MODE=mock .venv/bin/uvicorn server:app --reload
```

## Verify

Run the dependency-free simulator tests with:

```bash
python3 -m unittest discover -s tests -v
```

The mock API exposes `GET /api/health`, `GET /api/state`, and
`POST /api/orders/{order_id}/decision` with `{"action":"approve"}` or
`{"action":"deny"}`. Live SP-API integration is not implemented; selecting
live mode in the FastAPI server fails explicitly rather than using mock data.
The catalog and procurement agent controls stage sandbox actions at
`POST /api/agent-actions`; they do not call Amazon or suppliers. See
[`ARCHITECTURE.md`](ARCHITECTURE.md) for the production async-worker design,
data-ingestion flow, and boundary between the prototype and that design.

## Deploy to Vercel and Supabase

1. Create a Supabase project and run the SQL migration in
	`supabase/migrations/20261009000000_create_amzsphere_state.sql` using the
	Supabase SQL editor or Supabase CLI.
2. Connect this repository to Vercel. Vercel detects the root `server.py`
	FastAPI app; `vercel.json` includes the seed file and schedules a daily
	simulator heartbeat compatible with Vercel Hobby.
3. Add `AMZ_DATA_MODE=mock`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY` to the
	Vercel project's environment variables. Add a strong `CRON_SECRET` for the
	scheduled heartbeat. Never use the Supabase secret/service-role key in
	browser code.
4. Deploy. The first API request seeds one Supabase JSONB row from
	`mock_db.json`; later state changes persist in Supabase using revision-checked
	updates.

An open dashboard requests a tick every 10 seconds. The daily Vercel Cron is an
idle heartbeat; Hobby supports only daily schedules. On Pro or Enterprise, its
schedule can be changed to `* * * * *` for a per-minute heartbeat. This is
mock-market data, not an Amazon SP-API connection. Approval actions are not
authenticated yet; keep the deployment private until Supabase Auth or another
manager access control is added.
