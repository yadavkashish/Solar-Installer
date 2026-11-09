# Technical Design Document — Surya Path

**GitHub:** https://github.com/yadavkashish/Solar-Installer

**Live application:** https://solar-installer.onrender.com

## Summary

Surya Path is a rooftop-solar lead qualification, quotation and project-tracking prototype for an installer in Nagpur. It supports homeowner intake, protected bill review, transparent lead follow-up, sales surveys, dated-rule quote snapshots, ordered project stages and a restricted customer-status link.

This is a take-home prototype, not an engineering design tool or a promise of current subsidy eligibility. Payments, DISCOM filings, subsidy applications and real messaging are outside the implemented scope.

## Architecture and rationale

The web UI is React, TypeScript and Vite. One Node/Express service serves the built UI and JSON API from one origin, avoiding a separate browser API origin for the hosted demo. Express uses Zod validation and role/ownership guards; Prisma persists to PostgreSQL. Cloudinary holds private bill images, and Groq is called server-side for optional bill extraction and qualification assistance. Deterministic application rules remain authoritative for validation, sizing and financial calculations.

The single-service deployment is a small-project tradeoff: fewer moving parts, but less independent scaling and isolation than separate web/API services. PostgreSQL, private object storage and provider calls are external dependencies.

## Data model

| Model | Purpose |
|---|---|
| `User`, `Session` | Roles, Argon2 password hashes, activation state and revocable database-backed sessions |
| `Lead` | Homeowner/sales intake, ownership, bill summary and sample-fixture marker |
| `BillDocument` | Private Cloudinary metadata, extraction attempt/state, raw extraction and human-confirmed fields |
| `QualificationAssessment` | Score, band, reasons, next action, source/model and recommendation |
| `RuleSet` | Dated PRICE, GENERATION and SUBSIDY JSON rules with version identifiers |
| `Survey` | Sales-confirmed usable roof area and survey findings |
| `Quote` | Immutable versioned calculation snapshot linked to its lead |
| `Project`, `StageEvent` | Current stage and append-only stage history |
| `StatusToken` | Expiring/revocable project link; only its hash is persisted |
| `NotificationEvent`, `AuditEvent` | Mock stage-notification events and selected staff actions |

`Lead` has one optional assessment, survey and project, and may have multiple bill documents and quote versions. `Project` has stage events, notification events and status tokens. PostgreSQL foreign keys enforce the main relationships.

## Main flows

1. A homeowner or sales user enters lead, roof, usage and bill details; the bill image is uploaded as a JPEG/PNG.
2. The protected image may be sent to Groq for structured bill-field suggestions. A person reviews, corrects and confirms those values, or re-uploads/uses manual entry.
3. Deterministic qualification produces a readiness band, reasons and next action. LOW leads remain actionable; they are not rejected.
4. Sales records surveyed roof area. Quote issuance selects the effective dated rules, calculates the estimate on the server, saves a versioned snapshot and serves a PDF from that snapshot.
5. Sales advances only valid project transitions. Each transition saves a stage event and a mock WhatsApp/SMS notification record; it does not send an actual message.
6. A homeowner signs in to their own records or views a minimal project timeline through an expiring customer-status URL.

## AI, validation and fallback

Bill extraction receives an image server-side and requests typed structured fields. The response is schema-validated; uncertain, unreadable, malformed or unavailable-provider results do not become confirmed data. The original extraction and the later human-confirmed values are stored separately. Users can retry, replace the image or enter the values manually. PDF bill extraction is not implemented.

Qualification receives non-identifying property/energy inputs. Groq may suggest a score and reasons, but deterministic guardrails retain short-call follow-up for tenants, low-use cases and other configured conditions. Tenants have no system-size recommendation until owner approval; small-use owners can still receive a preliminary estimate. Provider failure uses a labelled deterministic baseline.

**AI does not calculate subsidy, price, capacity, generation, savings or payback.** Those values are calculated by application code from stored rule sets.

## Quote rules and assumptions

The API selects PRICE, GENERATION and SUBSIDY rules by issue date; starts are inclusive, ends exclusive, and missing/overlapping windows prevent quote issuance. Quote snapshots preserve calculation inputs and rule versions/dates so later rule edits do not rewrite old quotes.

- **Assumption (client brief):** residential subsidy is ₹30,000/kW for each of the first two whole kW, ₹18,000 for the third whole kW, with a ₹78,000 cap. This has not been independently checked against current government policy.
- **Assumption (demo rule):** generation is 1,400 kWh/kW/year. It is persisted as a dated GENERATION rule and can be changed in the database; there is no authenticated rule-editor UI.
- **Assumption (demo rule):** installed price is ₹65,000/kW, self-consumption is 80%, and avoided tariff is ₹8/kWh. Actual customer tariffs, costs and usage can differ.
- **Assumption (demo sizing):** roof planning uses 10 m²/kW and rounds down to half-kW increments; a roof unable to support 0.5 kW receives no recommended size.
- **Assumption (demo input):** tenant and usage under 200 monthly units receive LOW readiness. The cut-offs are transparent heuristics, not a trained or validated prediction model.

Example for the seeded 3 kW synthetic quote: gross cost ₹1,95,000; estimated subsidy ₹78,000; net ₹1,17,000; estimated generation 4,200 kWh/year; estimated annual savings ₹26,880 at the demo self-use/tariff assumptions; simple payback 4.4 years. This is illustrative, not a quote commitment.

## UI and design decisions

