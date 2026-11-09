# Deployment guide — Surya Path

Repository: https://github.com/yadavkashish/Solar-Installer

Live service: https://solar-installer.onrender.com

The deployed service is a single Node web service: Express serves the built Vite application and its `/api` routes on the same origin. `GET /api/version` returns Render's `RENDER_GIT_COMMIT`; compare it with the pushed commit before describing a release as deployed.

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

Open `http://localhost:5173`. The idempotent synthetic seed provides these development-only accounts:

| Role | Email | Password |
| --- | --- | --- |
| Sales | `sales@surya.demo` | `DemoPass!2026` |
| Homeowner | `prashant@surya.demo` | `DemoPass!2026` |

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

`prisma migrate deploy` applies forward-only migrations and does not reset or reseed the database. The sample seed is idempotent, but it is not required for deploying existing customer data.

## Recorded checks

Current checks on 09 Nov 2026: `npm run typecheck` passed, `npm test` passed (17 files, 53 tests), and `npm run build:production` passed. `npx prisma migrate status --schema=prisma/schema.prisma` reported the Neon schema up to date. No migration, seed, reset, or provider request was run in this verification. The post-push `GET /api/version` check returned JSON `404`; the deployed revision is therefore unverified.

## Environment

Enter values for these names in the host’s Environment page; never commit a `.env` file: `DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `NODE_ENV`, and `PUBLIC_ORIGIN`. Set `NODE_ENV=production` and `PUBLIC_ORIGIN=https://solar-installer.onrender.com`. Render provides `PORT`; do not set it manually. Set `WEB_ORIGIN` only if a separate browser origin must call the API; leave it unset for this same-origin deployment. `PUBLIC_ORIGIN` is required in production so customer status links never contain localhost. JPEG/PNG are supported for extraction; PDF extraction is intentionally unsupported and users can enter bill details manually.

## Hosting

Use a Render **Web Service**, connect the GitHub repository, choose branch `master`, set Build Command to `npm ci && npm run build:production`, Start Command to `npm run start`, and Health Check Path to `/healthz`. Apply `npx prisma migrate deploy` from an authorised environment before the first service release and for later forward migrations. Render’s Environment page is where the variables above are entered. This application keeps persistence in Neon and private bills in Cloudinary, not local storage. Bills are validated from memory, document metadata is persisted, and provider failures preserve the document for retry/manual entry. Quote PDFs use the issued snapshot; dated price, generation and subsidy rules are selected at issue time. Payment, WhatsApp/SMS, DISCOM and subsidy submission are mocked; no real external action occurs.

Sales-created homeowner accounts remain unable to sign in until the seven-day, one-time activation link is redeemed. The creating sales user must relay the link securely; this application does not send activation email. The link is shown only in the authenticated creation response and can be reissued by creating another lead for a still-pending homeowner account.

After pushing a release, verify `GET https://solar-installer.onrender.com/api/version` reports the exact pushed commit. A public health response alone does not establish which source revision is running.

## Known limitations

The deployed public origin is listed above. Successful live Groq extraction/qualification remains unverified; automated provider tests use mocks. Fresh browser screenshots were not captured for this revision, and the final design document omits stale screenshots. Full Playwright browser regression coverage remains a future improvement. PDF bill extraction is intentionally unsupported; request a JPEG/PNG bill or use manual entry.
