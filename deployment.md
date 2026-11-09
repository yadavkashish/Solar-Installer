# Deployment guide

## Prerequisites

Node 20+ and npm 10+. Copy `.env.example` to root `.env`; never commit it. Neon PostgreSQL is the recommended database; Docker PostgreSQL is optional for local-only development. The API uses database-backed Argon2 users/sessions, role and ownership checks, private Cloudinary bill storage, Groq bill extraction and Groq-assisted qualification with deterministic guardrails.

## Local development

```powershell
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev -w @surya/api
# in another terminal
npm run dev -w @surya/web
```

Open http://localhost:5173. Synthetic demo accounts are `sales@surya.demo` and `prashant@surya.demo`; their development-only password is `DemoPass!2026`.

## Production: one Node web service

The production service builds the Vite frontend and serves it from Express on the same origin as `/api`. It listens on `PORT` (default `3001` locally) on `0.0.0.0`. Application routes use the SPA fallback; unknown `/api/*` requests return JSON `404` rather than HTML.

```powershell
npm ci
npm run build:production
npm run start
```

`npm run build:production` runs Prisma Client generation and builds both workspaces. `npm run start` runs `apps/api/dist/server.js`, which serves `apps/web/dist`. Use `/healthz` as the host health-check path; it is a process liveness response. `/api/healthz` additionally checks Neon and returns a safe `503` if PostgreSQL is unavailable.

Prisma and the API load `DATABASE_URL` from the root `.env`. Use Neon’s pooled connection URL for the running API and retain its SSL options. Use a separate direct or disposable Neon branch/database only when Prisma development tooling requires a shadow database; never use the application database as its own shadow database. Docker remains optional: run `docker compose up -d` and use a local `DATABASE_URL` if you prefer it.

The production sequence is:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

## Checks

Latest local result (09 Nov 2026): `npx prisma validate`, `npm run typecheck`, `npm run test` (10 files, 31 tests), and `npm run build` passed. The pincode/assessment-provenance forward migration was applied successfully and `npm run db:seed` ran twice successfully without resetting data. A later read-only `prisma migrate status` retry hit intermittent Neon `P1001`; no reset or schema change followed. A real synthetic PNG reached Cloudinary and was downloaded privately; Groq extraction timed out and correctly produced the manual-review path.

## Environment

Enter these names and their values in the host’s Environment page; never commit a `.env` file: `DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `NODE_ENV=production`, and `PUBLIC_ORIGIN=https://your-service.onrender.com`. Render provides `PORT`; do not set it manually. Set `WEB_ORIGIN` only if a separate browser origin must call the API; leave it unset for this same-origin deployment. `PUBLIC_ORIGIN` is required in production so customer status links never contain localhost. JPEG/PNG are supported for extraction; PDF extraction is intentionally unsupported and users can enter bill details manually.

## Hosting

Use a Render **Web Service**, connect the GitHub repository, choose branch `master`, set Build Command to `npm ci && npm run build:production`, Start Command to `npm run start`, and Health Check Path to `/healthz`. Apply `npx prisma migrate deploy` from an authorised environment before the first service release (Render’s pre-deploy command is not available on the Free web-service plan). Render’s Environment page is where the variables above are entered. Free web services are available, but they spin down after 15 minutes idle and use an ephemeral filesystem; this application keeps persistence in Neon and private bills in Cloudinary, not local storage. Bills are validated from memory, document metadata is persisted, and provider failures preserve the document for retry/manual entry. Quote PDFs use the issued snapshot; dated price, generation and subsidy rules are selected at issue time. Payment, WhatsApp/SMS, DISCOM and subsidy submission are mocked; no real external action occurs.

## Remaining setup blockers

Successful live Groq extraction/qualification remains unverified: the configured extraction request timed out, although the authenticated Cloudinary upload/private-download/manual-review path was exercised. Automated provider tests use mocks. Full Playwright browser regression coverage and public deployment remain outstanding.
