# Deployment guide

## Prerequisites

Node 20+ and npm 10+. Copy `.env.example` to root `.env`; never commit it. Neon PostgreSQL is the recommended database; Docker PostgreSQL is optional for local-only development. The API uses database-backed Argon2 users/sessions, role and ownership checks, private Cloudinary bill storage, and optional Groq image extraction.

## Local run (verified application build)

```powershell
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev -w @surya/api
# in another terminal
npm run dev -w @surya/web
```

Open http://localhost:5173. Synthetic demo accounts are `sales@surya.demo` and `prashant@surya.demo`; their development-only password is `DemoPass!2026`.

Prisma and the API load `DATABASE_URL` from the root `.env`. Use Neon’s pooled connection URL for the running API and retain its SSL options. Use a separate direct or disposable Neon branch/database only when Prisma development tooling requires a shadow database; never use the application database as its own shadow database. Docker remains optional: run `docker compose up -d` and use a local `DATABASE_URL` if you prefer it.

The production sequence is:

```powershell
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

## Checks

Latest local result (09 Nov 2026): `npm run typecheck` passed; `npm run test` passed (9 files, 28 tests); `npm run build` passed; and `npx prisma migrate status` reported three migrations with an up-to-date schema. `npm run db:seed` was attempted twice but both attempts failed with `PrismaClientInitializationError` because the configured Neon pooled host could not be reached. No reset, deletion or migration was performed.

## Environment

`DATABASE_URL` is the PostgreSQL connection; `SESSION_SECRET` signs sessions; `GROQ_API_KEY` and `GROQ_VISION_MODEL` configure the server-side bill extractor; `WEB_ORIGIN` is the allowed CORS origin. Cloudinary requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. JPEG/PNG are supported for extraction; PDF extraction is intentionally unsupported and users can enter bill details manually.

## Hosting

Deploy API and web separately (or web static assets behind the API). Use managed PostgreSQL and authenticated Cloudinary delivery, set HTTPS-only cookies, configure the exact CORS origin, and run migrations during release. Bills are validated from memory, document metadata is persisted, and provider failures preserve the document for retry/manual entry. Quote PDFs use the issued snapshot; dated price, generation and subsidy rules are selected at issue time. Payment, WhatsApp/SMS, DISCOM and subsidy submission are mocked; no real external action occurs.

## Remaining setup blockers

Real provider verification requires `GROQ_API_KEY` and the three Cloudinary variables. Automated provider tests use mocks. Full Playwright browser regression coverage and public deployment remain outstanding. The fresh-seed/runtime check is currently blocked by intermittent reachability of the configured Neon pooled host; do not reset the application database to work around it.
