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
