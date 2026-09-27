# CLAUDE.md — SiteFlow

Standing instructions for Claude working in this repository.

## Project

SiteFlow is a mobile and web workflow platform for an architecture practice (business owner: Architect Parvez; delivery: TAN GLOBUS AI). It runs each project through Studio and Site workstreams with gates, sign-offs, checklists, payment milestones, change control, private and shared calendars, and a portfolio dashboard for about 20 concurrent projects.

- Core requirements: `docs/SiteFlow-PRD-v3.2.md`
- V4 enhancements: `docs/SiteFlow-PRD-V4.md` (governs any capability it specifies)
- Build steps: `docs/IMPLEMENTATION_PLAN.md` (S00 to S20), then `docs/V4_IMPLEMENTATION_PLAN.md` (V01 to V25)
- Progress log: `docs/PROGRESS.md`
- Decisions: `docs/decisions/`

## How to work

1. Read the PRD sections referenced by the current step before writing code.
2. Do only the step you were given. Do not start later steps.
3. If the PRD is unclear or conflicts with the plan, stop and write the question in `docs/PROGRESS.md` under "Open questions" rather than guessing.
4. Values not yet decided by Parvez go in configuration with the marker `TBD_PARVEZ`. Never invent SLAs, thresholds, tolerances, percentages or lead times.
5. Finish each step by running all tests, then updating `docs/PROGRESS.md` with: done, not done, deviations, open questions.

## Stack

- Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, PostgreSQL 16, Redis + arq, S3-compatible storage (MinIO locally)
- Web: React, TypeScript, Vite, React Router, TanStack Query
- Mobile: Capacitor 7 wrapping the web app, Android first, app id `ai.tanglobus.siteflow`
- Tests: pytest, Vitest, Playwright
- Run locally: `docker compose up`

## Architecture rules

- Modular monolith. One folder per domain in `backend/app/modules/`. Modules talk through service interfaces and domain events, not each other's tables.
- The workflow engine is a deterministic rules engine. New gate types register an evaluator; they never hard-code checks in UI or endpoints.
- Every blocked activity must return a list of human-readable reasons.
- Approved, frozen and signed records are immutable. Corrections create a new revision linked to the previous one.
- Every write endpoint records an `AuditEvent` (actor, action, entity, summary of change, time).

## Security and privacy rules

- Enforce authorization on the server for every route: role, project membership, field-level rules.
- Private calendar event details must never appear in logs, notifications, exports, dashboards or any non-owner API response. Free and busy only.
- Commercial fields are visible only to roles allowed by the permission matrix.
- Use presigned URLs for media; never make buckets public.
- No secrets in code or commits.

## V4 integration and AI rules

- Webhooks: verify signatures, reject replays, process idempotently, keep the raw payload under policy.
- A delivery or read receipt is never an approval or proof of payment. A calendar RSVP is attendance only.
- Channel-reply approval follows PRD V4 section 11.4A exactly: only a verified WhatsApp button reply or tokenized email APPROVE, and only for sign-off types enabled in configuration.
- A client saying "paid" creates a verification task; only Accounts can mark payment Received or Cleared.
- Every AI call goes through `backend/app/modules/ai` (gateway, prompt registry, `AIExecution` audit). No direct provider calls elsewhere.
- AI output is always labelled as AI, links to its sources, and stays a suggestion or draft until a person accepts it.
- AI must never approve, sign off, pass a checklist item, set official progress, issue drawings, or make structural or safety determinations.
- Core capture, submission and review must keep working when AI is switched off.
- Personal calendar data and records labelled AI Prohibited never enter AI context, embeddings or training data.

## Code conventions

- Type hints everywhere; Pydantic schemas for all request and response bodies.
- Alembic migration for every schema change; never edit a migration that has been merged.
- Tests alongside each feature: unit tests for rules and state machines, API tests for permissions, Playwright for acceptance scenarios.
- Small, focused commits with clear messages.
- User-facing text in plain English; statuses shown with text as well as colour.

## Naming

- Company name is always written TAN GLOBUS AI.
- Delivery phases are described as Build → Deploy → Evaluate → Maintain.
