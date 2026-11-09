# Technical Design Document — Surya Path

**GitHub:** https://github.com/yadavkashish/Solar-Installer

**Live application:** https://solar-installer.onrender.com

**Deployment status:** verify the running source revision through `GET /api/version`, which reports Render's `RENDER_GIT_COMMIT`. A healthy URL alone is not treated as commit verification.

## Purpose and scope

Surya Path turns solar enquiries into an accountable workflow: homeowner intake, protected bill review, transparent qualification, sales survey, immutable quote/PDF, ordered project progress, and a customer-safe status view. It replaces fragmented WhatsApp/Excel capture; it does not provide payments, DISCOM filing, subsidy applications, engineering approval, or legal/policy advice.

## Architecture

The deployed service is one Node process. React/Vite provides the responsive browser UI; Express serves its production build and `/api` on the same origin. The Express API validates input with Zod, enforces role/record ownership, performs deterministic calculation, and exposes a JSON API. Prisma connects the API to Neon PostgreSQL. Cloudinary stores authenticated bill images and Groq is used server-side for image extraction and qualification assistance.

The primary flow is: intake → protected JPEG/PNG bill upload → optional AI extraction → human confirmation → qualification/sizing → sales survey → dated-rule quote snapshot/PDF → ordered project transitions → authenticated homeowner or customer-safe token status view.

## Data model and persistence

PostgreSQL persists Argon2-hashed users, database-backed sessions, customer-owned leads, sales-creation provenance, private bill metadata, original extraction JSON, confirmed bill JSON, qualification assessments, rule sets, surveys, immutable quote versions, projects, stage events, mock notification events, audit events, and hashes of customer status tokens.

New intake requires a six-digit pincode, owner/tenant relationship, roof type, roof area, monthly bill, and a bill image. Pincode remains nullable for legacy records; the migration does not invent historic values. A sales-created lead is owned by an existing or provisioned homeowner, while `createdBy` records the sales user separately. A newly provisioned homeowner cannot sign in until they redeem a one-time activation link; there is no automatic activation email.

## Authentication, authorisation and privacy

Passwords use Argon2. Sessions are server-managed, expire/revoke in PostgreSQL, and use HttpOnly cookies. Cookie-authenticated mutations require CSRF validation. Pending provisioned accounts are denied sign-in until activation; sales sees the one-time link only in the authenticated creation response and must relay it securely. Leads, bills, quotes and PDFs use database relationship checks: homeowners see only their own records; quote issue, survey, stage change and customer-link administration are sales actions. Unauthorised API access receives an error rather than application data.

Bill files are memory-buffer validated by MIME, size and signature before authenticated Cloudinary upload. Metadata records Cloudinary’s returned public ID, resource/delivery type, format, size and lead ownership. Preview/download is authorised server-side and returned as an explicitly expiring private link. A metadata write failure triggers asset cleanup. Customer status tokens are cryptographically random, stored only as hashes, scoped to a project, expiring and revocable; their public response excludes bills, consumer numbers, private URLs and staff notes.

## AI, manual fallback and assessment provenance

The Groq bill adapter retrieves the protected image server-side; the browser never receives provider credentials or a public bill URL. It requests a typed structured response, validates it with Zod, preserves consumer-number strings (including leading zeros), and stores original extraction separately from reviewed fields. A timeout, malformed response, unavailable model, provider error, or `unreadable` result records a manual-required state, retains the uploaded bill, and provides retry, re-upload or manual entry. It never fabricates values or marks upload success as extraction success. PDF bill extraction is deliberately unsupported: users are asked for JPEG/PNG or manual entry.

After human confirmation, Groq qualification receives only ownership, roof data, tariff, monthly units and bill amount—not the name, contact details, pincode or consumer number. The saved assessment includes source, model and time. Provider failure saves a labelled baseline fallback. Deterministic guardrails mean tenants and low-readiness leads still get the actionable next step **Short sales call**, even if an AI-assisted band is high. AI never determines price, subsidy, sizing, generation, savings or payback.

