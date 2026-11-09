# Technical Design Document — Surya Path

**Repository URL: https://github.com/yadavkashish/Solar-Installer**
**Live URL: Not deployed.**

## Problem and core scope

Surya Path replaces fragmented WhatsApp/Excel lead capture with a focused workflow: homeowner intake, bill review, transparent qualification, sales quote, quote PDF, and project status. The client opportunity figures are brief-supplied assumptions, not measured product results.

## Architecture and flows

React/Vite presents role-focused screens and uses TanStack Query. An Express/TypeScript API validates requests with Zod and owns deterministic calculations. The supplied Prisma/PostgreSQL schema models users, leads, documents, rules, quotes, projects, stage events and hashed status tokens. The runnable assessment demo seeds in memory so it works without infrastructure; production persistence is the Prisma target.

The flow is intake → private bill upload/extraction → human confirmation → baseline qualification/sizing → survey → immutable quote snapshot/PDF → ordered project stages → customer-safe status view.

## AI and uncertainty

The production adapter should send images only to a configured multimodal provider and demand structured JSON validated by Zod. Original output, model metadata, field flags and corrections are stored. Missing, malformed, blurry, timeout, or rate-limited extraction never invents data: it requests re-upload or manual entry. Confidence flags mean “review indicator,” not a calibrated probability. Baseline rules keep work moving when AI is unavailable; AI cannot finalise pricing or override rules.

## Calculation example

For 3 kW: gross cost is 3 × ₹65,000 = ₹195,000. Demo subsidy is ₹78,000, net ₹117,000. Annual generation is 3 × 1,400 = 4,200 units. Savings use 80% self-consumption × ₹8 = ₹26,880/year; simple payback is 4.4 years. Values are estimates. Rules are date-effective; start is inclusive and end exclusive; overlaps are rejected. Issued snapshots retain inputs and rule version.

## Security and limits

Production controls include bcrypt/Argon password hashing, HttpOnly secure sessions, CSRF token checks, exact CORS, role/ownership enforcement, rate limits, file magic-byte validation, private object storage, and safe logging. Status links use random secrets stored as hashes with expiry/revocation and omit bills, consumer number and staff notes. The compact demo demonstrates validation and rate limiting but requires persistence/auth middleware completion before production. This is not a claim of legal compliance.

## Assumption register / cuts

The generation, roof, price, self-consumption, rate, and fractional subsidy policies are explicit demo assumptions. Quote rules require policy verification. Hindi/Marathi, real extraction wiring, actual uploads, customer token issuance, DB migrations/seed implementation, Playwright coverage and deployment were cut to protect the core working flow. Next: complete persistence/auth and upload adapter, then provider/live test, token status links, and browser tests.

## Verification record

Engine tests cover subsidy cap, fractional policy, commercial ineligibility, generation/payback and roof constraint. Type/build results must be copied from the final command run before submission; no live AI call was made because credentials were unavailable.
