# Mock Demo Setup and Deployment

> This is not a production integration guide. AmzSphere currently supports mock data only and is suitable for local review or a clearly labeled portfolio demo.

## Local setup

Requirements: Node.js 20 or later and npm.

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>. No secrets or external account are required. If environment configuration is needed, copy `.env.example` to `web/.env.local` and keep `AMZ_DATA_MODE=mock`.

## Verification

Run these commands from `web/` before sharing a change:

```bash
npm test
npm run typecheck
npm run build
```

## Optional demo hosting

Deploy the Next.js app with `web/` as the project root and set `AMZ_DATA_MODE=mock` if the host does not use that default. The application does not require Amazon credentials, a database, Redis, or a background worker.

## Limitations to disclose

- All seller, inventory, order, ad, competitor, and integration data is sample data.
- Writes mutate process-local memory only. They are lost on restart and are not shared across serverless instances or regions.
- Buttons that represent Amazon, advertising, or provider activity must describe a simulated action and must not send external requests.
- Mock authentication and approval privileges are for demonstration only.
- Do not provide production credentials or enable an undocumented live mode. A production system would require a separately approved architecture, durable storage, real authentication/authorization, integration security review, and explicit user approval.