## Dated calculations and quotes

At issue time, the API selects one effective PRICE, GENERATION and SUBSIDY rule from PostgreSQL. Effective starts are inclusive and ends exclusive; gaps or overlaps reject issuance. Quote issue is transactional and creates a new immutable version; it never changes a previous snapshot. The snapshot drives the PDF, including capacity, annual generation, issue time, rule effective date, assumptions, and estimate disclaimers.

Current synthetic assumptions are INR 65,000/kW, 1,400 units/kW/year, 80% self-consumption, and INR 8/unit. Residential subsidy is estimated as INR 30,000/kW for the first two whole kW plus INR 18,000 for the third, capped at INR 78,000; commercial eligibility is review-required. These are seeded demo rules, not current policy commitments. Consumption-based capacity and roof-limited capacity are shown separately. If reported usable area cannot support the minimum 0.5 kW demo system, no 0 kW quote is recommended; the site needs survey confirmation. A saved sales survey supplies usable roof area for the post-survey recommendation.

## UI decisions

Homeowners and sales users share one role-aware interface with English, Hindi and Marathi selection. Numeric values, identifiers and units are preserved across language selection. Homeowners create and review their own leads; sales can search by customer/lead ID, readiness and stage, record survey findings, issue/revise quotes, advance valid stages, and create/revoke customer links. Direct `/leads/:id/{bill|quote|project}` navigation restores after refresh. The customer status link is a restricted public view, separate from homeowner authentication.

Survey saving is dirty-state aware: the action is disabled until input changes, success is announced only after a persisted response and shows the saved time, and failures retain values with an inline retry. Quote issue similarly waits for a persisted response, announces ID/capacity/issue time, offers PDF download, and changes the primary action to an explicit **Create revised quote** action that preserves prior snapshots.

## Current interface screenshots

Fresh browser screenshots were not captured for this revision; the generated document does not reuse the stale embedded images.

## Verification record

Actual local checks on 09 Nov 2026 for this source revision:

- `npm run typecheck` — passed.
- `npm test` — passed: 17 test files, 53 tests.
- `npm run build:production` — passed: Prisma Client generation, Vite production build and API TypeScript build.

Tests cover deterministic calculation and insufficient-roof boundaries, missing/overlapping dated rules, quote snapshot mapping, assessment guardrails/provenance, complete bill confirmation, extraction compare-and-swap, Cloudinary orphan cleanup, Express async error forwarding, account activation, bill and Groq response contracts, customer-token expiry/revocation, project transitions, database-error behaviour, route parsing and image-only document validation. Provider and concurrency tests use controlled test doubles. Prisma reported the Neon schema up to date; no migration, seed, reset, or provider call was made in this verification. Successful live Groq extraction/qualification and fresh browser screenshots remain unverified.

## Assumptions, cuts and next steps

- Roof type choices (RCC concrete, metal sheet, tile roof, other/needs survey) are intake assumptions, not structural certification.
- Price, generation, self-use, tariff and subsidy figures are seeded demo assumptions and require current policy/site review.
- Mock notification records are persisted; no SMS, WhatsApp or email is sent.
- Browser E2E/Playwright coverage, fresh current-app screenshots, and a repeat live Groq success test remain future work. Verify the Render source commit with `/api/version` after each push.
- Add operational monitoring, backup/retention policy, provider cost controls, accessibility audits and formal security review before a production commercial rollout.

## Setup summary

Use the exact instructions in [deployment.md](../deployment.md). Required variable names are `DATABASE_URL`, `SESSION_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GROQ_API_KEY`, `GROQ_VISION_MODEL`, `NODE_ENV`, and `PUBLIC_ORIGIN`; no values are stored in this document. The idempotent synthetic seed provides `sales@surya.demo` and `prashant@surya.demo`, both with the development-only password `DemoPass!2026`.
