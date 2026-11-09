# Deployment and reviewer guide — Surya Path

Repository: https://github.com/yadavkashish/Solar-Installer

Live app: https://solar-installer.onrender.com

## Local prerequisites

- Node.js 20+ and npm 10+.
- Docker Desktop (or another local PostgreSQL 16 instance).
- Optional provider accounts for Cloudinary and Groq. The app can use its manual bill-entry path without provider credentials.

## Local setup

1. From the repository root, copy `.env.example` to `.env`. Keep `.env` local and untracked. Use only a local PostgreSQL URL for this setup. Set the required session secret locally; provider credentials are optional for manual-entry testing.
2. Start the local database:

   ```powershell
   docker compose up -d
   ```

3. Install dependencies, generate Prisma Client, apply migrations to the local database, and seed synthetic fixtures:

   ```powershell
   npm ci
   npm run db:generate
   npx prisma migrate deploy
   npm run db:seed
   ```

   The seed refuses any non-loopback database URL by default. It never resets or deletes records. It creates/updates only its explicitly synthetic users and three sample lead IDs, dated demo rules, one quote, one tracker and a public demo status link. Confirmed bill records are preserved; if a sample ID exists as a non-sample record, the seed stops rather than replacing it.

4. Start the API and web UI in separate terminals:

   ```powershell
   npm run dev -w @surya/api
   ```

   ```powershell
   npm run dev -w @surya/web
   ```

5. Open `http://localhost:5173`. Run the available checks with:

   ```powershell
   npm run typecheck
   npm test
   npm run build:production
   ```

The repo's `docker-compose.yml` uses a local-only development database. Never point `migrate` or `db:seed` at production unless you have separately approved that operation.

### One-time maintainer remote seed

The seed is loopback-only unless the maintainer explicitly opts in for that one invocation. For the one-time synthetic demo provisioning step, set `ALLOW_REMOTE_SEED` only in the maintainer's shell/process environment, run `npm run db:seed` once against the already-configured intended database, then remove the override immediately. Do not put it in `.env`, Render environment settings, CI, or a persistent shell profile. The seed itself accepts the override only when its value is exactly `true`. Review the target database and existing demo IDs before proceeding; no migration is run by the seed. Repeat seeding is idempotent and does not reset or delete records.

## Synthetic reviewer data

Both demo users are active after the local seed. These are deliberately fake credentials for the synthetic demo only; do not reuse them for real services.

| Role | Email | Password |
|---|---|---|
| Sales | `demo-sales@example.com` | `DemoOnly!2026` |
| Homeowner | `demo-homeowner@example.com` | `DemoOnly!2026` |

Seeded brief examples:

| Lead | Synthetic intake values | Expected result |
|---|---|---|
| LD-30881 — Prashant Wankhede | Owner, ₹3,200/month, 340 units/month, 3 kW | HIGH |
| LD-30902 — Rohit Meshram | Tenant, ₹1,900/month, 210 units/month | LOW, no system-size recommendation; short call |
| LD-30915 — Ayesha Siddiqui | Owner, ₹650/month, 85 units/month, 1 kW | LOW |

These are clearly marked synthetic records, not verified people or bills. The sample project has a dated-rule quote and an Installation Scheduled timeline; notifications are mock database events only. Example customer status path after local seeding:

`http://localhost:5173/customer-status/public-demo-customer-status-link-LD-30881-2026`

The seed stores only the status-token hash. This fixed token is intentionally public and is for the synthetic sample project only.

## Render deployment

The repository includes `render.yaml` with the intended service settings:

- Branch: `master`; auto-deploy on push.
- Build command: `npm ci && npm run build:production`.
- Start command: `npm run start`.
- Health check: `/healthz`.
- `npm run build:production` generates Prisma Client and builds the Vite UI and API.
- `npm run start` starts the API, which serves the built UI from the same origin.

For the existing Render service, confirm these settings manually in the dashboard because adding `render.yaml` does not prove that the existing service imported it:

1. Open the `solar-installer` Web Service and select **Settings**.
2. Confirm the connected repository is `yadavkashish/Solar-Installer`, the root directory is the repository root, and the branch is `master`.
3. Set **Build Command** to `npm ci && npm run build:production`.
4. Set **Start Command** to `npm run start`.
5. Set **Health Check Path** to `/healthz`.
6. Enable automatic deploys from `master` (or use **Manual Deploy → Deploy latest commit** after a push).
7. In **Environment**, confirm the variables listed below. `PORT` and `RENDER_GIT_COMMIT` are supplied by Render; do not add secrets to the repository.
8. Save, deploy the latest `master` commit, and wait for Render to show the service as live.
9. Check `https://solar-installer.onrender.com/healthz` and `https://solar-installer.onrender.com/api/version`. Both should include a `commit` matching the pushed `master` HEAD. `/api/healthz` separately checks database connectivity.

Code verified live at `3fbff3b` on the last recorded check; commits through the then-current `2d74334` were documentation-only. That check predates the current seed/generator code changes. Current HEAD has not been verified live; after deployment, compare both endpoints with the pushed source commit.

## Environment variable names

`DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `NODE_ENV`, `PUBLIC_ORIGIN`, `WEB_ORIGIN` (only when a separate browser origin is used), `PORT` (Render-provided), and `RENDER_GIT_COMMIT` (Render-provided).

## Hosting and external services

Render hosts the Node service. Neon PostgreSQL is the expected hosted database, Cloudinary stores private bill images, and Groq provides optional server-side extraction/qualification. The service must have already-applied compatible Prisma migrations before it can serve database-backed routes. No automatic migration or seed runs in the Render build/start commands. Do not run a production migration or seed without separate explicit authorization.

## Known limitations and verification status

- Database-backed local login, seed idempotence by repeat execution, the full lead-to-tracker walkthrough, and browser screenshots were not verified in this environment because local PostgreSQL/Docker was unavailable. The included deterministic seed-data tests do not replace running the seed twice against a disposable database.
- The seed refuses remote databases unless a maintainer explicitly enables `ALLOW_REMOTE_SEED` for one invocation. The public Render service has not been seeded with these demo credentials; do not assume the documented sample login works on the live service until the maintainer runs and verifies the one-time seed.
- The rules are persisted and dated, but there is no admin rule editor. English/Hindi/Marathi coverage is partial. Bill PDF extraction and real outbound messaging are not implemented.
- Live Groq/Cloudinary success, current policy eligibility, measured business outcomes, and a Render deployment of this source remain unverified.