- **Homeowner intake:** guided, labelled fields for ownership, roof, bill and optional monthly units; upload accepts JPEG/PNG and provides manual paths when AI is unavailable.
- **Bill review:** extracted suggestions remain editable and require explicit confirmation; the user can retry or replace the bill.
- **Lead overview:** shows score, reasons, provenance, sizing inputs and short-call/survey next action. LOW readiness never hides or rejects a record.
- **Quote story:** shows gross cost, estimated subsidy, net cost, annual generation/savings and payback from a saved dated-rule snapshot; a revised quote creates another version.
- **Project tracker:** shows the current stage and allowed next transition. Customer status is a separate, restricted timeline view.
- **Rule administration:** rule sets are versioned in PostgreSQL, but no admin rules screen or API for editing them is implemented.
- **Responsive layout:** single-column controls and lead cards are defined below 700 px; table-like lead rows remain horizontally scrollable.
- **Language:** English, Hindi and Marathi catalogs cover core homeowner inputs and review actions. Translation is partial; some status, quote, error and supporting text remains English.

## Security and DPDP considerations

Passwords are Argon2-hashed; sessions are server-side, expiring and revocable. Mutating cookie-authenticated requests require CSRF validation. API role and record-ownership checks separate homeowner and sales access. Inputs are validated before persistence or provider calls.

Bill images are validated in memory and stored privately. Authenticated preview/download uses time-limited URLs; a metadata failure triggers Cloudinary orphan cleanup. Customer links are random, hashed at rest, project-scoped, expiring and revocable. The public response excludes bill data, contact details, consumer numbers and staff notes.

The implementation applies data minimization to qualification and should be treated as DPDP-aware engineering, **not a legal-compliance certification**. Before real customer use, obtain appropriate notice/consent, define retention and deletion/export processes, restrict operational access, document processors, and establish incident handling. Demo fixtures are explicitly marked synthetic.

## Business case and tradeoffs

- **Assumption (client brief):** the business case describes ₹86.88 lakh/year in avoidable problem cost. The underlying counts, unit costs and calculation were not present in the repository, so this figure is reported from the brief and has not been independently recomputed.
- **Assumption (client success target):** reduce unqualified surveys from 40% to under 15%. The prototype's heuristic is intended to route more cases to a short call, not reject them; no production baseline or measured improvement is available.
- **Assumption (client success target):** issue same-day quotes for 90% of qualified leads. The snapshot flow supports a faster, repeatable quote, but actual turnaround and achievement of the target have not been measured.

Tradeoff: use explainable deterministic guardrails and immutable rule snapshots rather than an opaque model or live subsidy integration. This is easier to review and safer for estimates, but requires staff to maintain dated rules and does not prove business impact. External provider calls improve convenience but introduce availability, latency, privacy and cost dependencies; manual entry is retained as a fallback.

## What is cut and what comes next

Cut: payment processing, real WhatsApp/SMS/email, DISCOM/subsidy submission, PDF extraction, a rules-management screen, production analytics, and formal legal/engineering approval. No message is sent and no structural or subsidy eligibility decision is certified.

Next: verify a fresh local end-to-end session with an isolated PostgreSQL database; capture current screenshots; add browser-level regression coverage; implement access-controlled rule administration and retention/export workflows; measure the brief's targets against a consented, privacy-reviewed pilot; and add production monitoring and backup/restore drills.

## Screenshots

Fresh screenshots could not be captured: this environment has no local PostgreSQL service, and the live reviewer workflow has not been provisioned/verified. No stale screenshots are embedded. Capture these current, synthetic-data-only PNGs after local setup and login:

1. `docs/screenshots/01-lead-form.png` — homeowner intake with bill upload.
2. `docs/screenshots/02-bill-review.png` — bill image beside editable extracted suggestions.
3. `docs/screenshots/03-lead-score.png` — high, tenant-low and low-usage examples.
4. `docs/screenshots/04-quote-story.png` — dated-rule quote and payback.
5. `docs/screenshots/05-project-tracker.png` — project stage and mock notification.
6. `docs/screenshots/06-customer-status.png` — public synthetic status link.
7. `docs/screenshots/07-admin-rules.png` — not capturable until a rules UI exists; show the dated rule records in a local DB viewer instead and label the limitation.
8. `docs/screenshots/08-mobile-375px.png` — intake and tracker at a 375 px viewport.

## Verification and deployment record

Latest local code checks:

- `npm run typecheck` — passed.
- `npm test` — passed: 18 files, 61 tests, including synthetic fixture calculations and the non-loopback seed guard.
- `npm run build:production` — passed: Prisma Client generation, Vite production build and API TypeScript build.
- `git diff --check` — passed.

The local database-backed seed, login, repeat-seed execution, full workflow and screenshots remain unverified because this environment has no local PostgreSQL service. The seed script refuses non-loopback database URLs; no migration or seed was run against production.

After the user reported the Render service live, the expected source commit was `1771a1b4c0db7a360edbcab56e7ce78b456b07f5`. Actual GET results did not match: `/healthz` returned `{"ok":true}` without a commit field, and `/api/version` returned the older `d635dfdba922d6e3e785ffaf43cf98b4519cef91`. Render is not verified as serving the source revision. The user must confirm the correct service and manually deploy the latest `master` HEAD; recheck both endpoints after that deploy. Live provider success also remains unverified.

## Assumptions

- All three named example leads and the reviewer accounts are synthetic fixtures, not real customer data.
- The client-brief subsidy, ₹86.88 lakh/year business-case amount, and success targets are supplied assumptions, not independently verified facts.
- The 1,400 kWh/kW/year generation rule, tariff, self-use, installed price, roof-area ratio and readiness threshold are editable/demo assumptions, not forecasts or policy guarantees.
- A dated database rule represents the selected input for a quote; no rule-management UI exists.

## Local setup

Follow [deployment.md](../deployment.md). The seed creates only the three marked sample leads and explicitly named synthetic demo accounts on a loopback PostgreSQL database; it never deletes or resets records.
