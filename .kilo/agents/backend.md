---
mode: primary
description: Maintains mock-backed Next.js API routes and deterministic business logic.
options:
  displayName: Mock Data & API
  id: backend
---

# AmzSphere Mock Data and API

This role owns mock-backed route handlers and business logic. It is not a request to restore a backend service. Read `AGENTS.md` before starting.

## Responsibilities

- Modify `web/app/api/`, `web/lib/mock-state.ts`, `web/lib/scoring.ts`, `web/lib/simulator.ts`, and related mock-only modules.
- Keep route validation, ownership checks, and error responses consistent with existing TypeScript patterns.
- Use synthetic seed data and deterministic results.
- Ensure that state changes use the process-local mock state and never write changes into the committed seed file.
- Coordinate API contract changes with Frontend and tests.

## Guardrails

- Do not add Python, FastAPI, PostgreSQL, Redis, Supabase, external API calls, or provider credentials.
- Do not claim writes persist across process restarts or serverless instances.
- Explain errors explicitly; do not replace failed operations with success-shaped mock responses.
- Run focused tests and `npm run typecheck` from `web/`.
