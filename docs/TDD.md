# Technical Design Document — Surya Path

**Repository URL: https://github.com/yadavkashish/Solar-Installer**
**Live URL: Not deployed.**

## Current implementation and verification (09 Nov 2026)

This section supersedes historical planning notes below. Prisma/PostgreSQL persists leads, sessions, private bill metadata, assessments, dated rules, immutable quotes, projects, notifications, audits and hashed status tokens. The lead schema now stores nullable pincode for legacy records; new intake requires a six-digit pincode, owner/tenant selection, a selectable roof type, roof area, monthly bill and a JPEG/PNG bill. Roof-type options (RCC concrete, metal sheet, tile roof, other/needs survey) are assumptions, not engineering certification.

The intake creates a lead once, then uploads the bill privately; upload failure can be retried without creating a duplicate lead. Groq bill extraction is Zod-validated. A provider `unreadable` result, invalid response, timeout or failure stores `MANUAL_REQUIRED`, preserves the private bill and presents replacement/manual-review paths. Human-confirmed bill values remain distinct from original extraction.

After bill confirmation, Groq qualification receives only ownership, roof type/area, tariff, monthly units and bill amount. It does not receive customer name, contact details, consumer number or pincode. Provider output is validated and persisted with source, model and assessment time. Provider failures persist a labelled baseline fallback. Deterministic guardrails retain short sales calls for tenants and low-readiness leads; pricing, subsidy, generation and payback remain deterministic.

English, Hindi and Marathi selection is available before sign-in, in authenticated navigation, intake, bill review, quote/project headings and customer-status views. Numeric values, identifiers and units remain unchanged.

The sales workspace uses the same lead flow as homeowner intake. Sales staff can add a customer lead; the API creates or matches a HOMEOWNER account for the customer, records `SALES_CREATED` provenance and the staff creator separately, and never stores the salesperson as the homeowner. Search supports customer name/lead ID, readiness, and project-stage filters. Brief-supplied fictional scenarios are explicitly marked as samples; repeat seeding preserves confirmed bill values. The UI displays the persisted assessment source (Groq-assisted or baseline fallback) and explains why deterministic short-call guardrails can override a high band.

Actual checks: `npx prisma validate`, `npm run typecheck`, `npm run test` (11 files, 33 tests) and `npm run build:production` passed. The forward migration adding sales-lead provenance and sample markers applied successfully to Neon; the seed ran twice successfully. A live synthetic lead was created, a private PNG was uploaded to Cloudinary and downloaded server-side. Groq extraction timed out at its bounded limit and correctly entered manual review. Successful live extraction/qualification, Playwright/browser interaction checks, and public deployment remain unverified.

## Problem and core scope

Surya Path replaces fragmented WhatsApp/Excel lead capture with a focused workflow: homeowner intake, bill review, transparent qualification, sales quote, quote PDF, and project status. The client opportunity figures are brief-supplied assumptions, not measured product results.

## Architecture and flows

React/Vite presents role-focused screens and uses TanStack Query. An Express/TypeScript API validates requests with Zod and owns deterministic calculations. Prisma/PostgreSQL persists users, customer-owned leads, sales-creation provenance, private documents, rules, quotes, projects, stage events and hashed status tokens.

The flow is intake → private bill upload/extraction → human confirmation → baseline qualification/sizing → survey → immutable quote snapshot/PDF → ordered project stages → customer-safe status view.

## AI and uncertainty

The production adapter should send images only to a configured multimodal provider and demand structured JSON validated by Zod. Original output, model metadata, field flags and corrections are stored. Missing, malformed, blurry, timeout, or rate-limited extraction never invents data: it requests re-upload or manual entry. Confidence flags mean “review indicator,” not a calibrated probability. Baseline rules keep work moving when AI is unavailable; AI cannot finalise pricing or override rules.

## Calculation example

For 3 kW: gross cost is 3 × ₹65,000 = ₹195,000. Demo subsidy is ₹78,000, net ₹117,000. Annual generation is 3 × 1,400 = 4,200 units. Savings use 80% self-consumption × ₹8 = ₹26,880/year; simple payback is 4.4 years. Values are estimates. Rules are date-effective; start is inclusive and end exclusive; overlaps are rejected. Issued snapshots retain inputs and rule version.

## Security and limits

Production controls include bcrypt/Argon password hashing, HttpOnly secure sessions, CSRF token checks, exact CORS, role/ownership enforcement, rate limits, file magic-byte validation, private object storage, and safe logging. Status links use random secrets stored as hashes with expiry/revocation and omit bills, consumer number and staff notes. The compact demo demonstrates validation and rate limiting but requires persistence/auth middleware completion before production. This is not a claim of legal compliance.

## Assumption register / cuts

The generation, roof, price, self-consumption, rate, and fractional subsidy policies are explicit demo assumptions. Quote rules require policy verification. Roof-type choices are intake assumptions, not engineering certification. Browser automation and a public deployment remain outstanding; live Groq success remains unverified because the bounded provider request timed out during the recorded check.

## Verification record

Tests cover subsidy cap, fractional policy, commercial ineligibility, generation/payback, roof constraint, short-call guardrails, bill contracts, Groq contracts, status links, saved-quote mapping and route parsing. The final recorded commands are `npm run typecheck`, `npm run test` (33 tests), and `npm run build:production`.
