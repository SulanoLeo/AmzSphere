# AmzSphere Swarm Guide

This directory contains the agent configuration for the AmzSphere pure-frontend Next.js + Tailwind CSS migration.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript, React 19) — lives in `web/`
- **Styling:** Tailwind CSS
- **Data:** Local mock state (`mock_db.json`) served via native Next.js API Routes (`web/app/api/`)
- **Python/FastAPI backend:** removed

## Agents

| Agent | Role |
|-------|------|
| Orchestrator | Coordinates tasks, verifies build/typecheck, handles confirmations |
| Frontend & UI | Modifies `web/app/`, `web/components/`, `web/lib/`, Tailwind config |
| QA & Verification | Runs `cd web && npx tsc --noEmit` and `cd web && npx next build` |

## Swarm Board

The task queue lives at `.kilo/swarm_board.json`. Each task has:
- `id`: unique task identifier
- `title`: short description
- `agent`: which agent is assigned
- `status`: `pending`, `in_progress`, `completed`, or `blocked`

## Verification

All agents should verify with:

```bash
cd /home/lkkolokoy/AmzSphere/web && npx tsc --noEmit
cd /home/lkkolokoy/AmzSphere/web && npx next build
```

## Project structure

```
web/
  app/              # Next.js App Router (pages + API routes)
  app/api/*         # Mock-backed route handlers (replaces FastAPI endpoints)
  components/       # Modular, reusable UI components
  components/ui/*   # Base UI primitives (button, card, badge)
  context/          # React context (ProductContext)
  hooks/            # Client hooks (useListingHealth)
  lib/              # Mock state, scoring, simulator, providers, utils
  lib/mock-state.ts # Read/write cache over mock_db.json
  lib/scoring.ts    # Optimization score rules
  lib/simulator.ts  # Mock market simulator (10-second ticks)
  lib/provider/*    # Product provider interface + mock client
```

No Python, PostgreSQL, Redis, or Supabase is required to run or deploy.

## Tech stack guardrail

AmzSphere is a **pure-frontend Next.js + Tailwind CSS application**. To avoid confusion and drift, the following rules are enforced for all future work:

**Allowed stack:**
- Next.js 15 (App Router, TypeScript, React 19) under `web/`
- Tailwind CSS for styling under `web/`
- Native Next.js API Routes under `web/app/api/` backed by `mock_db.json` via `web/lib/mock-state.ts`
- Mock-only business logic (scoring, simulator, provider) under `web/lib/`

**Forbidden (do not reintroduce):**
- Python / FastAPI / `server.py`, `local_server.py`, `database.py`, `scoring.py`, `simulator.py`
- `backend/`, `requirements.txt`, `compose.yaml`, `.venv`, `supabase/`
- PostgreSQL, Redis, or any live database (`lib/db.ts`, `pg`, `asyncpg`)
- `vercel.json` microservice rewrites, crons, or backend env vars (SP-API, DATABASE_URL, REDIS_URL, etc.)
- `app/api/v1/` PostgreSQL-backed routes

Before starting any feature, confirm the change touches only `web/` and uses the allowed stack. If a change would require Python, a database, or a live backend service, it is out of scope for this repository unless the stack guardrail is explicitly revised and approved.
