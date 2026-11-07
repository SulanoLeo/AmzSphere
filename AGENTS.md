# AmzSphere Agent Guide

This repository is a mock-only Next.js seller operations demo. Read this guide before making changes.

## Supported stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4 in `web/`.
- Native Next.js route handlers in `web/app/api/`.
- Deterministic mock state from `web/mock_db.json`, accessed through `web/lib/mock-state.ts`.
- Mock business logic in `web/lib/`.

All application changes belong under `web/`, except for directly related documentation, tests, and agent configuration.

## Hard boundaries

- Never add Python, FastAPI, PostgreSQL, Redis, Supabase, or a separate backend service.
- Never add real Amazon, advertising, SEO-provider, or other external API calls or credentials.
- Keep all example data synthetic and clearly distinguish simulated actions from real side effects.
- Do not claim that process-local writes are durable or synchronized across serverless instances.
- Product Research remains deferred; do not present it as an implemented page.

If work appears to need a live service or production credential, keep it out of scope and explain the limitation instead.

## Verification

Run from `web/`:

```bash
npm test
npm run typecheck
npm run build
```

For UI changes, preserve keyboard access, semantic HTML, status announcements, and responsive layouts. Use the `accessibility-lead` skill before changing HTML, JSX, TSX, CSS, or templates.

See [README.md](./README.md), [PROJECT_GUIDE.md](./PROJECT_GUIDE.md), and [ARCHITECTURE.md](./ARCHITECTURE.md) for the current project details.
